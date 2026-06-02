// 석유전자상거래시장 (B2B 도매) 일별 종가 — data.go.kr GetGeneralProductInfoService.
// 오피넷(소매 평균) 과 다른 출처(도매)지만 시계열 트렌드는 거의 동일.
// 오피넷이 일별 시계열 안 주므로, 휘발유 1Y 시계열의 대체 후보.
// 다만 종목명이 휘발유/경유 등으로 나뉘므로 itmsNm 매핑 필요.

const KEY = process.env.EXPO_PUBLIC_DATA_GO_KR_KEY;
const BASE =
  "https://apis.data.go.kr/1160100/service/GetGeneralProductInfoService";

export type KrxOilPoint = {
  date: string;
  close: number;
  itemName?: string;
};

type Item = {
  basDt?: string;
  itmsNm?: string;
  clpr?: string;
};

export async function getKrxOilDaily(
  days = 365,
  // 휘발유 도매 (석유전자상거래시장) — 정확한 종목명은 활성화 후 확인 필요
  itemName = "휘발유",
): Promise<KrxOilPoint[] | null> {
  if (!KEY) return null;
  try {
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400000);
    const params = new URLSearchParams({
      serviceKey: KEY,
      resultType: "json",
      pageNo: "1",
      numOfRows: String(Math.min(days + 30, 1000)),
      beginBasDt: ymd(start),
      endBasDt: ymd(end),
      likeItmsNm: itemName, // 종목명 포함 검색
    });
    const url = `${BASE}/getOilPriceInfo?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      response?: { body?: { items?: { item?: Item[] | Item } } };
    };
    const raw = json.response?.body?.items?.item;
    const items: Item[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const points: KrxOilPoint[] = [];
    for (const it of items) {
      const close = Number(it.clpr);
      if (!Number.isFinite(close) || close <= 0) continue;
      if (!it.basDt || it.basDt.length !== 8) continue;
      points.push({
        date: `${it.basDt.slice(0, 4)}-${it.basDt.slice(4, 6)}-${it.basDt.slice(6, 8)}`,
        close: Math.round(close * 100) / 100,
        itemName: it.itmsNm,
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
