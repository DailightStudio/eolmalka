// 카테고리별 1년치 일별 시계열 + 30일 예측.
// 환율 2개(fx-usd / fx-jpy)는 fx-provider를 통해 실데이터(Frankfurter 무키)를 시도하고,
// 실패 시 합성으로 폴백 — `live`=true면 실데이터.
// 나머지 카테고리(주유·금·항공권)는 결정론적 더미 시계열.

import { getFxSeries, type FxBase, type FxSource } from "./fx-provider";
import { getGasLatest } from "./gas-provider";
import { getGoldLatest } from "./gold-provider";
import { getKrxGoldDaily } from "./krx-gold-provider";
import { getKrxOilDaily } from "./krx-oil-provider";
import { backfillChunk } from "./opinet-daily-provider";
import { appendDaily, loadDailySeries, mergeWithDaily } from "./series-store";
import { getAirFare } from "./air-provider";

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
    | "travelpayouts"
    | "synthetic";
  pastIsLive: boolean;
  liveDays?: number;
  // 현재가(또는 시계열)를 마지막으로 실데이터에서 받은 시각(ms).
  // 오프라인 캐시 fallback이면 캐시 기록 시각 — UI 신선도 표시에 사용.
  fetchedAt?: number;
};

// ── 결정론적 의사난수 (시드 기반, 빌드마다 동일 곡선) ─────
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

