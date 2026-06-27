// 주요 거시 경제 이벤트 캘린더 (2026~2027 일부, 하드코딩).
// 공식 발표 일정 변경 가능 — UI에서 "예상 일정, 공식 확인 권장" 디스클레이머 노출.
// 매년 1회 검증·갱신 필요 (BACKLOG).
//
// 데이터 소스: 환경변수 EXPO_PUBLIC_MACRO_CSV_URL(원격 JSON 엔드포인트)가 있으면
// 원격 일정을 우선 사용, 없거나 실패하면 아래 MACRO_EVENTS 하드코딩으로 폴백.
// (원격 → AsyncStorage 캐시 → 하드코딩 순. news-provider.ts 패턴 따름)
//
// 영향 매핑(affects)은 슬러그 프리픽스 매칭:
// - "fx-usd" → fx-usd 만
// - "fx-" → 모든 환율 (fx-usd, fx-jpy, ...)
// - "gold" → 금
// - "gas" → 휘발유

import AsyncStorage from "@react-native-async-storage/async-storage";

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

// 이벤트 발표 직후(D-day~D+1) 주요 자산의 평균 절대 변동률 (%).
// 역사적 통계 근사치. 실제는 컨센서스 대비 surprise에 좌우.
// 영향력 큰 이벤트는 큰 변동, 정례·예측가능한 이벤트는 작은 변동.
export const POST_EVENT_VOLATILITY: Record<MacroEventType, number> = {
  FOMC: 0.9,    // FOMC 발표 후 환율·금 ±0.9% 내외
  US_CPI: 0.7,
  US_PCE: 0.4,
  US_NFP: 0.6,
  US_FFR: 1.2,
  KR_CPI: 0.3,
  BOK: 0.5,
  ECB: 0.6,
  OPEC: 1.5,    // OPEC 결정은 유가에 큰 변동
};

export type UpcomingEvent = MacroEvent & {
  daysAhead: number;
  emoji: string;
  expectedVolatility: number; // % (예: 0.9 = ±0.9%)
};

export function upcomingEvents(
  slug: string,
  daysAhead = 60,
  limit = 5,
): UpcomingEvent[] {
  const todayStr = ymdToday();
  const todayMs = Date.parse(todayStr);
  const limitMs = todayMs + daysAhead * 86400000;

  return getMacroEvents().filter((e) => {
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
      // 원격 CSV의 미지의 type은 이모지/변동률 미등록 → 안전한 기본값으로 폴백
      emoji: TYPE_EMOJI[e.type] ?? "📅",
      expectedVolatility: POST_EVENT_VOLATILITY[e.type] ?? 0.5,
    }));
}

function ymdToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

// ── 원격 일정 (원격 JSON 엔드포인트) ─────────────────────
// 키 없으면 no-op → 하드코딩 폴백. 원격 수정이 다음 fetch 때 앱에 반영됨.
// 환경변수명은 호환을 위해 유지 (URL 포맷 불문 — 이제 JSON을 가리킴).
const MACRO_CSV_URL = process.env.EXPO_PUBLIC_MACRO_CSV_URL;
const MACRO_CACHE_KEY = "eolmalka:macro:v1";

// 원격 일정 메모리 캐시. null이면 하드코딩 사용. (앱 시작 시 AsyncStorage → 네트워크 순 hydrate)
let remoteEvents: MacroEvent[] | null = null;

// 렌더에서 동기로 읽음: 원격 있으면 원격, 없으면 하드코딩.
function getMacroEvents(): MacroEvent[] {
  return remoteEvents ?? MACRO_EVENTS;
}

export async function loadRemoteMacroEvents(): Promise<void> {
  if (!MACRO_CSV_URL) return; // 미설정 → 하드코딩 폴백

  // 1) 캐시 먼저 hydrate (오프라인/마지막 원격값 즉시 사용)
  if (!remoteEvents) {
    try {
      const raw = await AsyncStorage.getItem(MACRO_CACHE_KEY);
      if (raw) {
        // 캐시는 shape를 신뢰하지 않고 검증 — 스키마 변경 등으로 affects 누락 시
        // upcomingEvents의 e.affects.some(...)가 렌더 중 TypeError로 크래시하는 것 방지
        const cached = JSON.parse(raw) as unknown;
        if (Array.isArray(cached)) {
          const valid = (cached as MacroEvent[]).filter(
            (e) => e && typeof e.date === "string" && typeof e.title === "string" && Array.isArray(e.affects),
          );
          if (valid.length > 0) remoteEvents = valid;
        }
      }
    } catch {}
  }

  // 2) 네트워크 새로고침
  try {
    const res = await fetch(MACRO_CSV_URL);
    if (!res.ok) throw new Error(`Macro JSON HTTP ${res.status}`);
    const csv = await res.text();
    const parsed = parseRemoteMacroJSON(csv);
    // 유효 행 0개면 실패 처리 — 캐시/폴백 유지, 빈 배열로 덮어쓰지 않음
    if (parsed.length === 0) throw new Error("Macro JSON: no valid rows");
    remoteEvents = parsed;
    try {
      await AsyncStorage.setItem(MACRO_CACHE_KEY, JSON.stringify(parsed));
    } catch {}
  } catch (e) {
    console.warn("[macro] remote load failed", e);
    // 캐시/하드코딩 유지, throw 금지
  }
}

// ── 원격 JSON 파서 ───────────────────────────────────────
// 응답: { updated_utc, source, count, events: [{ date_utc, type, note }, ...] }
// 모든 이벤트는 美 주요 경제지표로 간주 → country=US, affects=["fx-"], importance=high.
function parseRemoteMacroJSON(text: string): MacroEvent[] {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch (e) {
    throw new Error(`Macro JSON: parse 실패 (${(e as Error).message})`);
  }
  if (!root || typeof root !== "object") {
    throw new Error("Macro JSON: 최상위가 객체가 아님");
  }
  const events = (root as { events?: unknown }).events;
  if (!Array.isArray(events)) {
    throw new Error("Macro JSON: 'events' 배열 없음");
  }

  const out: MacroEvent[] = [];
  for (const item of events) {
    if (!item || typeof item !== "object") continue;
    const { date_utc, type: rawType, note } = item as {
      date_utc?: unknown;
      type?: unknown;
      note?: unknown;
    };

    // 엄격한 zero-padded ISO만 허용 — upcomingEvents가 localeCompare(렉시컬) 정렬이라
    // 비표준 형식(2026/7/1, 2026-6-7)은 Date.parse는 통과해도 정렬을 깨뜨림 → skip
    const date = typeof date_utc === "string" ? date_utc.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) continue;

    // type은 비어있지 않은 문자열 필수. 코드값 정규화, 미지의 값은 문자열 유지
    // (upcomingEvents가 이모지/변동률 미등록 시 안전한 기본값으로 폴백)
    const typeStr = typeof rawType === "string" ? rawType.trim() : "";
    if (!typeStr) continue;
    const type = typeStr.toUpperCase() as MacroEventType;

    // note는 선택 — 비어있으면 시간 미정 표시
    const noteStr = typeof note === "string" ? note.trim() : "";
    const title = noteStr || "(시간 미정)";

    out.push({
      date,
      type,
      title,
      country: "US",
      affects: ["fx-"],
      importance: "high",
    });
  }

  if (out.length === 0) {
    throw new Error("Macro JSON: 유효 이벤트 0개");
  }
  return out;
}
