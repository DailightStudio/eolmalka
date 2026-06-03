// 카테고리별 1년치 일별 시계열 + 30일 예측.
// 환율 2개(fx-usd / fx-jpy)는 fx-provider를 통해 실데이터(Frankfurter 무키)를 시도하고,
// 실패 시 합성으로 폴백 — `live`=true면 실데이터.
// 나머지 카테고리(주유·금·항공권)는 결정론적 더미 시계열.

import { getFxSeries, type FxBase, type FxSource } from "./fx-provider";
import { getGasLatest } from "./gas-provider";
import { getGoldLatest } from "./gold-provider";
import { getKrxGoldDaily } from "./krx-gold-provider";
import { getKrxOilDaily } from "./krx-oil-provider";
import { appendDaily, loadDailySeries, mergeWithDaily } from "./series-store";

export type Point = {
  date: string;
  value: number;
  forecast?: boolean;
};

export type Series = {
  slug: string;
  past: Point[];
  forecast: Point[];
  // forecast와 같은 길이, 각 점의 ±1σ 상·하한 (불확실성 시각화용)
  forecastBand?: { upper: number[]; lower: number[] };
  source: "live" | "synthetic";
  sourceName:
    | FxSource
    | "opinet"
    | "opinet+krx-oil"
    | "coingecko-paxg"
    | "krx-gold"
    | "synthetic";
  pastIsLive: boolean;
  liveDays?: number;
};

// ── 결정론적 의사난수 (시드 기반, 빌드마다 동일 곡선) ─────
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type SyntheticProfile = {
  base: number;
  yearlyAmp: number;
  noiseAmp: number;
  trend: number;
  forecastDir: number;
};

const SYN_PROFILES: Record<string, SyntheticProfile> = {
  "gas-petrol": { base: 1652,  yearlyAmp: 0.06, noiseAmp: 0.004, trend: 0.00, forecastDir: 0.003 },
  "gold-kr":    { base: 125400, yearlyAmp: 0.08, noiseAmp: 0.006, trend: 0.15, forecastDir: 0.02 },
  "air-nrt":    { base: 220000, yearlyAmp: 0.18, noiseAmp: 0.025, trend: 0.00, forecastDir: -0.04 },
  "air-tpe":    { base: 300000, yearlyAmp: 0.20, noiseAmp: 0.030, trend: 0.02, forecastDir: 0.06 },
};

// 환율 슬러그 → Frankfurter base 통화 (fx-XXX 패턴이면 XXX 추출)
function fxBaseOf(slug: string): FxBase | undefined {
  const m = slug.match(/^fx-([a-z]{3})$/);
  return m ? m[1].toUpperCase() : undefined;
}

const DAYS = 365;
const FORECAST_DAYS = 30;

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}
function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

export async function getSeries(slug: string): Promise<Series> {
  const s = await getSeriesRaw(slug);
  if (s.forecast.length > 0 && s.past.length > 0) {
    return { ...s, forecastBand: computeForecastBand(s.past, s.forecast) };
  }
  return s;
}

