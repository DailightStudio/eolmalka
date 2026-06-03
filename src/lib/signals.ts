import type { Point, Series } from "./demo-series";
import type { UpcomingEvent } from "./macro-events";
import type { SignalMode } from "./storage";
import {
  quartilesOf,
  verdictFromQuartiles,
  type PriceQuartiles,
  type PriceVerdict,
} from "./quartiles";

// 신호 임계치 — mode에 따라 buy/wait 조건 강화/완화.
// conservative: buy 조건 엄격, wait 조건 느슨 (덜 사고 더 기다림)
// aggressive: buy 조건 느슨, wait 조건 엄격 (더 자주 사세요)
type SignalThresholds = {
  buyDropPct: number;   // change30d <= -X% 단독 buy 트리거 (great_deal 별도)
  waitRisePct: number;  // change30d >= X% 단독 wait 트리거
  highRisePct: number;  // verdict=high + change30d>=X% 일 때 강화
};
const THRESHOLDS: Record<SignalMode, SignalThresholds> = {
  conservative: { buyDropPct: -6, waitRisePct: 3, highRisePct: 0.5 },
  default:      { buyDropPct: -4, waitRisePct: 4, highRisePct: 1 },
  aggressive:   { buyDropPct: -2.5, waitRisePct: 6, highRisePct: 2 },
};

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

