// Travelpayouts month-matrix API — 이번달 날짜별 최저가 중앙값을 시세로 사용.
// 단일 최저가(특가·이상치)에 흔들리지 않는 안정적인 시장 수준 반영.
// https://api.travelpayouts.com/v2/prices/month-matrix

import { getCachedEnvelope, setCached } from "./cache";

const TOKEN = process.env.EXPO_PUBLIC_TRAVELPAYOUTS_TOKEN;
const BASE = "https://api.travelpayouts.com";

// destination은 Travelpayouts 도시코드 (NRT→TYO, 나머지는 공항=도시코드 동일)
const ROUTES: Record<string, { origin: string; destination: string }> = {
  "air-nrt": { origin: "ICN", destination: "TYO" },
  "air-tpe": { origin: "ICN", destination: "TPE" },
  "air-kix": { origin: "ICN", destination: "OSA" },
  "air-fuk": { origin: "ICN", destination: "FUK" },
  "air-cts": { origin: "ICN", destination: "CTS" },
  "air-bkk": { origin: "ICN", destination: "BKK" },
  "air-sin": { origin: "ICN", destination: "SIN" },
  "air-hkg": { origin: "ICN", destination: "HKG" },
  "air-dps": { origin: "ICN", destination: "DPS" },
  "air-cdg": { origin: "ICN", destination: "PAR" },
  "air-lax": { origin: "ICN", destination: "LAX" },
  "air-oka": { origin: "ICN", destination: "OKA" },
  "air-kul": { origin: "ICN", destination: "KUL" },
  "air-sgn": { origin: "ICN", destination: "SGN" },
  "air-han": { origin: "ICN", destination: "HAN" },
  "air-dad": { origin: "ICN", destination: "DAD" },
  "air-mnl": { origin: "ICN", destination: "MNL" },
  "air-cgk": { origin: "ICN", destination: "JKT" },
  "air-pek": { origin: "ICN", destination: "BJS" },
  "air-pvg": { origin: "ICN", destination: "SHA" },
  "air-lhr": { origin: "ICN", destination: "LON" },
  "air-syd": { origin: "ICN", destination: "SYD" },
  "air-dxb": { origin: "ICN", destination: "DXB" },
  "air-gum": { origin: "ICN", destination: "GUM" },
  "air-jfk": { origin: "ICN", destination: "NYC" },
};

export type AirFareResult = {
  price: number;
  live: boolean;
  fetchedAt?: number; // 실데이터 fetch 성공 시각(ms). 오프라인 fallback이면 캐시 기록 시각.
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function getAirFare(slug: string): Promise<AirFareResult> {
  if (!TOKEN) return { price: 0, live: false };
  const route = ROUTES[slug];
  if (!route) return { price: 0, live: false };

  const cacheKey = `cache:air:${slug}`;
  try {
    const url =
      `${BASE}/v2/prices/month-matrix` +
      `?origin=${route.origin}&destination=${route.destination}` +
      `&month=${currentMonth()}&currency=KRW&show_to_affiliates=true&token=${TOKEN}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[air] HTTP ${res.status} ${slug}`);
      return offlineFallback(cacheKey);
    }
    const json = (await res.json()) as {
      success?: boolean;
      data?: Array<{ value: number; actual?: boolean }>;
    };
    if (!json.success || !json.data?.length) return offlineFallback(cacheKey);

    const prices = json.data
      .filter((x) => x.actual !== false && x.value > 0)
      .map((x) => x.value);

    if (prices.length === 0) return offlineFallback(cacheKey);
    const result: AirFareResult = { price: median(prices), live: true, fetchedAt: Date.now() };
    await setCached(cacheKey, result);
    return result;
  } catch (e) {
    console.warn("[air] fetch failed", slug, e);
    return offlineFallback(cacheKey);
  }
}

// 네트워크 실패 시 마지막 성공 데이터(영구 캐시) 사용. 없으면 비라이브(합성 폴백 유도).
async function offlineFallback(cacheKey: string): Promise<AirFareResult> {
  const cached = await getCachedEnvelope<AirFareResult>(cacheKey);
  if (cached && cached.data.price > 0) {
    return { ...cached.data, live: false, fetchedAt: cached.ts };
  }
  return { price: 0, live: false };
}