// Box-Muller: 균등 난수 2개 → 표준정규 N(0,1).
// projectForecast 노이즈를 정규분포로 통일해 backtestForecast의
// ±1σ 신뢰구간 커버리지 계산(정규분포 가정)과 일관성 확보.
function normalRand(rand: () => number): number {
  const u1 = Math.max(1e-10, rand()); // ln(0) 방지
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
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
  "gas-diesel": { base: 1532,  yearlyAmp: 0.07, noiseAmp: 0.004, trend: 0.00, forecastDir: 0.002 },
  "gas-lpg":    { base: 1100,  yearlyAmp: 0.05, noiseAmp: 0.005, trend: 0.00, forecastDir: 0.001 },
  "gold-kr":    { base: 125400, yearlyAmp: 0.08, noiseAmp: 0.006, trend: 0.15, forecastDir: 0.02 },
  // 항공권 base: ICN 출발 왕복 1주체류 시세 (Travelpayouts week-matrix, 2026-06 보정). cts·gum은 표본 희박으로 인접노선 비례 추정. 라이브 실패 시 합성 폴백 기준선.
  "air-nrt":    { base: 330000, yearlyAmp: 0.18, noiseAmp: 0.025, trend: 0.00, forecastDir: -0.04 },
  "air-tpe":    { base: 310000, yearlyAmp: 0.20, noiseAmp: 0.030, trend: 0.02, forecastDir:  0.06 },
  "air-kix":    { base: 240000, yearlyAmp: 0.17, noiseAmp: 0.025, trend: 0.00, forecastDir: -0.03 },
  "air-fuk":    { base: 240000, yearlyAmp: 0.17, noiseAmp: 0.025, trend: 0.00, forecastDir:  0.02 },
  "air-cts":    { base: 380000, yearlyAmp: 0.22, noiseAmp: 0.030, trend: 0.00, forecastDir: -0.05 },
  "air-bkk":    { base: 490000, yearlyAmp: 0.15, noiseAmp: 0.028, trend: 0.01, forecastDir:  0.03 },
  "air-sin":    { base: 440000, yearlyAmp: 0.13, noiseAmp: 0.025, trend: 0.01, forecastDir:  0.04 },
  "air-hkg":    { base: 340000, yearlyAmp: 0.16, noiseAmp: 0.028, trend: 0.00, forecastDir:  0.02 },
  "air-dps":    { base: 740000, yearlyAmp: 0.18, noiseAmp: 0.032, trend: 0.02, forecastDir:  0.05 },
  "air-cdg":    { base: 1080000, yearlyAmp: 0.12, noiseAmp: 0.020, trend: 0.01, forecastDir:  0.02 },
  "air-lax":    { base: 1450000, yearlyAmp: 0.11, noiseAmp: 0.018, trend: 0.01, forecastDir:  0.01 },
  "air-oka":    { base: 470000, yearlyAmp: 0.20, noiseAmp: 0.028, trend: 0.00, forecastDir: -0.02 },
  "air-kul":    { base: 395000, yearlyAmp: 0.14, noiseAmp: 0.026, trend: 0.01, forecastDir:  0.03 },
  "air-sgn":    { base: 480000, yearlyAmp: 0.15, noiseAmp: 0.027, trend: 0.01, forecastDir:  0.03 },
  "air-han":    { base: 420000, yearlyAmp: 0.15, noiseAmp: 0.027, trend: 0.01, forecastDir:  0.02 },
  "air-dad":    { base: 430000, yearlyAmp: 0.16, noiseAmp: 0.028, trend: 0.01, forecastDir:  0.02 },
  "air-mnl":    { base: 410000, yearlyAmp: 0.14, noiseAmp: 0.026, trend: 0.01, forecastDir:  0.03 },
  "air-cgk":    { base: 545000, yearlyAmp: 0.13, noiseAmp: 0.025, trend: 0.01, forecastDir:  0.03 },
  "air-pek":    { base: 420000, yearlyAmp: 0.12, noiseAmp: 0.022, trend: 0.00, forecastDir:  0.01 },
  "air-pvg":    { base: 445000, yearlyAmp: 0.12, noiseAmp: 0.022, trend: 0.00, forecastDir:  0.01 },
  "air-lhr":    { base: 1260000, yearlyAmp: 0.10, noiseAmp: 0.018, trend: 0.01, forecastDir:  0.02 },
  "air-syd":    { base: 960000, yearlyAmp: 0.11, noiseAmp: 0.019, trend: 0.01, forecastDir:  0.02 },
  "air-dxb":    { base: 860000, yearlyAmp: 0.10, noiseAmp: 0.018, trend: 0.01, forecastDir:  0.02 },
  "air-gum":    { base: 650000, yearlyAmp: 0.18, noiseAmp: 0.028, trend: 0.00, forecastDir: -0.02 },
  "air-jfk":    { base: 1300000, yearlyAmp: 0.09, noiseAmp: 0.016, trend: 0.01, forecastDir:  0.01 },
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
        fetchedAt: fx.fetchedAt,
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
      // 오프라인 캐시 fallback(source=frankfurter/twelvedata지만 live=false)이면 캐시 시각.
      fetchedAt: fx.fetchedAt,
    };
  }

  // 2) 휘발유 — 현재가=오피넷(소매), 시계열=KRX 석유(도매 트렌드)를 소매 스케일로 변환
  if (slug === "gas-petrol") {
    const profile = SYN_PROFILES[slug];
    const synPast = buildSynthetic(slug, profile);
    const latest = await getGasLatest("B027");
    // fire-and-forget: 매 진입마다 오피넷 일별가 30일치 백필 (resumable).
    // 휘발유 분기에서만 호출 → 다른 카테고리 진입 시엔 트리거 안 됨.
    void backfillChunk("gas-petrol", "B027").catch((e) =>
      console.warn("[opinet backfill]", e),
    );

    // 2-a) KRX 석유 도매 시계열 + 오피넷 현재가 조합 (가장 정합)
    const krxOil = await getKrxOilDaily(365, "휘발유");
    if (krxOil && krxOil.length >= 5 && latest.live) {
      // 도매가는 거래량 낮은 날 ±2~4% 튀어오르므로 7일 이동평균으로 스무딩.
      // 트렌드는 보존하면서 sparkline의 거친 막대 패턴 제거.
      const smoothedCloses = movingAverage(krxOil.map((p) => p.close), 7);
      const krxLast = smoothedCloses[smoothedCloses.length - 1];
      const ratio = latest.price / krxLast; // 도매→소매 비율
      const scaledKrx: Point[] = krxOil.map((p, i) => ({
        date: p.date,
        value:
          i === krxOil.length - 1
            ? round(latest.price)
            : round(smoothedCloses[i] * ratio),
      }));
      // 합성으로 휴장일·갭 채우기
      const scaledSyn = scaleToCurrent(synPast, latest.price);
      const { merged: mergedRaw, liveDays } = mergeWithDaily(scaledSyn, scaledKrx);
      const merged = smoothPoints(mergedRaw, 7);
      const forecast = projectForecast(merged, FORECAST_DAYS, slug, profile.forecastDir, profile.noiseAmp);
      return {
        slug,
        past: merged,
        forecast,
        source: "live",
        sourceName: "opinet+krx-oil",
        pastIsLive: liveDays >= synPast.length,
        liveDays,
        fetchedAt: latest.fetchedAt,
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
        fetchedAt: latest.fetchedAt,
      };
    }
    const forecast = projectForecast(synPast, FORECAST_DAYS, slug, profile.forecastDir, profile.noiseAmp);
    return { slug, past: synPast, forecast, source: "synthetic", sourceName: "synthetic", pastIsLive: false };
  }

  // 2') 경유 — gas-petrol과 동일 로직, D047 + KRX 경유 시계열
  if (slug === "gas-diesel") {
    const profile = SYN_PROFILES[slug];
    const synPast = buildSynthetic(slug, profile);
    const latest = await getGasLatest("D047");
    void backfillChunk("gas-diesel", "D047").catch((e) =>
      console.warn("[opinet backfill]", e),
    );
    const krxOil = await getKrxOilDaily(365, "경유");
    if (krxOil && krxOil.length >= 5 && latest.live) {
      const smoothedCloses = movingAverage(krxOil.map((p) => p.close), 7);
      const krxLast = smoothedCloses[smoothedCloses.length - 1];
      const ratio = latest.price / krxLast;
      const scaledKrx: Point[] = krxOil.map((p, i) => ({
        date: p.date,
        value:
          i === krxOil.length - 1
            ? round(latest.price)
            : round(smoothedCloses[i] * ratio),
      }));
      const scaledSyn = scaleToCurrent(synPast, latest.price);
      const { merged: mergedRaw, liveDays } = mergeWithDaily(scaledSyn, scaledKrx);
      const merged = smoothPoints(mergedRaw, 7);
      const forecast = projectForecast(merged, FORECAST_DAYS, slug, profile.forecastDir, profile.noiseAmp);
      return { slug, past: merged, forecast, source: "live", sourceName: "opinet+krx-oil", pastIsLive: liveDays >= synPast.length, liveDays, fetchedAt: latest.fetchedAt };
    }
    if (latest.live) {
      await appendDaily(slug, latest.price);
      const daily = await loadDailySeries(slug);
      const scaled = scaleToCurrent(synPast, latest.price);
      const { merged, liveDays } = mergeWithDaily(scaled, daily);
      const forecast = projectForecast(merged, FORECAST_DAYS, slug, profile.forecastDir, profile.noiseAmp);
      return { slug, past: merged, forecast, source: "live", sourceName: "opinet", pastIsLive: liveDays >= synPast.length, liveDays, fetchedAt: latest.fetchedAt };
    }
    const forecast = projectForecast(synPast, FORECAST_DAYS, slug, profile.forecastDir, profile.noiseAmp);
    return { slug, past: synPast, forecast, source: "synthetic", sourceName: "synthetic", pastIsLive: false };
  }

  // 2'') LPG — KRX 미지원, 오피넷 일별 백필 누적 (gas-petrol 2-b 방식과 동일)
  if (slug === "gas-lpg") {
    const profile = SYN_PROFILES[slug];
    const synPast = buildSynthetic(slug, profile);
    const latest = await getGasLatest("C004");
    void backfillChunk("gas-lpg", "C004").catch((e) =>
      console.warn("[opinet backfill]", e),
    );
    if (latest.live) {
      await appendDaily(slug, latest.price);
      const daily = await loadDailySeries(slug);
      const scaled = scaleToCurrent(synPast, latest.price);
      const { merged, liveDays } = mergeWithDaily(scaled, daily);
      const forecast = projectForecast(merged, FORECAST_DAYS, slug, profile.forecastDir, profile.noiseAmp);
      return { slug, past: merged, forecast, source: "live", sourceName: "opinet", pastIsLive: liveDays >= synPast.length, liveDays, fetchedAt: latest.fetchedAt };
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
      // 일별 ±2~3% 변동이 sparkline 365 포인트에서 막대처럼 보이므로 MA7 스무딩.
      // 단, 마지막 점은 실 종가 그대로 — 표시 현재가가 MA로 흐려지지 않게.
      const smoothed = movingAverage(krx.map((p) => p.close), 7);
      const lastIdx = krx.length - 1;
      const rawPast: Point[] = krx.map((p, i) => ({
        date: p.date,
        value: round(i === lastIdx ? p.close : smoothed[i]),
      }));
      const past = smoothPoints(rawPast, 7);
      // 합성 메꿈 제거: KRX 영업일만으로 충분. 휴장일은 sparkline에서 X축이 등간격이라
      // 시각적으로 차이 없음. pastIsLive=true가 라벨도 정확.
      const forecast = projectForecast(past, FORECAST_DAYS, slug, profile.forecastDir, profile.noiseAmp);
      return {
        slug,
        past,
        forecast,
        source: "live",
        sourceName: "krx-gold",
        pastIsLive: true,
        liveDays: krx.length,
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
        fetchedAt: latest.fetchedAt,
      };
    }
    const forecast = projectForecast(synPast, FORECAST_DAYS, slug, profile.forecastDir, profile.noiseAmp);
    return { slug, past: synPast, forecast, source: "synthetic", sourceName: "synthetic", pastIsLive: false };
  }

  // 4) 항공권 — Travelpayouts 현재가 + 합성 히스토리 스케일
  if (slug.startsWith("air-")) {
    const profile = SYN_PROFILES[slug];
    if (!profile) {
      return { slug, past: [], forecast: [], source: "synthetic", sourceName: "synthetic", pastIsLive: false };
    }
    const synPast = buildSynthetic(slug, profile);
    const latest = await getAirFare(slug);
    if (latest.live) {
      await appendDaily(slug, latest.price);
      const daily = await loadDailySeries(slug);
      const scaled = scaleToCurrent(synPast, latest.price);
      const { merged, liveDays } = mergeWithDaily(scaled, daily);
      // forecastDir 없이 blended drift + 계절성 조정 사용 (실 가격 기반)
      const forecast = projectForecast(merged, FORECAST_DAYS, slug);
      return {
        slug,
        past: merged,
        forecast,
        source: "live",
        sourceName: "travelpayouts",
        pastIsLive: liveDays >= synPast.length,
        liveDays,
        fetchedAt: latest.fetchedAt,
      };
    }
    // 라이브 실패: 캐시된 실가격(있으면)·없으면 base로 끝점 고정 → 라이브↔폴백 표시가 연속(계절오프셋 점프 제거)
    const anchor = latest.price > 0 ? latest.price : profile.base;
    const anchored = scaleToCurrent(synPast, anchor);
    const forecast = projectForecast(anchored, FORECAST_DAYS, slug, profile.forecastDir, profile.noiseAmp);
    return { slug, past: anchored, forecast, source: "synthetic", sourceName: "synthetic", pastIsLive: false, fetchedAt: latest.fetchedAt };
  }

  // 5) 나머지 — 결정론적 합성
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
    dailyDrift = computeBlendedDrift(past, slug);
  }

  // 항공권 계절성 — 작년 동월 평균 ratio + 휴가시즌 부스트.
  // 단, 합성 카테고리(forecastDir 명시)는 buildSynthetic이 이미 sin 계절성을 머금음 →
  // 이중 증폭 방지 위해 실 시계열에만 적용.
  const seasonal =
    slug.startsWith("air-") && forecastDir === undefined
      ? buildSeasonalAdjuster(past)
      : null;

  const out: Point[] = [];
  for (let i = 1; i <= days; i++) {
    const date = addDays(lastDate, i);
    let value = last * (1 + dailyDrift * i + normalRand(rand) * noise * 0.4);
    if (seasonal) value *= seasonal(date);
    out.push({ date: ymd(date), value: round(value), forecast: true });
  }
  return out;
}

