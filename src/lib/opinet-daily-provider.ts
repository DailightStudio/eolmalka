// 오피넷 dailyAvgPrice — 특정 일자 전국 평균 유가 시세.
// 1년치 시계열 빌드하려면 365회 호출 필요 → 부담 큼.
// 전략: chunked + resumable 백필 — 앱 진입마다 N일씩, AsyncStorage에 진행도 저장.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { bulkAppendDaily } from "./series-store";

const KEY = process.env.EXPO_PUBLIC_OPINET_API_KEY;
const BASE = "https://www.opinet.co.kr/api";
const PROGRESS_PREFIX = "eolmalka:backfill:opinet:v1:"; // key: <slug>, value: 가장 오래된 백필 완료일 인덱스 (today-N)
const TARGET_DAYS = 365;
const CHUNK_DAYS = 30;     // 1회 백필당 처리할 일자 수
const CALL_DELAY_MS = 200; // 호출간 간격

export type OpinetDailyProduct = "B027" | "D047" | "C004";

export type OpinetDailyPoint = {
  date: string;        // YYYY-MM-DD
  price: number;       // 원/L (전국 평균)
  product: OpinetDailyProduct;
};

// 특정 일자의 전국 평균 — yyyymmdd (예: "20260603")
export async function getOpinetDailyPrice(
  yyyymmdd: string,
  product: OpinetDailyProduct = "B027",
): Promise<OpinetDailyPoint | null> {
  if (!KEY) return null;
  try {
    const url = `${BASE}/dailyAvgPrice.do?code=${KEY}&date=${yyyymmdd}&out=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as {
      RESULT?: {
        OIL?: Array<{ TRADE_DT?: string; PRODCD?: string; PRICE?: string | number }>;
      };
    };
    const rows = json.RESULT?.OIL ?? [];
    const row = rows.find((r) => r.PRODCD === product);
    if (!row) return null;
    const price = Number(row.PRICE);
    if (!Number.isFinite(price) || price <= 0) return null;
    return {
      date: `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`,
      price: Math.round(price * 100) / 100,
      product,
    };
  } catch {
    return null;
  }
}

// 백필: 지난 N일 일자별 가격 일괄 수집 (rate limit 주의 — 호출간 200ms)
export async function backfillDays(
  days: number,
  product: OpinetDailyProduct = "B027",
): Promise<OpinetDailyPoint[]> {
  const out: OpinetDailyPoint[] = [];
  const today = new Date();
  for (let i = days; i >= 1; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const ymd = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const p = await getOpinetDailyPrice(ymd, product);
    if (p) out.push(p);
    // rate limit 보호
    await new Promise((r) => setTimeout(r, 200));
  }
  return out;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// 진행도 = 오늘로부터 얼마나 과거까지 백필됐는지 (일수).
// 0=시작 전, 365=완료. 매 호출마다 CHUNK_DAYS 만큼 더 과거로 확장.
async function loadProgress(slug: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(`${PROGRESS_PREFIX}${slug}`);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n >= 0 ? Math.min(n, TARGET_DAYS) : 0;
  } catch {
    return 0;
  }
}

async function saveProgress(slug: string, n: number): Promise<void> {
  try {
    await AsyncStorage.setItem(`${PROGRESS_PREFIX}${slug}`, String(Math.min(n, TARGET_DAYS)));
  } catch {}
}

// 한 chunk 백필. fire-and-forget 안전 (실패해도 진행도 안 올림 → 다음에 재시도).
// 반환: 이번에 추가된 포인트 수.
export async function backfillChunk(
  slug = "gas-petrol",
  product: OpinetDailyProduct = "B027",
): Promise<number> {
  if (!KEY) return 0;
  const done = await loadProgress(slug);
  if (done >= TARGET_DAYS) return 0;

  const start = done + 1;                            // 오늘 기준 며칠 전부터 (시작점은 과거 방향으로 +1)
  const end = Math.min(TARGET_DAYS, done + CHUNK_DAYS);
  const points: { date: string; value: number }[] = [];
  const today = new Date();

  for (let i = start; i <= end; i++) {
    const d = new Date(today.getTime() - i * 86400000);
    const yyyymmdd = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const p = await getOpinetDailyPrice(yyyymmdd, product);
    if (p) points.push({ date: p.date, value: p.price });
    await new Promise((r) => setTimeout(r, CALL_DELAY_MS));
  }

  if (points.length > 0) {
    await bulkAppendDaily(slug, points);
  }
  // 휴장일이라 점이 없어도 진행도는 올림 (그 날짜는 영원히 비어있는 게 정상)
  await saveProgress(slug, end);
  return points.length;
}

export async function getBackfillProgress(slug = "gas-petrol"): Promise<{
  done: number;
  target: number;
}> {
  return { done: await loadProgress(slug), target: TARGET_DAYS };
}
