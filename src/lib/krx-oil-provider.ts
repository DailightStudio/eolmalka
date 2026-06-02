// 석유전자상거래시장(도매) 일별 평균가 — data.go.kr 금융위원회_일반상품시세정보.
// 엔드포인트: GetGeneralProductInfoService/getOilPriceInfo
// 응답 schema: { basDt, oilCtg(휘발유/경유/등유), wtAvgPrcCptn, wtAvgPrcDisc, trqu, trPrc }
// - wtAvgPrcCptn: 경쟁매매 가중평균가
// - wtAvgPrcDisc: 상대매매(협의) 가중평균가 (실거래 위주, 더 안정적)
//
// 도매가라 오피넷(소매)와 절대값은 다르지만 시계열 트렌드는 거의 동일.
// → 휘발유 1Y 시계열 보완용 (오피넷은 일별 시계열 안 줌).

import { cachedFetch } from "./fetch-cache";

const KEY = process.env.EXPO_PUBLIC_DATA_GO_KR_KEY;
const BASE =
  "https://apis.data.go.kr/1160100/service/GetGeneralProductInfoService";

export type OilCategory = "휘발유" | "경유" | "등유";

export type KrxOilPoint = {
  date: string;
  close: number; // 원/L (wtAvgPrcDisc)
  oilCtg: OilCategory;
};

type Item = {
  basDt?: string;
  oilCtg?: string;
  wtAvgPrcCptn?: string | number;
  wtAvgPrcDisc?: string | number;
};

export function getKrxOilDaily(
  days = 365,
  oilCtg: OilCategory = "휘발유",
): Promise<KrxOilPoint[] | null> {
  return cachedFetch(`krx-oil:${oilCtg}:${days}`, () =>
    fetchKrxOilDailyUncached(days, oilCtg),
  );
}

async function fetchKrxOilDailyUncached(
  days: number,
  oilCtg: OilCategory,
): Promise<KrxOilPoint[] | null> {
  if (!KEY) return null;
  try {
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400000);
    // 3종(휘발유/경유/등유)이 같이 나오므로 약 3배 + 여유분
    const params = new URLSearchParams({
      serviceKey: KEY,
      resultType: "json",
      pageNo: "1",
      numOfRows: String(Math.min(days * 3 + 60, 5000)),
      beginBasDt: ymd(start),
      endBasDt: ymd(end),
    });
    const url = `${BASE}/getOilPriceInfo?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      response?: {
        header?: { resultCode?: string };
        body?: { items?: { item?: Item[] | Item } };
      };
    };
    if (json.response?.header?.resultCode !== "00") return null;
    const raw = json.response?.body?.items?.item;
    const items: Item[] = Array.isArray(raw) ? raw : raw ? [raw] : [];

    const points: KrxOilPoint[] = [];
    for (const it of items) {
      if (it.oilCtg !== oilCtg) continue;
      const close = Number(it.wtAvgPrcDisc);
      if (!Number.isFinite(close) || close <= 0) continue;
      if (!it.basDt || it.basDt.length !== 8) continue;
      points.push({
        date: `${it.basDt.slice(0, 4)}-${it.basDt.slice(4, 6)}-${it.basDt.slice(6, 8)}`,
        close: Math.round(close * 100) / 100,
        oilCtg: oilCtg,
      });
    }
    return points.sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return null;
  }
}

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}
