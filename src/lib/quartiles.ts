// dd-trip/packages/shared/src/price.ts 에서 포팅.
// 시계열 분포에 대한 분위수 판정 — "지금이 싼가/비싼가"를 통계로 정직하게.
// 투자 권유 X, 참고용 신호. 환율·항공권·금 등 어떤 카테고리든 공용.

export interface PriceQuartiles {
  minimum: number;
  first: number;   // 1사분위 (25%)
  median: number;  // 중앙값 (50%)
  third: number;   // 3사분위 (75%)
  maximum: number;
}

export type PriceVerdict =
  | "great_deal" // 1사분위 이하 — 역대급 저점권
  | "good"       // 중앙값 이하
  | "average"    // 중앙값~3사분위
  | "high";      // 3사분위 초과

export function quartilesOf(values: number[]): PriceQuartiles {
  if (values.length === 0) throw new Error("quartilesOf: 빈 배열");
  const s = [...values].sort((a, b) => a - b);
  const q = (p: number): number => {
    const idx = (s.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return s[lo]!;
    return s[lo]! + (s[hi]! - s[lo]!) * (idx - lo);
  };
  return {
    minimum: s[0]!,
    first: q(0.25),
    median: q(0.5),
    third: q(0.75),
    maximum: s[s.length - 1]!,
  };
}

export function verdictFromQuartiles(
  price: number,
  q: PriceQuartiles,
): PriceVerdict {
  if (price <= q.first) return "great_deal";
  if (price <= q.median) return "good";
  if (price <= q.third) return "average";
  return "high";
}

export const VERDICT_LABEL: Record<PriceVerdict, string> = {
  great_deal: "역대급 저점권",
  good: "평균보다 저렴",
  average: "평균 범위",
  high: "평균보다 비쌈",
};
