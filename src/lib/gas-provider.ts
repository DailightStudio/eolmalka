// 오피넷 OpenAPI — 전국 평균 유가.
// 무료 키 발급 후 OPINET_API_KEY 세팅. 키 없으면 합성 폴백.
// 응답 형식: { RESULT: { OIL: [{ TRADE_DT, PRODCD, PRODNM, PRICE }, ...] } }
// PRODCD: B027=휘발유, D047=경유, B034=고급휘발유, C004=자동차용부탄(LPG), K015=실내등유

import { getCachedEnvelope, setCached } from "./cache";
import { cachedFetch } from "./fetch-cache";

// Expo: process.env.EXPO_PUBLIC_* 만 클라이언트 번들에 박힌다.
const KEY = process.env.EXPO_PUBLIC_OPINET_API_KEY;
const BASE = "https://www.opinet.co.kr/api";

export type GasProduct = "B027" | "D047" | "B034" | "C004" | "K015";

export type GasLatest = {
  product: GasProduct;
  price: number;     // 원/L
  tradeDate: string; // YYYYMMDD
  live: boolean;
  fetchedAt?: number; // 실데이터 fetch 성공 시각(ms). 오프라인 fallback이면 캐시 기록 시각.
};

type OpinetRow = {
  TRADE_DT?: string;
  PRODCD?: string;
  PRODNM?: string;
  PRICE?: string | number;
};

type OpinetResponse = {
  RESULT?: { OIL?: OpinetRow[] };
};

// 가장 최근 전국 평균 (1h 캐싱 — 오피넷은 일 1회 갱신이라 충분)
export function getGasLatest(product: GasProduct = "B027"): Promise<GasLatest> {
  return cachedFetch(`gas:${product}`, () => fetchGasLatestUncached(product));
}

async function fetchGasLatestUncached(product: GasProduct): Promise<GasLatest> {
  if (!KEY) return synthetic(product);
  const cacheKey = `cache:gas:${product}`;
  try {
    const url = `${BASE}/avgRecentPrice.do?code=${KEY}&out=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as OpinetResponse;
    const rows = json.RESULT?.OIL ?? [];
    const row = rows.find((r) => r.PRODCD === product);
    if (!row || row.PRICE === undefined) throw new Error("no row");
    const price = Number(row.PRICE);
    if (!Number.isFinite(price) || price <= 0) throw new Error("bad price");
    const result: GasLatest = {
      product,
      price: Math.round(price * 100) / 100,
      tradeDate: row.TRADE_DT ?? today(),
      live: true,
      fetchedAt: Date.now(),
    };
    await setCached(cacheKey, result);
    return result;
  } catch {
    // 네트워크 실패 시 마지막 성공 데이터(영구 캐시) 사용.
    const cached = await getCachedEnvelope<GasLatest>(cacheKey);
    if (cached) return { ...cached.data, live: false, fetchedAt: cached.ts };
    return synthetic(product);
  }
}

function synthetic(product: GasProduct): GasLatest {
  // 합성 폴백 — 카테고리 페이지가 항상 동작하도록
  const base = product === "B027" ? 1652 : product === "D047" ? 1532 : 1100;
  return { product, price: base, tradeDate: today(), live: false };
}

function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

// ── 시도별 평균 ─────────────────────────────────────────
// 오피넷 avgSidoPrice — 17개 시도의 휘발유/경유 평균가
const SIDO_CODES: Record<string, string> = {
  "01": "서울",
  "02": "경기",
  "03": "강원",
  "04": "충북",
  "05": "충남",
  "06": "전북",
  "07": "전남",
  "08": "경북",
  "09": "경남",
  "10": "부산",
  "11": "제주",
  "12": "대구",
  "13": "인천",
  "14": "광주",
  "15": "대전",
  "16": "울산",
  "17": "세종",
};

export type SidoPrice = {
  sido: string;
  code: string;
  price: number;
};

type SidoRow = {
  SIDOCD?: string;
  SIDONM?: string;
  PRICE?: string | number;
  PRODCD?: string;
};

export function getSidoPrices(product: GasProduct = "B027"): Promise<SidoPrice[]> {
  return cachedFetch(`gas-sido:${product}`, () => fetchSidoUncached(product));
}

async function fetchSidoUncached(product: GasProduct): Promise<SidoPrice[]> {
  if (!KEY) return [];
  try {
    const url = `${BASE}/avgSidoPrice.do?code=${KEY}&prodcd=${product}&out=json`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = (await res.json()) as { RESULT?: { OIL?: SidoRow[] } };
    const rows = json.RESULT?.OIL ?? [];
    return rows
      .map((r) => {
        const price = Number(r.PRICE);
        const code = r.SIDOCD ?? "";
        if (!Number.isFinite(price) || price <= 0) return null;
        return {
          sido: r.SIDONM ?? SIDO_CODES[code] ?? code,
          code,
          price: Math.round(price * 100) / 100,
        };
      })
      .filter((x): x is SidoPrice => x !== null)
      .sort((a, b) => a.price - b.price);
  } catch {
    return [];
  }
}

// ── 시군구별 평균 ───────────────────────────────────────
// 오피넷 avgSiGunGuPrice — 특정 시도의 시군구 평균가
export type SiGunGuPrice = {
  sigungu: string;
  code: string;
  price: number;
};

type SgRow = {
  SIGUNCD?: string;
  SIGUNNM?: string;
  PRICE?: string | number;
};

export function getSiGunGuPrices(
  sidoCode: string,
  product: GasProduct = "B027",
): Promise<SiGunGuPrice[]> {
  return cachedFetch(`gas-sigungu:${sidoCode}:${product}`, () =>
    fetchSiGunGuUncached(sidoCode, product),
  );
}

async function fetchSiGunGuUncached(
  sidoCode: string,
  product: GasProduct,
): Promise<SiGunGuPrice[]> {
  if (!KEY || !sidoCode) return [];
  try {
    const url = `${BASE}/avgSiGunGuPrice.do?code=${KEY}&sido=${sidoCode}&prodcd=${product}&out=json`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = (await res.json()) as { RESULT?: { OIL?: SgRow[] } };
    const rows = json.RESULT?.OIL ?? [];
    return rows
      .map((r) => {
        const price = Number(r.PRICE);
        const code = r.SIGUNCD ?? "";
        if (!Number.isFinite(price) || price <= 0) return null;
        return {
          sigungu: r.SIGUNNM ?? code,
          code,
          price: Math.round(price * 100) / 100,
        };
      })
      .filter((x): x is SiGunGuPrice => x !== null)
      .sort((a, b) => a.price - b.price);
  } catch {
    return [];
  }
}
