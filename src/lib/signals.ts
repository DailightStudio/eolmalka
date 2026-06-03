import type { Point, Series } from "./demo-series";
import {
  quartilesOf,
  verdictFromQuartiles,
  type PriceQuartiles,
  type PriceVerdict,
} from "./quartiles";

export type Signal = "buy" | "wait" | "neutral";

export type SeriesStats = {
  current: number;
  change7d: number;
  change30d: number;
  change365d: number;
  ma30: number;
  signal: Signal;
  signalText: string;
  // dd-trip price.ts 포팅 — 통계 위치(역대급/평균보다 저렴/평균/비쌈)
  quartiles: PriceQuartiles;
  verdict: PriceVerdict;
};

// 신호 산출: quartile verdict + 30d 변동률 조합.
// - quartile이 great_deal이면 일반적으로 buy
// - quartile이 high이고 30d 변동률 상승이면 wait
// - 그 외는 neutral
export function computeStats(series: Series): SeriesStats {
  const past = series.past;
  const n = past.length;
  const current = past[n - 1].value;
  const v7 = past[n - 8]?.value ?? current;
  const v30 = past[n - 31]?.value ?? current;
  const v365 = past[0].value;

  const change7d = pct(current, v7);
  const change30d = pct(current, v30);
  const change365d = pct(current, v365);

  const ma30 =
    past.slice(-30).reduce((sum, p) => sum + p.value, 0) / Math.min(30, n);

  const values = past.map((p) => p.value);
  const quartiles = quartilesOf(values);
  const verdict = verdictFromQuartiles(current, quartiles);

  let signal: Signal = "neutral";
  let signalText = "최근 분포의 평균 범위입니다.";

  if (verdict === "great_deal") {
    signal = "buy";
    signalText = "최근 1년 분포의 하위 25% — 통계적 저점권입니다.";
  } else if (verdict === "good" && change30d <= 0) {
    signal = "buy";
    signalText = "중앙값보다 저렴 + 한 달간 하락 — 매수 기회.";
  } else if (verdict === "high" && change30d >= 1) {
    signal = "wait";
    signalText = "상위 분포 + 한 달간 상승 — 단기 관망.";
  } else if (verdict === "high") {
    signal = "wait";
    signalText = "최근 1년 분포의 상위 구간입니다.";
  } else if (change30d <= -4) {
    signal = "buy";
    signalText = "한 달간 큰 하락 — 단기 매수 기회.";
  } else if (change30d >= 4) {
    signal = "wait";
    signalText = "한 달간 급등 — 단기는 관망.";
  }

  return {
    current,
    change7d: round1(change7d),
    change30d: round1(change30d),
    change365d: round1(change365d),
    ma30: Math.round(ma30 * 100) / 100,
    signal,
    signalText,
    quartiles,
    verdict,
  };
}

function pct(now: number, then: number): number {
  if (!then) return 0;
  return ((now - then) / then) * 100;
}
function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export function forecastChange(series: Series): number {
  const past = series.past;
  const current = past[past.length - 1].value;
  const forecast = series.forecast;
  if (!forecast.length) return 0;
  const avg = forecast.reduce((s, p) => s + p.value, 0) / forecast.length;
  return round1(((avg - current) / current) * 100);
}

// 며칠 뒤 얼마인지 마일스톤(1d/3d/7d/30d) + 가장 싼/비싼 예상일
export type ForecastMilestone = {
  daysAhead: number;
  date: string;
  value: number;
  changePct: number; // 현재 대비 %
};

export type ForecastSummary = {
  current: number;
  milestones: ForecastMilestone[];
  cheapest: ForecastMilestone & { savingAbs: number };
  highest: ForecastMilestone;
};

