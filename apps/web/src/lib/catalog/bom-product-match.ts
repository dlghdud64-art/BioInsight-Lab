// §catalog-A P3c — BOM reagent ↔ Product 매칭 응답 머신 (순수). 호영님 P-track 2026-06-12
//   route 가 batch findMany 한 Product 를 BOM matchedProduct shape 로 투영 + isHighRisk 서버 계산.
//   안전정보(hazardCodes/pictograms/safetyNote)는 Product 보유분 —
//   기존 BOM 은 /api/products/search 응답에서 이 필드를 못 받아 항상 falsy(dead) 였음.
//   batch-match 가 select 에 포함 + 본 머신이 서버 계산 → BOM 위험물질 표시 복구.
//   ⚠️ 순수 함수만 — DB write 0, canonical(db.product) 읽기 결과의 투영.

export const HIGH_RISK_PICTOGRAMS = ["skull", "flame", "corrosive"] as const;

/**
 * 위험물질 판정 — hazardCodes 1건 이상 또는 고위험 피크토그램(해골/화염/부식) 포함.
 * Json? 필드라 unknown 방어(배열 아니면 빈 배열 취급).
 */
export function computeIsHighRisk(hazardCodes: unknown, pictograms: unknown): boolean {
  const h = Array.isArray(hazardCodes) ? hazardCodes : [];
  const p = Array.isArray(pictograms) ? pictograms : [];
  const risky: readonly string[] = HIGH_RISK_PICTOGRAMS;
  return h.length > 0 || p.some((x) => typeof x === "string" && risky.includes(x));
}

/** batch findMany 결과의 부분집합(BOM 매칭에 필요한 최소 필드) */
export interface BomProductForMatch {
  id: string;
  name: string;
  hazardCodes: unknown;
  pictograms: unknown;
  safetyNote: string | null;
  vendors: Array<{
    vendor: { name: string } | null;
    priceInKRW: number | null;
    currency: string | null;
  }>;
}

/** BOM matchedProduct shape (page.tsx ProductMatch 정합) */
export interface BomMatchCandidate {
  productId: string;
  productName: string;
  vendorName: string | null;
  price: number;
  currency: string;
  isHighRisk: boolean;
  hazardCodes: string[];
  safetyNote?: string;
}

/** Product → BOM 후보 투영. vendor 는 최저가(route orderBy priceInKRW asc) 첫 건. */
export function toBomCandidate(p: BomProductForMatch): BomMatchCandidate {
  const vendor = p.vendors?.[0];
  return {
    productId: p.id,
    productName: p.name,
    vendorName: vendor?.vendor?.name ?? null,
    price: vendor?.priceInKRW ?? 0,
    currency: vendor?.currency ?? "KRW",
    isHighRisk: computeIsHighRisk(p.hazardCodes, p.pictograms),
    hazardCodes: Array.isArray(p.hazardCodes) ? (p.hazardCodes as string[]) : [],
    safetyNote: p.safetyNote ?? undefined,
  };
}
