// KRX 금시장 종가 — 한국거래소 금시장 99.99K 1g 일별 종가.
// 출처: data.go.kr / KRX 정보데이터시스템 (공공데이터포털 신청 필요).
//
// 현재 상태: 인프라 골격. EXPO_PUBLIC_DATA_GO_KR_KEY 발급받으면 활성화.
// 키 없으면 null 반환 → 호출 측은 CoinGecko PAXG로 폴백.
//
// 한국 시세는 국제 시세 + 부가세 10% + 소매 마진을 반영하므로
// LBMA보다 약간 비쌈. 진짜 "한국 사람이 사는 가격"에 가까움.

const KEY = process.env.EXPO_PUBLIC_DATA_GO_KR_KEY;

export type KrxGoldPoint = {
  date: string; // YYYY-MM-DD
  closeKrwPerGram: number;
};

// 일별 시계열 fetch (지난 N일)
// TODO: 키 발급 후 실 엔드포인트 연결.
// 후보:
//   1) data.go.kr "한국거래소_KRX 시세정보" 일별 (종목 코드 필요)
//   2) KRX 정보데이터시스템 (bld=dbms/MDC/STAT/standard/MDCSTAT13501)
export async function getKrxGoldDaily(days: number): Promise<KrxGoldPoint[] | null> {
  if (!KEY) return null;
  // 실제 호출은 키 발급 후 작성.
  // 예시 스켈레톤:
  // const url = `https://apis.data.go.kr/.../gold?serviceKey=${KEY}&pageNo=1&numOfRows=${days}&_type=json`;
  // const res = await fetch(url);
  // ...
  return null;
}

export function isAvailable(): boolean {
  return Boolean(KEY);
}