export function forecastSummary(series: Series): ForecastSummary | null {
  const fc = series.forecast;
  const past = series.past;
  if (!fc.length || !past.length) return null;
  const current = past[past.length - 1].value;

  const wantedDays = [1, 3, 7, 30];
  const milestones: ForecastMilestone[] = wantedDays
    .filter((d) => d <= fc.length)
    .map((d) => {
      const p = fc[d - 1];
      return {
        daysAhead: d,
        date: p.date,
        value: round0(p.value),
        changePct: round1(((p.value - current) / current) * 100),
      };
    });

  let minIdx = 0;
  let maxIdx = 0;
  for (let i = 1; i < fc.length; i++) {
    if (fc[i].value < fc[minIdx].value) minIdx = i;
    if (fc[i].value > fc[maxIdx].value) maxIdx = i;
  }
  const minP = fc[minIdx];
  const maxP = fc[maxIdx];

  return {
    current,
    milestones,
    cheapest: {
      daysAhead: minIdx + 1,
      date: minP.date,
      value: round0(minP.value),
      changePct: round1(((minP.value - current) / current) * 100),
      savingAbs: Math.round(current - minP.value),
    },
    highest: {
      daysAhead: maxIdx + 1,
      date: maxP.date,
      value: round0(maxP.value),
      changePct: round1(((maxP.value - current) / current) * 100),
    },
  };
}

function round0(v: number): number {
  if (v >= 1000) return Math.round(v);
  return Math.round(v * 100) / 100;
}

// 요일별 평균 가격 — 1년치 시계열 활용
// 결과: [{ day: '월', avg: 1376, diffPct: -0.3 }, ...] (전체 평균 대비)
export type DayOfWeekStat = {
  day: string;     // 월/화/수/...
  dayIdx: number;  // 0=일 1=월 ... 6=토 (JS Date getDay)
  avg: number;
  count: number;
  diffPct: number; // 전체 평균 대비 (%)
};

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export function dayOfWeekStats(series: Series): {
  stats: DayOfWeekStat[];
  cheapest: DayOfWeekStat;
  highest: DayOfWeekStat;
} | null {
  const past = series.past;
  if (past.length < 30) return null;
  const buckets: { sum: number; count: number }[] = Array.from(
    { length: 7 },
    () => ({ sum: 0, count: 0 }),
  );
  let totalSum = 0;
  let totalCount = 0;
  for (const p of past) {
    const d = new Date(p.date + "T00:00:00Z").getUTCDay();
    if (Number.isNaN(d)) continue;
    buckets[d].sum += p.value;
    buckets[d].count++;
    totalSum += p.value;
    totalCount++;
  }
  if (totalCount === 0) return null;
  const totalAvg = totalSum / totalCount;
  const stats: DayOfWeekStat[] = buckets
    .map((b, i) => {
      const avg = b.count > 0 ? b.sum / b.count : totalAvg;
      return {
        day: DAY_LABELS[i],
        dayIdx: i,
        avg: round0(avg),
        count: b.count,
        diffPct: round1(((avg - totalAvg) / totalAvg) * 100),
      };
    })
    // 월요일부터 일요일 순으로 (월 첫째 칸이 한국 관습)
    .sort((a, b) => {
      const order = [1, 2, 3, 4, 5, 6, 0]; // 월~일
      return order.indexOf(a.dayIdx) - order.indexOf(b.dayIdx);
    });

  // count>0 인 요일만 비교 (휴장일 영향)
  const valid = stats.filter((s) => s.count > 0);
  const cheapest = valid.reduce((a, b) => (b.avg < a.avg ? b : a));
  const highest = valid.reduce((a, b) => (b.avg > a.avg ? b : a));

  return { stats, cheapest, highest };
}

// RN 호환 색상 (rgba bg, hex border/stroke)
export const SIGNAL_STYLE: Record<
  Signal,
  { bg: string; border: string; stroke: string; label: string }
> = {
  buy: {
    bg: "rgba(132, 204, 22, 0.10)",
    border: "rgba(132, 204, 22, 0.40)",
    stroke: "#a3e635",
    label: "지금 사세요",
  },
  wait: {
    bg: "rgba(244, 63, 94, 0.10)",
    border: "rgba(244, 63, 94, 0.40)",
    stroke: "#fb7185",
    label: "기다리세요",
  },
  neutral: {
    bg: "rgba(113, 113, 122, 0.10)",
    border: "rgba(113, 113, 122, 0.40)",
    stroke: "#a1a1aa",
    label: "보통",
  },
};

