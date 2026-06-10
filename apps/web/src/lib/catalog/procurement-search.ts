// §catalog-A Phase 3 — ref 검색 + 승격 매핑 (호영님 P1, 2026-06-10)
// 순수 함수만. ref = projection(not truth). 승격 INSERT input 생성만 — 실행은
// /api/catalog/promote(별도 명시 경로) 단 1곳.

import type { ProcurementRefRow } from "@/lib/catalog/procurement-ref";

/** prisma 조회 결과(source: string)도 받는 구조적 입력 타입 */
export type RefLike = Omit<ProcurementRefRow, "source"> & { source: string };

/**
 * ref 검색 where — 미승격(linkedProductId null)만.
 * 승격된 ref는 canonical product가 본 검색에 잡히므로 제외(중복 노출 0).
 */
export function buildRefSearchWhere(query: string) {
  const contains = { contains: query, mode: "insensitive" as const };
  return {
    linkedProductId: null,
    OR: [
      { prdctNm: contains },
      { dtilPrdctNm: contains },
      { engPrdctNm: contains },
      { modelNm: contains },
      { mfrtNm: contains },
      { prdctIdNo: contains },
    ],
  };
}

/** 검색 응답용 최소 projection — overfetch 금지(§8-C), provenance 명시 */
export interface RefSearchItem {
  prdctIdNo: string;
  name: string;
  nameEn: string | null;
  brand: string | null;
  modelNm: string | null;
  prdctClsfcNo: string | null;
  source: "public_procurement";
}

export function toRefSearchItem(ref: RefLike): RefSearchItem {
  return {
    prdctIdNo: ref.prdctIdNo,
    name: ref.dtilPrdctNm ?? ref.prdctNm ?? ref.modelNm ?? ref.prdctIdNo,
    nameEn: ref.engPrdctNm,
    brand: ref.mfrtNm,
    modelNm: ref.modelNm,
    prdctClsfcNo: ref.prdctClsfcNo,
    source: "public_procurement",
  };
}

/** UNSPSC Segment → ProductCategory (Seg 12=시약, 41=실험장비, 그 외 보수적 EQUIPMENT) */
function categoryFromClsfc(clsfcNo: string | null): "REAGENT" | "EQUIPMENT" {
  if (clsfcNo?.startsWith("12")) return "REAGENT";
  return "EQUIPMENT";
}

/**
 * demand-driven 승격 — db.product INSERT input.
 * 실행처는 /api/catalog/promote 1곳뿐(canonical 별도 명시 경로). 여기선 input만.
 */
export function refToProductCreateInput(ref: RefLike) {
  return {
    name: ref.dtilPrdctNm ?? ref.prdctNm ?? ref.modelNm ?? ref.prdctIdNo,
    nameEn: ref.engPrdctNm,
    description: `공공조달 물품목록(물품식별번호 ${ref.prdctIdNo}) 참조로 등록된 제품입니다.`,
    category: categoryFromClsfc(ref.prdctClsfcNo),
    brand: ref.mfrtNm,
    manufacturer: ref.mfrtNm,
    modelNumber: ref.modelNm,
  } as const;
}