// 신호 산출: quartile verdict + 30d 변동률 조합. mode로 임계치 조정.
export function computeStats(series: Series, mode: SignalMode = "default"): SeriesStats {
  const past = series.past;
  const n = past.length;
  const current = past[n - 1].value;
  const v7 = past[n - 8]?.value ?? current;
  const v30 = past[n - 31]?.value ?? current;
  const v365 = past[0].value;

  // 30일·7일 미만이면 change 계산은 하되 신호 판정에서 제외
  const hasEnough30d = n >= 31;
  const hasEnough7d = n >= 8;

  const change7d = hasEnough7d ? pct(current, v7) : 0;
  const change30d = hasEnough30d ? pct(current, v30) : 0;
  const change365d = pct(current, v365);

  const ma30 =
    past.slice(-30).reduce((sum, p) => sum + p.value, 0) / Math.min(30, n);

  const values = past.map((p) => p.value);
  const quartiles = quartilesOf(values);
  const verdict = verdictFromQuartiles(current, quartiles);
  const t = THRESHOLDS[mode];

  let signal: Signal = "neutral";
  let signalText = "최근 분포의 평균 범위입니다.";

  if (!hasEnough30d) {
    // 데이터가 충분하지 않으면 분포 위치만 참고, 추세 신호는 미산출
    if (verdict === "great_deal") {
      signal = "buy";
      signalText = "통계적 저점권 (데이터 누적 중, 추세 신호 미산출).";
    } else if (verdict === "high") {
      signal = "wait";
      signalText = "통계적 고점권 (데이터 누적 중, 추세 신호 미산출).";
    } else {
      signalText = "데이터 누적 중 (30일 미만) — 통계 신호 미산출.";
    }
  } else if (verdict === "great_deal") {
    signal = "buy";
    signalText = "최근 1년 분포의 하위 25% — 통계적 저점권입니다.";
  } else if (verdict === "good" && change30d <= 0) {
    signal = "buy";
    signalText = "중앙값보다 저렴 + 한 달간 하락 — 매수 기회.";
  } else if (verdict === "high" && change30d <= t.buyDropPct) {
    // 상위 분포이지만 급락 중 — 여전히 비싸나 방향성 전환 가능
    signal = "neutral";
    signalText = "상위 분포이나 최근 급락 중 — 추세 전환 관망.";
  } else if (verdict === "high" && change30d >= t.highRisePct) {
    signal = "wait";
    signalText = "상위 분포 + 한 달간 상승 — 단기 관망.";
  } else if (verdict === "high") {
    signal = "wait";
    signalText = "최근 1년 분포의 상위 구간입니다.";
  } else if (change30d <= t.buyDropPct) {
    signal = "buy";
    signalText = "한 달간 큰 하락 — 단기 매수 기회.";
  } else if (change30d >= t.waitRisePct) {
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

// 뉴스 sentiment를 forecast에 ±bias로 반영.
// bullish: 30일에 걸쳐 +0.5% 누적 / bearish: -0.5% / neutral: 변경 없음.
// confidence(0~1)로 강도 스케일 — 모호한 신호는 약한 bias, 명확한 신호는 풀강도.
export function applySentimentBias(
  series: Series,
  sentiment: "bullish" | "bearish" | "neutral" | null | undefined,
  confidence = 1,
): Series {
  if (!sentiment || sentiment === "neutral" || series.forecast.length === 0) return series;
  const conf = Math.max(0, Math.min(1, confidence));
  if (conf <= 0) return series;
  const totalBias = (sentiment === "bullish" ? 0.005 : -0.005) * conf;
  const forecast = series.forecast.map((p, i) => {
    const t = (i + 1) / series.forecast.length;
    return { ...p, value: p.value * (1 + totalBias * t) };
  });
  const forecastBand = series.forecastBand
    ? {
        upper: series.forecastBand.upper.map((v, i) => {
          const t = (i + 1) / series.forecast.length;
          return v * (1 + totalBias * t);
        }),
        lower: series.forecastBand.lower.map((v, i) => {
          const t = (i + 1) / series.forecast.length;
          return v * (1 + totalBias * t);
        }),
      }
    : undefined;
  return { ...series, forecast, forecastBand };
}

// 다가오는 거시 이벤트의 예상 변동성을 forecastBand에 반영.
// 이벤트 daysAhead 이후의 forecast 인덱스부터 sigma를 expectedVolatility/100 만큼 누적.
// (forecast value는 그대로 — bias는 sentiment 몫. 여기서는 불확실성만 확장)
//
// 호출 순서 주의: applySentimentBias 다음에 호출해야 함 (bias 적용된 fc.value 기준으로 band 역산).
// 가산 정책: 동일 일자에 복수 이벤트가 겹치면 sigma는 누산되되 SIGMA_CAP(±3.5%)으로 클램프.
// 음수 lower bound 방지: lower는 fc.value의 5% 이하로 떨어지지 않게 가드.
const SIGMA_CAP = 0.035;
export function applyEventVolatility(
  series: Series,
  events: UpcomingEvent[],
): Series {
  const fc = series.forecast;
  const band = series.forecastBand;
  if (!band || fc.length === 0 || events.length === 0) return series;

  const sigmaBonus = new Array(fc.length).fill(0);
  for (const e of events) {
    const onset = Math.max(1, e.daysAhead) - 1; // forecast index 기준 (0=D+1)
    if (onset >= fc.length) continue;
    const bonus = e.expectedVolatility / 100;
    for (let i = onset; i < fc.length; i++) sigmaBonus[i] += bonus;
  }

  const upper = band.upper.map((v, i) => {
    const p = fc[i].value;
    const orig = (v - p) / p; // 기존 sigmaT (시간 의존)
    const total = Math.min(SIGMA_CAP, orig + sigmaBonus[i]);
    return Math.round(p * (1 + total) * 100) / 100;
  });
  const lower = band.lower.map((v, i) => {
    const p = fc[i].value;
    const orig = (p - v) / p;
    const total = Math.min(SIGMA_CAP, orig + sigmaBonus[i]);
    return Math.round(Math.max(p * 0.05, p * (1 - total)) * 100) / 100;
  });

  return { ...series, forecastBand: { upper, lower } };
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

import { t } from "./i18n";

// RN 호환 색상 (rgba bg, hex border/stroke). label은 locale별로 t()에서 조회.
export const SIGNAL_STYLE: Record<
  Signal,
  { bg: string; border: string; stroke: string; label: string }
> = {
  buy: {
    bg: "rgba(132, 204, 22, 0.10)",
    border: "rgba(132, 204, 22, 0.40)",
    stroke: "#a3e635",
    get label() { return t("signal.buy"); },
  },
  wait: {
    bg: "rgba(244, 63, 94, 0.10)",
    border: "rgba(244, 63, 94, 0.40)",
    stroke: "#fb7185",
    get label() { return t("signal.wait"); },
  },
  neutral: {
    bg: "rgba(113, 113, 122, 0.10)",
    border: "rgba(113, 113, 122, 0.40)",
    stroke: "#a1a1aa",
    get label() { return t("signal.neutral"); },
  },
};

export type CategoryMeta = {
  name: string;
  subtitle: string;
  unit: string;
  emoji: string;
};

// 카테고리 이모지·단위 키 — 라벨은 i18n에서 동적 조회 (locale 분기)
const CATEGORY_BASE: Record<string, { emoji: string; unitKey: string }> = {
  "fx-usd":     { emoji: "💵", unitKey: "cat.unit.krw" },
  "fx-jpy":     { emoji: "💴", unitKey: "cat.unit.krw" },
  "gas-petrol": { emoji: "⛽", unitKey: "cat.unit.perL" },
  "gas-diesel": { emoji: "⛽", unitKey: "cat.unit.perL" },
  "gas-lpg":    { emoji: "🔵", unitKey: "cat.unit.perL" },
  "gold-kr":    { emoji: "🪙", unitKey: "cat.unit.perG" },
  "air-nrt":    { emoji: "✈️", unitKey: "cat.unit.krw" },
  "air-tpe":    { emoji: "✈️", unitKey: "cat.unit.krw" },
};

export const CATEGORY_SLUGS = Object.keys(CATEGORY_BASE);

// 사용자가 추가 가능한 추가 통화 — Frankfurter가 지원 + 한국인에게 친숙한 순.
// 시스템 기본(USD/JPY/EUR/CNY)은 제외.
export const ADDABLE_CURRENCIES: Array<{
  code: string;
  korean: string;
  emoji: string;
}> = [
  { code: "EUR", korean: "유로", emoji: "💶" },
  { code: "CNY", korean: "위안", emoji: "💴" },
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

export const ADDABLE_FLIGHTS: Array<{
  slug: string;
  korean: string;
  emoji: string;
  destination: string;
}> = [
  { slug: "air-kix", korean: "오사카", emoji: "✈️", destination: "ICN→KIX" },
  { slug: "air-fuk", korean: "후쿠오카", emoji: "✈️", destination: "ICN→FUK" },
  { slug: "air-cts", korean: "삿포로", emoji: "✈️", destination: "ICN→CTS" },
  { slug: "air-bkk", korean: "방콕", emoji: "✈️", destination: "ICN→BKK" },
  { slug: "air-sin", korean: "싱가포르", emoji: "✈️", destination: "ICN→SIN" },
  { slug: "air-hkg", korean: "홍콩", emoji: "✈️", destination: "ICN→HKG" },
  { slug: "air-dps", korean: "발리", emoji: "✈️", destination: "ICN→DPS" },
  { slug: "air-cdg", korean: "파리", emoji: "✈️", destination: "ICN→CDG" },
  { slug: "air-lax", korean: "LA", emoji: "✈️", destination: "ICN→LAX" },
  { slug: "air-oka", korean: "오키나와", emoji: "✈️", destination: "ICN→OKA" },
  { slug: "air-kul", korean: "쿠알라룸푸르", emoji: "✈️", destination: "ICN→KUL" },
  { slug: "air-sgn", korean: "호치민", emoji: "✈️", destination: "ICN→SGN" },
  { slug: "air-han", korean: "하노이", emoji: "✈️", destination: "ICN→HAN" },
  { slug: "air-dad", korean: "다낭", emoji: "✈️", destination: "ICN→DAD" },
  { slug: "air-mnl", korean: "마닐라", emoji: "✈️", destination: "ICN→MNL" },
  { slug: "air-cgk", korean: "자카르타", emoji: "✈️", destination: "ICN→CGK" },
  { slug: "air-pek", korean: "베이징", emoji: "✈️", destination: "ICN→PEK" },
  { slug: "air-pvg", korean: "상하이", emoji: "✈️", destination: "ICN→PVG" },
  { slug: "air-lhr", korean: "런던", emoji: "✈️", destination: "ICN→LHR" },
  { slug: "air-syd", korean: "시드니", emoji: "✈️", destination: "ICN→SYD" },
  { slug: "air-dxb", korean: "두바이", emoji: "✈️", destination: "ICN→DXB" },
  { slug: "air-gum", korean: "괌", emoji: "✈️", destination: "ICN→GUM" },
  { slug: "air-jfk", korean: "뉴욕", emoji: "✈️", destination: "ICN→JFK" },
];

const CURRENCY_LOOKUP = new Map(
  ADDABLE_CURRENCIES.map((c) => [c.code, c]),
);

const FLIGHT_LOOKUP = new Map(
  ADDABLE_FLIGHTS.map((f) => [f.slug, f]),
);

// 사용자 정의 fx-XYZ 슬러그에 대한 메타 동적 생성 (locale 반영)
export function metaFor(slug: string): CategoryMeta | undefined {
  const base = CATEGORY_BASE[slug];
  if (base) {
    return {
      name: t(`cat.${slug}.name`),
      subtitle: t(`cat.${slug}.sub`),
      unit: t(base.unitKey),
      emoji: base.emoji,
    };
  }
  // 사용자가 추가한 항공권 노선 (CATEGORY_BASE 미포함) — i18n 라벨 키는 이미 존재
  const flight = FLIGHT_LOOKUP.get(slug);
  if (flight) {
    return {
      name: t(`cat.${slug}.name`),
      subtitle: t(`cat.${slug}.sub`),
      unit: t("cat.unit.krw"),
      emoji: flight.emoji,
    };
  }
  const m = slug.match(/^fx-([a-z]{3})$/);
  if (m) {
    const code = m[1].toUpperCase();
    const info = CURRENCY_LOOKUP.get(code);
    if (info) {
      return {
        name: t("cat.fxAdd.name", { code, korean: info.korean }),
        subtitle: `${code}/KRW`,
        unit: t("cat.unit.krw"),
        emoji: info.emoji,
      };
    }
  }
  return undefined;
}

export function allSlugs(userCurrencies: string[]): string[] {
  const user = userCurrencies.map((c) =>
    c.includes("-") ? c : `fx-${c.toLowerCase()}`,
  );
  return [...CATEGORY_SLUGS, ...user];
}
