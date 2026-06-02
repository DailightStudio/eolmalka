// 오피넷 dailyAvgPrice — 특정 일자 전국 평균 유가 시세.
// 1년치 시계열 빌드하려면 365회 호출 필요 → 부담 큼.
// 전략: 최초 백필은 별도 1회 실행, 이후 매일 1회씩 누적.
// 현재 상태: 인프라 골격. avgRecentPrice는 이미 gas-provider.ts에서 사용 중(현재가만).

const KEY = process.env.EXPO_PUBLIC_OPINET_API_KEY;
const BASE = "https://www.opinet.co.kr/api";

export type OpinetDailyPoint = {
  date: string;        // YYYY-MM-DD
  price: number;       // 원/L (전국 평균)
  product: "B027" | "D047";
};

// 특정 일자의 전국 평균 — yyyymmdd (예: "20260603")
export async function getOpinetDailyPrice(
  yyyymmdd: string,
  product: "B027" | "D047" = "B027",
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
  product: "B027" | "D047" = "B027",
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
