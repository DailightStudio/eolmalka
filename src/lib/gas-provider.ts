// 오피넷 OpenAPI — 전국 평균 유가.
// 무료 키 발급 후 OPINET_API_KEY 세팅. 키 없으면 합성 폴백.
// 응답 형식: { RESULT: { OIL: [{ TRADE_DT, PRODCD, PRODNM, PRICE }, ...] } }
// PRODCD: B027=휘발유, D047=경유, B034=고급휘발유, C004=자동차용부탄(LPG), K015=실내등유

const KEY = process.env.OPINET_API_KEY;
const BASE = "https://www.opinet.co.kr/api";

export type GasProduct = "B027" | "D047" | "B034" | "C004" | "K015";

export type GasLatest = {
  product: GasProduct;
  price: number;     // 원/L
  tradeDate: string; // YYYYMMDD
  live: boolean;
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

// 가장 최근 전국 평균 (시간당 캐싱 — 오피넷은 일 1회 갱신이라 충분)
export async function getGasLatest(
  product: GasProduct = "B027",
): Promise<GasLatest> {
  if (!KEY) return synthetic(product);
  try {
    const url = `${BASE}/avgRecentPrice.do?code=${KEY}&out=json`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as OpinetResponse;
    const rows = json.RESULT?.OIL ?? [];
    const row = rows.find((r) => r.PRODCD === product);
    if (!row || row.PRICE === undefined) throw new Error("no row");
    const price = Number(row.PRICE);
    if (!Number.isFinite(price) || price <= 0) throw new Error("bad price");
    return {
      product,
      price: Math.round(price * 100) / 100,
      tradeDate: row.TRADE_DT ?? today(),
      live: true,
    };
  } catch {
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
