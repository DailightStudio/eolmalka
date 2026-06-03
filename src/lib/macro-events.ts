// 주요 거시 경제 이벤트 캘린더 (2026~2027 일부, 하드코딩).
// 공식 발표 일정 변경 가능 — UI에서 "예상 일정, 공식 확인 권장" 디스클레이머 노출.
// 매년 1회 검증·갱신 필요 (BACKLOG).
//
// 영향 매핑(affects)은 슬러그 프리픽스 매칭:
// - "fx-usd" → fx-usd 만
// - "fx-" → 모든 환율 (fx-usd, fx-jpy, ...)
// - "gold" → 금
// - "gas" → 휘발유

export type MacroEventType =
  | "FOMC"
  | "US_CPI"
  | "US_PCE"
  | "US_NFP"
  | "US_FFR"
  | "KR_CPI"
  | "BOK"
  | "ECB"
  | "OPEC";

export type MacroEvent = {
  date: string; // YYYY-MM-DD
  type: MacroEventType;
  title: string;
  country: "US" | "KR" | "EU" | "OPEC";
  affects: string[]; // 슬러그 프리픽스
  importance: "high" | "medium";
};

// 2026 ~ 2027 상반기 주요 이벤트 (Fed/BLS/BOK/ECB 일정, 변경 가능)
export const MACRO_EVENTS: MacroEvent[] = [
  // ── FOMC 정례회의 (8회/년, Fed 공식 일정 추정)
  { date: "2026-06-17", type: "FOMC", title: "FOMC 정례회의", country: "US",
    affects: ["fx-", "gold"], importance: "high" },
  { date: "2026-07-29", type: "FOMC", title: "FOMC 정례회의", country: "US",
    affects: ["fx-", "gold"], importance: "high" },
  { date: "2026-09-16", type: "FOMC", title: "FOMC 정례회의", country: "US",
    affects: ["fx-", "gold"], importance: "high" },
  { date: "2026-10-28", type: "FOMC", title: "FOMC 정례회의", country: "US",
    affects: ["fx-", "gold"], importance: "high" },
  { date: "2026-12-16", type: "FOMC", title: "FOMC 정례회의", country: "US",
    affects: ["fx-", "gold"], importance: "high" },
  { date: "2027-01-27", type: "FOMC", title: "FOMC 정례회의", country: "US",
    affects: ["fx-", "gold"], importance: "high" },

  // ── US CPI (매월 둘째 주 수/목)
  { date: "2026-06-11", type: "US_CPI", title: "美 5월 소비자물가지수", country: "US",
    affects: ["fx-usd", "fx-jpy", "gold"], importance: "high" },
  { date: "2026-07-15", type: "US_CPI", title: "美 6월 CPI", country: "US",
    affects: ["fx-usd", "fx-jpy", "gold"], importance: "high" },
  { date: "2026-08-13", type: "US_CPI", title: "美 7월 CPI", country: "US",
    affects: ["fx-usd", "fx-jpy", "gold"], importance: "high" },
  { date: "2026-09-11", type: "US_CPI", title: "美 8월 CPI", country: "US",
    affects: ["fx-usd", "fx-jpy", "gold"], importance: "high" },
  { date: "2026-10-15", type: "US_CPI", title: "美 9월 CPI", country: "US",
    affects: ["fx-usd", "fx-jpy", "gold"], importance: "high" },
  { date: "2026-11-13", type: "US_CPI", title: "美 10월 CPI", country: "US",
    affects: ["fx-usd", "fx-jpy", "gold"], importance: "high" },
  { date: "2026-12-11", type: "US_CPI", title: "美 11월 CPI", country: "US",
    affects: ["fx-usd", "fx-jpy", "gold"], importance: "high" },

  // ── US PCE (Fed 선호 인플레, 매월 말)
  { date: "2026-06-26", type: "US_PCE", title: "美 5월 PCE 물가", country: "US",
    affects: ["fx-usd", "gold"], importance: "medium" },
  { date: "2026-07-31", type: "US_PCE", title: "美 6월 PCE", country: "US",
    affects: ["fx-usd", "gold"], importance: "medium" },

  // ── US NFP (비농업 고용, 매월 첫 금요일)
  { date: "2026-06-05", type: "US_NFP", title: "美 5월 고용보고서(NFP)", country: "US",
    affects: ["fx-usd", "gold"], importance: "high" },
  { date: "2026-07-03", type: "US_NFP", title: "美 6월 NFP", country: "US",
    affects: ["fx-usd", "gold"], importance: "high" },
  { date: "2026-08-07", type: "US_NFP", title: "美 7월 NFP", country: "US",
    affects: ["fx-usd", "gold"], importance: "high" },
  { date: "2026-09-04", type: "US_NFP", title: "美 8월 NFP", country: "US",
    affects: ["fx-usd", "gold"], importance: "high" },

  // ── KR CPI (한국 소비자물가, 매월 2일경)
  { date: "2026-07-02", type: "KR_CPI", title: "韓 6월 소비자물가", country: "KR",
    affects: ["fx-", "gold", "gas-"], importance: "medium" },
  { date: "2026-08-04", type: "KR_CPI", title: "韓 7월 CPI", country: "KR",
    affects: ["fx-", "gold", "gas-"], importance: "medium" },
  { date: "2026-09-02", type: "KR_CPI", title: "韓 8월 CPI", country: "KR",
    affects: ["fx-", "gold", "gas-"], importance: "medium" },

  // ── BOK 금통위 (한국은행, 8회/년)
  { date: "2026-07-10", type: "BOK", title: "BOK 기준금리 결정", country: "KR",
    affects: ["fx-"], importance: "high" },
  { date: "2026-08-28", type: "BOK", title: "BOK 금통위", country: "KR",
    affects: ["fx-"], importance: "high" },
  { date: "2026-10-23", type: "BOK", title: "BOK 금통위", country: "KR",
    affects: ["fx-"], importance: "high" },

  // ── ECB (유럽중앙은행, 6주마다)
  { date: "2026-07-23", type: "ECB", title: "ECB 통화정책회의", country: "EU",
    affects: ["fx-eur", "fx-"], importance: "high" },
  { date: "2026-09-10", type: "ECB", title: "ECB 회의", country: "EU",
    affects: ["fx-eur", "fx-"], importance: "high" },
  { date: "2026-10-29", type: "ECB", title: "ECB 회의", country: "EU",
    affects: ["fx-eur", "fx-"], importance: "high" },

  // ── OPEC+ 회의 (유가 직접 영향)
  { date: "2026-06-29", type: "OPEC", title: "OPEC+ 정례회의", country: "OPEC",
    affects: ["gas-"], importance: "high" },
  { date: "2026-08-31", type: "OPEC", title: "OPEC+ 정례회의", country: "OPEC",
    affects: ["gas-"], importance: "high" },
  { date: "2026-12-01", type: "OPEC", title: "OPEC+ 연말회의", country: "OPEC",
    affects: ["gas-"], importance: "high" },
];

const TYPE_EMOJI: Record<MacroEventType, string> = {
  FOMC: "🏦",
  US_CPI: "📊",
  US_PCE: "📊",
  US_NFP: "👷",
  US_FFR: "🏦",
  KR_CPI: "🇰🇷",
  BOK: "🏦",
  ECB: "🇪🇺",
  OPEC: "🛢️",
};

export type UpcomingEvent = MacroEvent & {
  daysAhead: number;
  emoji: string;
};

export function upcomingEvents(
  slug: string,
  daysAhead = 60,
  limit = 5,
): UpcomingEvent[] {
  const todayStr = ymdToday();
  const todayMs = Date.parse(todayStr);
  const limitMs = todayMs + daysAhead * 86400000;

  return MACRO_EVENTS.filter((e) => {
    const t = Date.parse(e.date);
    if (Number.isNaN(t)) return false;
    if (t < todayMs || t > limitMs) return false;
    return e.affects.some((a) => slug.startsWith(a) || a === slug);
  })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit)
    .map((e) => ({
      ...e,
      daysAhead: Math.max(0, Math.round((Date.parse(e.date) - todayMs) / 86400000)),
      emoji: TYPE_EMOJI[e.type],
    }));
}

function ymdToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}
