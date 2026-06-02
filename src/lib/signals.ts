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

export const SIGNAL_STYLE: Record<
  Signal,
  { bg: string; text: string; label: string; stroke: string }
> = {
  buy: {
    bg: "bg-lime-500/15 border-lime-500/40",
    text: "text-lime-400",
    label: "지금 사세요",
    stroke: "#a3e635",
  },
  wait: {
    bg: "bg-rose-500/15 border-rose-500/40",
    text: "text-rose-400",
    label: "기다리세요",
    stroke: "#fb7185",
  },
  neutral: {
    bg: "bg-zinc-500/15 border-zinc-500/40",
    text: "text-zinc-300",
    label: "보통",
    stroke: "#a1a1aa",
  },
};

export const CATEGORY_META: Record<
  string,
  { name: string; subtitle: string; unit: string; emoji: string }
> = {
  "fx-usd":     { name: "원/달러 환율", subtitle: "USD/KRW",              unit: "원",    emoji: "💵" },
  "fx-jpy":     { name: "원/엔 환율",   subtitle: "JPY/KRW (100엔)",     unit: "원",    emoji: "💴" },
  "fx-eur":     { name: "원/유로 환율", subtitle: "EUR/KRW",              unit: "원",    emoji: "💶" },
  "fx-cny":     { name: "원/위안 환율", subtitle: "CNY/KRW",              unit: "원",    emoji: "💴" },
  "gas-petrol": { name: "휘발유",       subtitle: "전국 평균 (오피넷)",   unit: "원/L",  emoji: "⛽" },
  "gold-kr":    { name: "금 시세",      subtitle: "한국금거래소 24K",     unit: "원/g",  emoji: "🪙" },
  "air-nrt":    { name: "도쿄 항공권",  subtitle: "ICN→NRT 왕복 최저가",  unit: "원",    emoji: "✈️" },
  "air-tpe":    { name: "타이베이 항공권", subtitle: "ICN→TPE 왕복 최저가", unit: "원",  emoji: "✈️" },
};

export const CATEGORY_SLUGS = Object.keys(CATEGORY_META);
