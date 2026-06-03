import { getCachedEnvelope, setCached } from "./cache";
import { cachedFetch } from "./fetch-cache";

// 금 시세 — CoinGecko의 PAX Gold(PAXG: 1토큰 = 1 troy oz 금, LBMA 추종 1:1) 활용.
// 무료·무키. 한국 KRX 금시장 종가는 별도(공공데이터포털 키 필요) — 추후.
// 약간의 토큰 프리미엄/디스카운트는 있을 수 있으나 국제 금 현물가에 가장 근접한 무료 소스.

const TROY_OZ_GRAMS = 31.1034768;

export type GoldLatest = {
  pricePerGramKrw: number;
  pricePerOzUsd: number;
  pricePerOzKrw: number;
  live: boolean;
  fetchedAt?: number; // 실데이터 fetch 성공 시각(ms). 오프라인 fallback이면 캐시 기록 시각.
};

export function getGoldLatest(): Promise<GoldLatest> {
  return cachedFetch("gold:paxg", fetchGoldLatestUncached);
}

async function fetchGoldLatestUncached(): Promise<GoldLatest> {
  const cacheKey = "cache:gold";
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd,krw",
    );
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
    const json = (await res.json()) as {
      "pax-gold"?: { usd?: number; krw?: number };
    };
    const usdOz = Number(json["pax-gold"]?.usd);
    const krwOz = Number(json["pax-gold"]?.krw);
    if (!Number.isFinite(krwOz) || krwOz <= 0) throw new Error("no price");
    const result: GoldLatest = {
      pricePerOzUsd: Math.round(usdOz * 100) / 100,
      pricePerOzKrw: Math.round(krwOz),
      pricePerGramKrw: Math.round(krwOz / TROY_OZ_GRAMS),
      live: true,
      fetchedAt: Date.now(),
    };
    await setCached(cacheKey, result);
    return result;
  } catch {
    // 네트워크 실패 시 마지막 성공 데이터(영구 캐시) → 없으면 합성 폴백.
    const cached = await getCachedEnvelope<GoldLatest>(cacheKey);
    if (cached) return { ...cached.data, live: false, fetchedAt: cached.ts };
    return {
      pricePerOzUsd: 2700,
      pricePerOzKrw: 3700000,
      pricePerGramKrw: 119000,
      live: false,
    };
  }
}
