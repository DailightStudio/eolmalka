// 카테고리별 1년치 일별 시세 + 30일 예측 더미.
// 실데이터 API 연결 전까지 사용. 시드 기반이라 빌드마다 동일.

export type Point = {
  // YYYY-MM-DD
  date: string;
  value: number;
  // true면 예측 구간(파선 표시용)
  forecast?: boolean;
};

export type Series = {
  slug: string;
  past: Point[];      // 과거 1년 (오늘 포함)
  forecast: Point[];  // +30일 예측
};

// 결정론적 의사난수 — 빌드마다 같은 곡선
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

type Profile = {
  base: number;
  // 연간 진폭(±%)
  yearlyAmp: number;
  // 단기 노이즈 진폭(±%)
  noiseAmp: number;
  // 추세(연간 +%/-%)
  trend: number;
  // 예측 방향(+: 더 비싸짐 / -: 더 싸짐)
  forecastDir: number;
};

const PROFILES: Record<string, Profile> = {
  "fx-usd":     { base: 1376, yearlyAmp: 0.04, noiseAmp: 0.008, trend: 0.01,  forecastDir: -0.012 },
  "fx-jpy":    { base: 894,  yearlyAmp: 0.05, noiseAmp: 0.010, trend: -0.02, forecastDir: 0.015 },
  "gas-petrol": { base: 1652, yearlyAmp: 0.06, noiseAmp: 0.004, trend: 0.00,  forecastDir: 0.003 },
  "gold-kr":    { base: 125400, yearlyAmp: 0.08, noiseAmp: 0.006, trend: 0.15, forecastDir: 0.02 },
  "air-nrt":    { base: 220000, yearlyAmp: 0.18, noiseAmp: 0.025, trend: 0.00, forecastDir: -0.04 },
  "air-tpe":    { base: 300000, yearlyAmp: 0.20, noiseAmp: 0.030, trend: 0.02, forecastDir: 0.06 },
};

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const TODAY = new Date("2026-06-02"); // 빌드 결정성 + 메모리의 currentDate와 정렬

export function getSeries(slug: string): Series {
  const profile = PROFILES[slug];
  if (!profile) return { slug, past: [], forecast: [] };

  const rand = seeded(hash(slug));
  const days = 365;

  const past: Point[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(TODAY, -i);
    const t = (days - 1 - i) / (days - 1); // 0..1
    const seasonal = Math.sin((t * Math.PI * 2) + hash(slug) % 100) * profile.yearlyAmp;
    const trend = (t - 0.5) * profile.trend; // 0 → trend
    const noise = (rand() - 0.5) * 2 * profile.noiseAmp;
    const value = profile.base * (1 + seasonal + trend + noise);
    past.push({ date: ymd(date), value: round(value, profile.base) });
  }

  // 예측 30일 — 마지막 가격에서 출발해 forecastDir 방향으로 천천히
  const last = past[past.length - 1].value;
  const forecast: Point[] = [];
  for (let i = 1; i <= 30; i++) {
    const date = addDays(TODAY, i);
    const t = i / 30;
    const drift = profile.forecastDir * t;
    const noise = (rand() - 0.5) * 2 * profile.noiseAmp * 0.6;
    const value = last * (1 + drift + noise);
    forecast.push({ date: ymd(date), value: round(value, profile.base), forecast: true });
  }

  return { slug, past, forecast };
}

function round(v: number, base: number): number {
  // 단위가 큰 자산은 정수, 작은 자산은 소수 한 자리
  if (base >= 10000) return Math.round(v);
  if (base >= 1000) return Math.round(v);
  return Math.round(v * 10) / 10;
}