export type CategoryMeta = {
  name: string;
  subtitle: string;
  unit: string;
  emoji: string;
};

export const CATEGORY_META: Record<string, CategoryMeta> = {
  "fx-usd":     { name: "원/달러 환율", subtitle: "USD/KRW",              unit: "원",    emoji: "💵" },
  "fx-jpy":     { name: "원/엔 환율",   subtitle: "JPY/KRW (100엔)",     unit: "원",    emoji: "💴" },
  "fx-eur":     { name: "원/유로 환율", subtitle: "EUR/KRW",              unit: "원",    emoji: "💶" },
  "fx-cny":     { name: "원/위안 환율", subtitle: "CNY/KRW",              unit: "원",    emoji: "💴" },
  "gas-petrol": { name: "휘발유",       subtitle: "전국 평균 (오피넷 소매 + KRX 도매 시계열)", unit: "원/L",  emoji: "⛽" },
  "gold-kr":    { name: "금 시세",      subtitle: "KRX 99.99K 1g (한국 시세)", unit: "원/g",  emoji: "🪙" },
  "air-nrt":    { name: "도쿄 항공권",  subtitle: "ICN→NRT 왕복 최저가",  unit: "원",    emoji: "✈️" },
  "air-tpe":    { name: "타이베이 항공권", subtitle: "ICN→TPE 왕복 최저가", unit: "원",  emoji: "✈️" },
};

export const CATEGORY_SLUGS = Object.keys(CATEGORY_META);

// 사용자가 추가 가능한 추가 통화 — Frankfurter가 지원 + 한국인에게 친숙한 순.
// 시스템 기본(USD/JPY/EUR/CNY)은 제외.
export const ADDABLE_CURRENCIES: Array<{
  code: string;
  korean: string;
  emoji: string;
}> = [
  { code: "GBP", korean: "파운드", emoji: "💷" },
  { code: "AUD", korean: "호주달러", emoji: "💵" },
  { code: "NZD", korean: "뉴질랜드달러", emoji: "💵" },
  { code: "CAD", korean: "캐나다달러", emoji: "💵" },
  { code: "CHF", korean: "스위스프랑", emoji: "💵" },
  { code: "HKD", korean: "홍콩달러", emoji: "💵" },
  { code: "SGD", korean: "싱가포르달러", emoji: "💵" },
  { code: "THB", korean: "태국바트", emoji: "💵" },
  { code: "VND", korean: "베트남동", emoji: "💵" },
  { code: "INR", korean: "인도루피", emoji: "💵" },
  { code: "TRY", korean: "터키리라", emoji: "💵" },
  { code: "MXN", korean: "멕시코페소", emoji: "💵" },
  { code: "PHP", korean: "필리핀페소", emoji: "💵" },
];

const CURRENCY_LOOKUP = new Map(
  ADDABLE_CURRENCIES.map((c) => [c.code, c]),
);

// 사용자 정의 fx-XYZ 슬러그에 대한 메타 동적 생성
export function metaFor(slug: string): CategoryMeta | undefined {
  if (CATEGORY_META[slug]) return CATEGORY_META[slug];
  const m = slug.match(/^fx-([a-z]{3})$/);
  if (m) {
    const code = m[1].toUpperCase();
    const info = CURRENCY_LOOKUP.get(code);
    if (info) {
      return {
        name: `원/${info.korean} 환율`,
        subtitle: `${code}/KRW`,
        unit: "원",
        emoji: info.emoji,
      };
    }
  }
  return undefined;
}

export function allSlugs(userCurrencies: string[]): string[] {
  const user = userCurrencies.map((c) => `fx-${c.toLowerCase()}`);
  // 시스템 슬러그 다음에 사용자 정의
  return [...CATEGORY_SLUGS, ...user];
}
