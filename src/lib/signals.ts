import type { Point, Series } from "./demo-series";

export type Signal = "buy" | "wait" | "neutral";

export type SeriesStats = {
  current: number;
  change7d: number;   // %
  change30d: number;  // %
  change365d: number; // %
  ma30: number;       // 30일 이동평균
  signal: Signal;
  signalText: string;
};

// 신호 임계치: 단기(=7일 추세) + 위치(현재가 vs 30d MA + 30d 변동률) 조합
// - buy:  현재가가 MA30 대비 -1.5%↓ 이고 30d 변동률 ≤ -1% (저점권)
// - wait: 현재가가 MA30 대비 +1.5%↑ 이고 30d 변동률 ≥ +1% (고점권)
// - 그 외 neutral
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
  const maGap = pct(current, ma30); // 현재가가 MA30 대비 얼마나 위/아래인지

  let signal: Signal = "neutral";
  let signalText = "평이한 흐름";

  if (maGap <= -1.5 && change30d <= -1) {
    signal = "buy";
    signalText = "최근 30일 저점권 — 지금이 살 타이밍";
  } else if (maGap >= 1.5 && change30d >= 1) {
    signal = "wait";
    signalText = "최근 30일 고점권 — 조금 기다리세요";
  } else if (change30d <= -4) {
    signal = "buy";
    signalText = "한 달간 큰 하락 — 매수 기회";
  } else if (change30d >= 4) {
    signal = "wait";
    signalText = "한 달간 급등 — 단기는 관망";
  }

  return {
    current,
    change7d: round1(change7d),
    change30d: round1(change30d),
    change365d: round1(change365d),
    ma30: Math.round(ma30 * 10) / 10,
    signal,
    signalText,
  };
}

function pct(now: number, then: number): number {
  if (!then) return 0;
  return ((now - then) / then) * 100;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

// 예측 평균이 현재가 대비 얼마나 변하는지 — 카드 보조 정보로 사용 가능
export function forecastChange(series: Series): number {
  const past = series.past;
  const current = past[past.length - 1].value;
  const forecast = series.forecast;
  if (!forecast.length) return 0;
  const avg =
    forecast.reduce((sum, p) => sum + p.value, 0) / forecast.length;
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

// 카테고리 메타데이터 (이름·단위·아이콘 등) — demo-series와 분리되어
// 실데이터 연결 시에도 그대로 재사용.
export const CATEGORY_META: Record<
  string,
  { name: string; subtitle: string; unit: string; emoji: string }
> = {
  "fx-usd":     { name: "원/달러 환율", subtitle: "USD/KRW",              unit: "원",    emoji: "💵" },
  "fx-jpy":     { name: "원/엔 환율",   subtitle: "JPY/KRW (100엔)",     unit: "원",    emoji: "💴" },
  "gas-petrol": { name: "휘발유",       subtitle: "전국 평균",            unit: "원/L",  emoji: "⛽" },
  "gold-kr":    { name: "금 시세",      subtitle: "한국금거래소 24K",     unit: "원/g",  emoji: "🪙" },
  "air-nrt":    { name: "도쿄 항공권",  subtitle: "ICN→NRT 왕복 최저가",  unit: "원",    emoji: "✈️" },
  "air-tpe":    { name: "타이베이 항공권", subtitle: "ICN→TPE 왕복 최저가", unit: "원",  emoji: "✈️" },
};

export const CATEGORY_SLUGS = Object.keys(CATEGORY_META);
