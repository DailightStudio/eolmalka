// 카테고리별 1년치 일별 시계열 + 30일 예측.
// 환율 2개(fx-usd / fx-jpy)는 fx-provider를 통해 실데이터(Frankfurter 무키)를 시도하고,
// 실패 시 합성으로 폴백 — `live`=true면 실데이터.
// 나머지 카테고리(주유·금·항공권)는 결정론적 더미 시계열.

import { getFxSeries, type FxBase, type FxSource } from "./fx-provider";

export type Point = {
  date: string;
  value: number;
  forecast?: boolean;
};

export type Series = {
  slug: string;
  past: Point[];
  forecast: Point[];
  // 데이터 출처/상태(상세 페이지의 정직한 표기용)
  source: "live" | "synthetic";
  sourceName: FxSource | "synthetic";
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

// 환율 카테고리 → Frankfurter base 통화 매핑
const FX_BASE: Record<string, FxBase> = {
  "fx-usd": "USD",
  "fx-jpy": "JPY",
};

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
  // 1) 환율 — 실데이터 시도
  const fxBase = FX_BASE[slug];
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
      };
    }
    // 실데이터 실패 → 합성도 fx-provider가 만들어 줬으니 그대로 사용
    const past = fx.past.map((p) => ({ date: p.date, value: round(p.value) }));
    const forecast = projectForecast(past, FORECAST_DAYS, slug);
    return {
      slug,
      past,
      forecast,
      source: "synthetic",
      sourceName: fx.source,
    };
  }

  // 2) 나머지 — 결정론적 합성
  const profile = SYN_PROFILES[slug];
  if (!profile) {
    return { slug, past: [], forecast: [], source: "synthetic", sourceName: "synthetic" };
  }

  const rand = seeded(hash(slug));
  const today = new Date();
  const past: Point[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const t = (DAYS - 1 - i) / (DAYS - 1);
    const seasonal = Math.sin((t * Math.PI * 2) + (hash(slug) % 100)) * profile.yearlyAmp;
    const trend = (t - 0.5) * profile.trend;
    const noise = (rand() - 0.5) * 2 * profile.noiseAmp;
    const value = profile.base * (1 + seasonal + trend + noise);
    past.push({ date: ymd(date), value: round(value) });
  }
  const forecast = projectForecast(past, FORECAST_DAYS, slug, profile.forecastDir, profile.noiseAmp);
  return { slug, past, forecast, source: "synthetic", sourceName: "synthetic" };
}

// 예측: 환율은 단순 외삽(최근 30일 추세 + 평균회귀), 합성은 profile.forecastDir 사용
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

  // 환율: 최근 30일 변화율을 평균회귀로 절반 정도 되돌려 예측
  let drift = forecastDir;
  if (drift === undefined) {
    const ref = past[Math.max(0, past.length - 31)].value;
    const recentPct = (last - ref) / ref;
    drift = -recentPct * 0.4; // 절반 정도 평균회귀
  }

  const out: Point[] = [];
  for (let i = 1; i <= days; i++) {
    const date = addDays(lastDate, i);
    const t = i / days;
    const value = last * (1 + drift * t + (rand() - 0.5) * 2 * noise * 0.5);
    out.push({ date: ymd(date), value: round(value), forecast: true });
  }
  return out;
}

function round(v: number): number {
  if (v >= 10000) return Math.round(v);
  if (v >= 1000) return Math.round(v);
  return Math.round(v * 100) / 100;
}
