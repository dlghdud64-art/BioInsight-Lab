/**
 * §11.37x(c) — 소싱 라벨 스캔 → 검색 query resolve (순수함수)
 *
 * read-only: 네트워크/mutation 0. 라벨 검토(LabelForm) 값에서 검색어만 도출.
 * 우선순위: catalogNumber(정확 매칭 기대) → productName → null(빈 검색 차단).
 * GTIN 은 검색 query 미사용 — 카탈로그 GTIN 필드 부재(§gs1-datamatrix)라
 * 매칭 무효, 표시용 한정. GTIN→제품 매칭은 catalog A 트랙 후속.
 */

export interface SourcingSearchSeed {
  catalogNumber?: string | null;
  productName?: string | null;
}

export function resolveSourcingSearchQuery(seed: SourcingSearchSeed): string | null {
  const catalog = seed.catalogNumber?.trim();
  if (catalog) return catalog;
  const name = seed.productName?.trim();
  if (name) return name;
  return null;
}