async function getSeriesRaw(slug: string): Promise<Series> {
  // 1) 환율 — 실데이터 시도
  const fxBase = fxBaseOf(slug);
  if (fxBase) {
    const fx = await getFxSeries(fxBase, DAYS);
    if (fx.live) {
      const past = fx.past.map((p) => ({ date: p.date, value: round(p.value) }));
      const forecast = projectForecast(past, FORECAST_DAYS, slug);
      return {
        slug,
        past,
        forecast,
        source: "live",
        sourceName: fx.source,
        pastIsLive: true, // Frankfurter/Twelve Data는 일별 실 시계열
      };
    }
    const past = fx.past.map((p) => ({ date: p.date, value: round(p.value) }));
    const forecast = projectForecast(past, FORECAST_DAYS, slug);
    return {
      slug,
      past,
      forecast,
      source: "synthetic",
      sourceName: fx.source,
      pastIsLive: false,
    };
  }

  // 2) 휘발유 — 현재가=오피넷(소매), 시계열=KRX 석유(도매 트렌드)를 소매 스케일로 변환
  if (slug === "gas-petrol") {
    const profile = SYN_PROFILES[slug];
    const synPast = buildSynthetic(slug, profile);
    const latest = await getGasLatest("B027");

    // 2-a) KRX 석유 도매 시계열 + 오피넷 현재가 조합 (가장 정합)
    const krxOil = await getKrxOilDaily(365, "휘발유");
    if (krxOil && krxOil.length >= 5 && latest.live) {
      const krxLast = krxOil[krxOil.length - 1].close;
      const ratio = latest.price / krxLast; // 도매→소매 비율
      // KRX 도매 시계열을 소매 스케일로 변환 + 마지막 점만 오피넷 실 현재가
      const scaledKrx: Point[] = krxOil.map((p, i) => ({
        date: p.date,
        value:
          i === krxOil.length - 1
            ? round(latest.price)
            : round(p.close * ratio),
      }));
      // 합성으로 휴장일·갭 채우기
      const scaledSyn = scaleToCurrent(synPast, latest.price);
      const { merged, liveDays } = mergeWithDaily(scaledSyn, scaledKrx);
      const forecast = projectForecast(merged, FORECAST_DAYS, slug, profile.forecastDir, profile.noiseAmp);
      return {
        slug,
        past: merged,
        forecast,
        source: "live",
        sourceName: "opinet+krx-oil",
        pastIsLive: liveDays >= synPast.length,
        liveDays,
      };
    }

    // 2-b) KRX 석유 실패 → 오피넷 현재가 + 합성 + 누적 점진 치환 (이전 동작)
    if (latest.live) {
      await appendDaily(slug, latest.price);
      const daily = await loadDailySeries(slug);
      const scaled = scaleToCurrent(synPast, latest.price);
      const { merged, liveDays } = mergeWithDaily(scaled, daily);
      const forecast = projectForecast(merged, FORECAST_DAYS, slug, profile.forecastDir, profile.noiseAmp);
      return {
        slug,
        past: merged,
        forecast,
        source: "live",
        sourceName: "opinet",
        pastIsLive: liveDays >= synPast.length,
        liveDays,
      };
    }
    const forecast = projectForecast(synPast, FORECAST_DAYS, slug, profile.forecastDir, profile.noiseAmp);
    return { slug, past: synPast, forecast, source: "synthetic", sourceName: "synthetic", pastIsLive: false };
  }

  // 3) 금 — 우선순위: KRX 금시장(한국 시세, 일별 실시계열) → CoinGecko PAXG(국제, 폴백)
  if (slug === "gold-kr") {
    const profile = SYN_PROFILES[slug];

    // 3-a) KRX 금시장 — 진짜 한국 시세 + 일별 시계열
    const krx = await getKrxGoldDaily(365);
    if (krx && krx.length >= 5) {
      const past: Point[] = krx.map((p) => ({ date: p.date, value: round(p.close) }));
      const latest = past[past.length - 1];
      // 365일 다 못 채웠으면(휴장일 + 갓 활성화) 합성으로 앞부분 채움
      const synPast = buildSynthetic(slug, profile);
      const scaled = scaleToCurrent(synPast, latest.value);
      const { merged, liveDays } = mergeWithDaily(scaled, past);
      // 누적 저장은 KRX 일별이 정공법이라 굳이 안 함 (매번 API에서 365일 받음)
      const forecast = projectForecast(merged, FORECAST_DAYS, slug, profile.forecastDir, profile.noiseAmp);
      return {
        slug,
        past: merged,
        forecast,
        source: "live",
        sourceName: "krx-gold",
        pastIsLive: liveDays >= synPast.length,
        liveDays,
      };
    }

    // 3-b) CoinGecko PAXG 폴백 — 국제 시세
    const synPast = buildSynthetic(slug, profile);
    const latest = await getGoldLatest();
    if (latest.live) {
      await appendDaily(slug, latest.pricePerGramKrw);
      const daily = await loadDailySeries(slug);
      const scaled = scaleToCurrent(synPast, latest.pricePerGramKrw);
      const { merged, liveDays } = mergeWithDaily(scaled, daily);
      const forecast = projectForecast(merged, FORECAST_DAYS, slug, profile.forecastDir, profile.noiseAmp);
      return {
        slug,
        past: merged,
        forecast,
        source: "live",
        sourceName: "coingecko-paxg",
        pastIsLive: liveDays >= synPast.length,
        liveDays,
      };
    }
    const forecast = projectForecast(synPast, FORECAST_DAYS, slug, profile.forecastDir, profile.noiseAmp);
    return { slug, past: synPast, forecast, source: "synthetic", sourceName: "synthetic", pastIsLive: false };
  }

  // 4) 나머지 — 결정론적 합성
  const profile = SYN_PROFILES[slug];
  if (!profile) {
    return { slug, past: [], forecast: [], source: "synthetic", sourceName: "synthetic", pastIsLive: false };
  }
  const past = buildSynthetic(slug, profile);
  const forecast = projectForecast(past, FORECAST_DAYS, slug, profile.forecastDir, profile.noiseAmp);
  return { slug, past, forecast, source: "synthetic", sourceName: "synthetic", pastIsLive: false };
}

