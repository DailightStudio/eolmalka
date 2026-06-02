export type Signal = "buy" | "wait" | "neutral";

export type Category = {
  slug: string;
  emoji: string;
  name: string;
  subtitle: string;
  unit: string;
  current: number;
  change30d: number;
  signal: Signal;
  signalText: string;
};

export const CATEGORIES: Category[] = [
  {
    slug: "fx-usd",
    emoji: "💵",
    name: "원/달러 환율",
    subtitle: "USD/KRW",
    unit: "원",
    current: 1376.5,
    change30d: -1.2,
    signal: "buy",
    signalText: "최근 30일 저점권 — 지금이 살 타이밍",
  },
  {
    slug: "fx-jpy",
    emoji: "💴",
    name: "원/엔 환율",
    subtitle: "JPY/KRW (100엔)",
    unit: "원",
    current: 894.2,
    change30d: 2.4,
    signal: "wait",
    signalText: "최근 30일 고점권 — 조금 기다리세요",
  },
  {
    slug: "gas-petrol",
    emoji: "⛽",
    name: "휘발유",
    subtitle: "전국 평균",
    unit: "원/L",
    current: 1652,
    change30d: 0.4,
    signal: "neutral",
    signalText: "평이한 흐름",
  },
  {
    slug: "gold-kr",
    emoji: "🪙",
    name: "금 시세",
    subtitle: "한국금거래소 24K",
    unit: "원/g",
    current: 125400,
    change30d: 3.8,
    signal: "wait",
    signalText: "단기 급등 — 단기는 관망",
  },
  {
    slug: "air-nrt",
    emoji: "✈️",
    name: "도쿄 항공권",
    subtitle: "ICN→NRT 왕복 최저가",
    unit: "원",
    current: 198000,
    change30d: -8.1,
    signal: "buy",
    signalText: "계절적 저점 진입 — 1~2주 내 발권 권장",
  },
  {
    slug: "air-tpe",
    emoji: "✈️",
    name: "타이베이 항공권",
    subtitle: "ICN→TPE 왕복 최저가",
    unit: "원",
    current: 312000,
    change30d: 5.6,
    signal: "wait",
    signalText: "성수기 진입 — 한 달 더 기다리는 게 유리",
  },
];

export const SIGNAL_STYLE: Record<
  Signal,
  { bg: string; text: string; label: string }
> = {
  buy: {
    bg: "bg-lime-500/15 border-lime-500/40",
    text: "text-lime-400",
    label: "지금 사세요",
  },
  wait: {
    bg: "bg-rose-500/15 border-rose-500/40",
    text: "text-rose-400",
    label: "기다리세요",
  },
  neutral: {
    bg: "bg-zinc-500/15 border-zinc-500/40",
    text: "text-zinc-300",
    label: "보통",
  },
};
