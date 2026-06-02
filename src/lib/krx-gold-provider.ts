// KRX 금시장 종가 — 금융위원회_일반상품시세정보 (data.go.kr)
// 엔드포인트: GetGeneralProductInfoService/getGoldPriceInfo
// 갱신: 영업일 익일 13시 이후 (실시간 X)
// 데이터: 금99.99K_1g / 100g / 1kg 일별 종가·거래량
//
// 한국 시세는 부가세 + 매수/매도 호가 영향이 있어 LBMA(국제) 시세보다 약간 비쌈.
// 진짜 "한국 사람이 KRX에서 사는 가격"에 가까움.

const KEY = process.env.EXPO_PUBLIC_DATA_GO_KR_KEY;
const BASE =
  "https://apis.data.go.kr/1160100/service/GetGeneralProductInfoService";

export type KrxGoldPoint = {
  date: string;  // YYYY-MM-DD
  close: number; // 원/g (1g 종목 종가)
  volume?: number;
  isinCd?: string;
  itemName?: string;
};

type DataGoKrItem = {
  basDt?: string;       // YYYYMMDD
  srtnCd?: string;
  isinCd?: string;
  itmsNm?: string;      // "금99.99K_1g"
  clpr?: string;        // 종가
  vs?: string;
  fltRt?: string;
  mkp?: string;
  hipr?: string;
  lopr?: string;
  trqu?: string;        // 거래량
  trPrc?: string;
};

type DataGoKrResponse = {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: {
      items?: { item?: DataGoKrItem[] | DataGoKrItem };
      numOfRows?: number;
      pageNo?: number;
      totalCount?: number;
    };
  };
};

// 지난 N일 KRX 금시장 1g 종가 시계열 (영업일만)
// 종목명 예시(2026 기준):
//   "금 99.99_1kg" — 1kg 단위 거래, clpr이 g당 가격
//   "미니금 99.99_100g" — 100g 단위, clpr도 g당
// 둘 다 g당이므로 1kg 종목(거래량 더 큼)을 표준으로.
export async function getKrxGoldDaily(
  days = 365,
  itemName = "금 99.99_1kg",
): Promise<KrxGoldPoint[] | null> {
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
      likeItmsNm: itemName, // 부분 일치 (공백·표기 변동 흡수)
    });
    const url = `${BASE}/getGoldPriceInfo?${params.toString()}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[krx-gold] HTTP ${res.status}`);
      return null;
    }
    const json = (await res.json()) as DataGoKrResponse;
    const code = json.response?.header?.resultCode;
    if (code !== "00") {
      console.warn(`[krx-gold] result ${code}: ${json.response?.header?.resultMsg}`);
      return null;
    }
    const raw = json.response?.body?.items?.item;
    const items: DataGoKrItem[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const points: KrxGoldPoint[] = [];
    for (const it of items) {
      const close = Number(it.clpr);
      if (!Number.isFinite(close) || close <= 0) continue;
      if (!it.basDt || it.basDt.length !== 8) continue;
      const date = `${it.basDt.slice(0, 4)}-${it.basDt.slice(4, 6)}-${it.basDt.slice(6, 8)}`;
      points.push({
        date,
        close: Math.round(close * 100) / 100,
        volume: Number(it.trqu) || undefined,
        isinCd: it.isinCd,
        itemName: it.itmsNm,
      });
    }
    return points.sort((a, b) => a.date.localeCompare(b.date));
  } catch (e) {
    console.warn("[krx-gold] error", e);
    return null;
  }
}

export async function getKrxGoldLatest(): Promise<KrxGoldPoint | null> {
  const list = await getKrxGoldDaily(10); // 최근 10일 (휴장일 고려)
  if (!list || list.length === 0) return null;
  return list[list.length - 1];
}

export function isAvailable(): boolean {
  return Boolean(KEY);
}

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}