// 합성 시계열을 실 현재가에 비례 스케일 (마지막 값 = 현재가, 나머지는 비율 유지)
function scaleToCurrent(synPast: Point[], currentValue: number): Point[] {
  const synLast = synPast[synPast.length - 1].value;
  if (!synLast) return synPast;
  const scale = currentValue / synLast;
  return synPast.map((p, i) =>
    i === synPast.length - 1
      ? { date: p.date, value: round(currentValue) }
      : { date: p.date, value: round(p.value * scale) },
  );
}

function buildSynthetic(slug: string, profile: SyntheticProfile): Point[] {
  const rand = seeded(hash(slug));
  const today = new Date();
  const out: Point[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const t = (DAYS - 1 - i) / (DAYS - 1);
    const seasonal = Math.sin((t * Math.PI * 2) + (hash(slug) % 100)) * profile.yearlyAmp;
    const trend = (t - 0.5) * profile.trend;
    const noise = (rand() - 0.5) * 2 * profile.noiseAmp;
    const value = profile.base * (1 + seasonal + trend + noise);
    out.push({ date: ymd(date), value: round(value) });
  }
  return out;
}

// 예측: 단순 평균회귀 대신 다중 기간 가중합 + 잔차 σ 신뢰구간
// 합성 카테고리는 profile.forecastDir이 명시되어 있어 그것 우선 사용.
//
// 입력 시계열의 마지막 N일 추세 3개 (7d, 30d, 90d)를 가중합:
//   - 단기 7d 추세 (관성, 가중치 0.5)
//   - 중기 30d 추세 (반전 압력, 가중치 -0.3)
//   - 장기 90d 평균회귀 (가중치 0.2)
// 잔차 표준편차로 ±1σ 신뢰구간 반환.
function projectForecast(
  past: Point[],
  days: number,
  slug: string,
  forecastDir?: number,
  noiseAmp?: number,
): Point[] {
  if (past.length === 0) return [];
  const last = past[past.length - 1].value;
  const lastDate = new Date(past[past.length - 1].date);
  const rand = seeded(hash(slug + "fc"));
  const noise = noiseAmp ?? 0.01;

  let dailyDrift: number;
  if (forecastDir !== undefined) {
    dailyDrift = forecastDir / days;
  } else {
    dailyDrift = computeBlendedDrift(past);
  }

  const out: Point[] = [];
  for (let i = 1; i <= days; i++) {
    const date = addDays(lastDate, i);
    const value = last * (1 + dailyDrift * i + (rand() - 0.5) * 2 * noise * 0.4);
    out.push({ date: ymd(date), value: round(value), forecast: true });
  }
  return out;
}

// 시계열의 일별 변동성(σ)을 이용해 forecast의 ±1σ 신뢰구간 산출.
// 시간이 지날수록 불확실성 증가 (Brownian-like sqrt(t)).
export function computeForecastBand(past: Point[], forecast: Point[]): {
  upper: number[];
  lower: number[];
} {
  const sigma = computeDailySigma(past);
  const upper: number[] = [];
  const lower: number[] = [];
  forecast.forEach((p, i) => {
    const sigmaT = sigma * Math.sqrt(i + 1);
    upper.push(Math.round(p.value * (1 + sigmaT) * 100) / 100);
    lower.push(Math.round(p.value * (1 - sigmaT) * 100) / 100);
  });
  return { upper, lower };
}

// 일별 수익률의 표준편차 (최근 60일)
function computeDailySigma(past: Point[]): number {
  const n = past.length;
  if (n < 5) return 0.01;
  const window = Math.min(60, n - 1);
  const rets: number[] = [];
  for (let i = n - window; i < n; i++) {
    const prev = past[i - 1]?.value;
    const curr = past[i].value;
    if (prev && curr) rets.push((curr - prev) / prev);
  }
  if (rets.length === 0) return 0.01;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance =
    rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
  return Math.max(0.001, Math.sqrt(variance));
}

// 다중 기간 추세 가중 → 하루당 drift (%)
function computeBlendedDrift(past: Point[]): number {
  const n = past.length;
  const last = past[n - 1].value;
  const trend = (windowDays: number, weight: number): number => {
    if (n <= windowDays) return 0;
    const ref = past[n - 1 - windowDays].value;
    if (!ref) return 0;
    const totalPct = (last - ref) / ref;
    // windowDays에 걸친 % → 하루당 % (선형 분할)
    return (totalPct / windowDays) * weight;
  };
  // 단기 추세 관성(+) + 중기 반전 압력(-) + 장기 평균회귀(-)
  const d7 = trend(7, 0.4);
  const d30 = trend(30, -0.3);
  const d90 = trend(90, -0.1);
  return d7 + d30 + d90;
}

function round(v: number): number {
  if (v >= 10000) return Math.round(v);
  if (v >= 1000) return Math.round(v);
  return Math.round(v * 100) / 100;
}
