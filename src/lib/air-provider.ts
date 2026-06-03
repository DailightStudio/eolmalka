// Travelpayouts Data API — 인천 출발 최저 항공료
// https://support.travelpayouts.com/hc/en-us/articles/203956163
// 토큰: EXPO_PUBLIC_TRAVELPAYOUTS_TOKEN

const TOKEN = process.env.EXPO_PUBLIC_TRAVELPAYOUTS_TOKEN;
const BASE = "https://api.travelpayouts.com";

const ROUTES: Record<string, { origin: string; destination: string }> = {
  "air-nrt": { origin: "ICN", destination: "NRT" },
  "air-tpe": { origin: "ICN", destination: "TPE" },
};

export type AirFareResult = {
  price: number;
  live: boolean;
};

export async function getAirFare(slug: string): Promise<AirFareResult> {
  if (!TOKEN) return { price: 0, live: false };
  const route = ROUTES[slug];
  if (!route) return { price: 0, live: false };

  try {
    const url =
      `${BASE}/v1/prices/cheap` +
      `?origin=${route.origin}&destination=${route.destination}` +
      `&currency=KRW&token=${TOKEN}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[air] HTTP ${res.status} ${slug}`);
      return { price: 0, live: false };
    }
    const json = (await res.json()) as {
      success?: boolean;
      data?: Record<string, Record<string, { price: number }>>;
    };
    if (!json.success || !json.data) return { price: 0, live: false };

    // API가 공항코드(NRT) 대신 도시코드(TYO)로 키를 반환하는 경우가 있어
    // 응답 data 전체에서 최저가를 추출
    const prices = Object.values(json.data)
      .flatMap((destObj) => Object.values(destObj))
      .map((v) => v.price)
      .filter((p): p is number => typeof p === "number" && p > 0);

    if (prices.length === 0) return { price: 0, live: false };
    return { price: Math.min(...prices), live: true };
  } catch (e) {
    console.warn("[air] fetch failed", slug, e);
    return { price: 0, live: false };
  }
}