// 작년 동월(±15일) 평균 / 전체 평균 = monthly ratio.
// 거기에 휴가시즌 부스트(7-8월 +3%, 12-1월 +2%) 가산.
// 반환: 날짜를 받아 가격 배수를 돌려주는 함수.
function buildSeasonalAdjuster(past: Point[]): (d: Date) => number {
  const overall = past.reduce((s, p) => s + p.value, 0) / past.length;
  const buckets: { sum: number; count: number }[] = Array.from(
    { length: 12 },
    () => ({ sum: 0, count: 0 }),
  );
  for (const p of past) {
    const d = new Date(p.date + "T00:00:00Z");
    const m = d.getUTCMonth();
    if (!Number.isNaN(m)) {
      buckets[m].sum += p.value;
      buckets[m].count++;
    }
  }
  const monthlyRatio = buckets.map((b) =>
    b.count > 0 ? b.sum / b.count / overall : 1,
  );
  const HOLIDAY_BOOST: Record<number, number> = {
    6: 1.03, 7: 1.03,           // 7-8월 (UTC 0-base: 6,7)
    11: 1.02, 0: 1.02,          // 12-1월
  };
  return (d: Date) => {
    const m = d.getUTCMonth();
    const ratio = monthlyRatio[m] ?? 1;
    const boost = HOLIDAY_BOOST[m] ?? 1;
    return ratio * boost;
  };
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

// ── 백테스트 ──────────────────────────────────────────
// 과거 시계열의 마지막 holdoutDays 일을 holdout으로 두고, 그 직전까지로 예측 → 실제값과 비교.
// 합성·forecastDir 우선 카테고리는 자기예언이 되므로 의미 없음 (실 시계열 슬러그에만 의미).
export type BacktestResult = {
  mape: number;        // 평균 절대 비율 오차 (%) — 작을수록 좋음
  rmse: number;        // 평균 제곱근 오차 (원 단위)
  coverage: number;    // ±1σ 신뢰구간 안에 실제값이 들어간 비율 (0~1)
  n: number;           // 비교한 일수
};
export function backtestForecast(
  past: Point[],
  slug: string,
  holdoutDays = 30,
): BacktestResult | null {
  if (past.length < holdoutDays + 60) return null;
  const train = past.slice(0, past.length - holdoutDays);
  const actual = past.slice(past.length - holdoutDays);
  // 백테스트는 모델 검증 — forecastDir(합성 카테고리)이 아니라 blended drift 사용
  const predicted = projectForecast(train, holdoutDays, slug);
  const band = computeForecastBand(train, predicted);
  let mapeSum = 0;
  let rmseSum = 0;
  let inBand = 0;
  let n = 0;
  for (let i = 0; i < actual.length && i < predicted.length; i++) {
    const a = actual[i].value;
    const p = predicted[i].value;
    if (!a) continue;
    mapeSum += Math.abs((p - a) / a);
    rmseSum += (p - a) ** 2;
    if (a >= band.lower[i] && a <= band.upper[i]) inBand++;
    n++;
  }
  if (n === 0) return null;
  return {
    mape: Math.round((mapeSum / n) * 10000) / 100,
    rmse: Math.round(Math.sqrt(rmseSum / n) * 100) / 100,
    coverage: Math.round((inBand / n) * 1000) / 1000,
    n,
  };
}

// 일별 수익률의 표준편차.
// 최근 60일(60%) + 전체 히스토리(40%) 혼합: 조용한 구간에서 σ 과소추정 방지.
function computeDailySigma(past: Point[]): number {
  const n = past.length;
  if (n < 5) return 0.01;

  const sigmaForWindow = (windowSize: number): number => {
    const w = Math.min(windowSize, n - 1);
    const rets: number[] = [];
    for (let i = n - w; i < n; i++) {
      const prev = past[i - 1]?.value;
      const curr = past[i].value;
      if (prev && curr) rets.push((curr - prev) / prev);
    }
    if (rets.length === 0) return 0.01;
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
    return Math.max(0.001, Math.sqrt(variance));
  };

  const recent = sigmaForWindow(60);
  if (n <= 90) return recent;
  const historical = sigmaForWindow(n);
  return recent * 0.6 + historical * 0.4;
}

// 카테고리별 예측 가중 (7d / 30d / 90d 추세에 곱할 weight).
// 양수=관성, 음수=반전(평균회귀) 압력. 정확성 향상을 위해 도메인별로 분리.
// - 환율: 중앙은행 정책으로 30d 반전 강함, 평균회귀 성격
// - 금: 인플레 헤지 → 장기 모멘텀, 7d 관성
// - 휘발유: 정책·OPEC 충격 → 단기 모멘텀 약함, 평균회귀 우세
// - 항공권: 계절성 + 시즌 트렌드 → 장기 추세 따라감
type DriftWeights = { w7: number; w30: number; w90: number };
const DEFAULT_WEIGHTS: DriftWeights = { w7: 0.4, w30: -0.3, w90: -0.1 };
const CATEGORY_WEIGHTS: Array<{ match: (slug: string) => boolean; w: DriftWeights }> = [
  { match: (s) => s.startsWith("fx-"),    w: { w7: 0.3, w30: -0.4, w90: -0.1 } },
  { match: (s) => s.startsWith("gold"),   w: { w7: 0.5, w30: -0.1, w90:  0.1 } },
  { match: (s) => s.startsWith("gas-"),   w: { w7: 0.2, w30: -0.2, w90: -0.2 } },
  { match: (s) => s.startsWith("air-"),   w: { w7: 0.1, w30:  0.1, w90:  0.3 } },
];

function weightsFor(slug: string): DriftWeights {
  for (const { match, w } of CATEGORY_WEIGHTS) {
    if (match(slug)) return w;
  }
  return DEFAULT_WEIGHTS;
}

// 다중 기간 추세 가중 → 하루당 drift (%)
// + 장기 평균회귀: 현재가가 MA365 대비 멀수록 되돌아오는 힘을 약하게 가산.
function computeBlendedDrift(past: Point[], slug: string): number {
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
  const { w7, w30, w90 } = weightsFor(slug);
  let drift = trend(7, w7) + trend(30, w30) + trend(90, w90);

  // 평균회귀: 이탈률 × 0.015 만큼 하루당 되돌림.
  // 예) MA365 대비 +5% → 매일 -0.075% 회귀력. 극단 예측 누적 방지.
  if (n >= 90) {
    const lookback = Math.min(365, n);
    const ma = past.slice(-lookback).reduce((s, p) => s + p.value, 0) / lookback;
    const deviation = (last - ma) / ma;
    drift -= deviation * 0.015;
  }

  return drift;
}

function round(v: number): number {
  if (v >= 10000) return Math.round(v);
  if (v >= 1000) return Math.round(v);
  return Math.round(v * 100) / 100;
}

// merge 후 전체 시계열 스무딩 (마지막 점=실 현재가 보존)
function smoothPoints(points: Point[], window = 7): Point[] {
  if (points.length <= window) return points;
  const smoothed = movingAverage(points.map((p) => p.value), window);
  return points.map((p, i) =>
    i === points.length - 1 ? p : { ...p, value: round(smoothed[i]) },
  );
}

// 중심 이동평균 (window=홀수 권장). 양쪽 가장자리는 가능한 만큼 부분 평균.
function movingAverage(values: number[], window: number): number[] {
  const n = values.length;
  if (n === 0 || window <= 1) return values.slice();
  const half = Math.floor(window / 2);
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - half);
    const hi = Math.min(n, i + half + 1);
    let sum = 0;
    for (let j = lo; j < hi; j++) sum += values[j];
    out[i] = sum / (hi - lo);
  }
  return out;
}
