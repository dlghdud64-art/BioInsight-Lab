// §catalog-A Phase 1 — 조달청 공공데이터 식별 계층 ingest 계약 (호영님 P1, 2026-06-10)
// 순수 함수만. DB write 없음 — canonical(db.product) boundary 침범 금지.
// upsert 실행·페이징 fetch는 Phase 2(ingest job)에서 이 계약을 소비한다.

/** procurement_catalog_ref 1행 (PLAN_catalog-public-ingest §4 Data Model) */
export interface ProcurementRefRow {
  /** 물품식별번호 — 제조사+모델 고유, PK·dedup 키 */
  prdctIdNo: string;
  /** 물품분류번호 (UNSPSC 기반 8자리) */
  prdctClsfcNo: string | null;
  /** 세부물품분류번호 (10자리) */
  dtilPrdctClsfcNo: string | null;
  /** 제조업체명 */
  mfrtNm: string | null;
  /** 품명 */
  prdctNm: string | null;
  /** 세부품명 */
  dtilPrdctNm: string | null;
  /** 영문품명 */
  engPrdctNm: string | null;
  /** 모델명 */
  modelNm: string | null;
  /** provenance — 'public_procurement' 고정 */
  source: "public_procurement";
  /** 승격 hook — 실사용 시에만 db.product FK 주석 (ingest는 절대 set 안 함) */
  linkedProductId: string | null;
  /** 원천 갱신일 (조달청 등록/변경일) */
  sourceUpdatedAt: string | null;
}

/** data.go.kr 품목목록(15129417) 응답 item — 필드 실명은 SCOPING §3-pre 기준 */
export interface ProcurementApiItem {
  prdctIdntNo?: string | null;
  prdctClsfcNo?: string | null;
  dtilPrdctClsfcNo?: string | null;
  mfrtNm?: string | null;
  prdctNm?: string | null;
  dtilPrdctNm?: string | null;
  engPrdctNm?: string | null;
  mdlNm?: string | null;
  rgstDt?: string | null;
}

const trimOrNull = (v: string | null | undefined): string | null => {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : null;
};

/**
 * API item → ref row. 물품식별번호 없으면 null(backbone 밖 — 적재 제외).
 * provenance 고정, linkedProductId는 항상 null(승격은 별도 명시 경로).
 */
export function transformProcurementItem(item: ProcurementApiItem): ProcurementRefRow | null {
  const prdctIdNo = trimOrNull(item.prdctIdntNo);
  if (!prdctIdNo) return null;
  return {
    prdctIdNo,
    prdctClsfcNo: trimOrNull(item.prdctClsfcNo),
    dtilPrdctClsfcNo: trimOrNull(item.dtilPrdctClsfcNo),
    mfrtNm: trimOrNull(item.mfrtNm),
    prdctNm: trimOrNull(item.prdctNm),
    dtilPrdctNm: trimOrNull(item.dtilPrdctNm),
    engPrdctNm: trimOrNull(item.engPrdctNm),
    modelNm: trimOrNull(item.mdlNm),
    source: "public_procurement",
    linkedProductId: null,
    sourceUpdatedAt: trimOrNull(item.rgstDt),
  };
}

/** prisma upsert 인자 형태 (Phase 2가 db.procurementCatalogRef.upsert에 그대로 전달) */
export interface RefUpsertArgs {
  where: { prdctIdNo: string };
  create: ProcurementRefRow;
  update: Omit<ProcurementRefRow, "prdctIdNo" | "linkedProductId" | "source">;
}

/**
 * Idempotent upsert 인자 — by 물품식별번호.
 * update에 linkedProductId·source 미포함: 재ingest가 승격 link/provenance를 덮지 않음.
 */
export function buildRefUpsertArgs(row: ProcurementRefRow): RefUpsertArgs {
  const { prdctIdNo, linkedProductId: _l, source: _s, ...mutable } = row;
  return {
    where: { prdctIdNo },
    create: { ...row, linkedProductId: null },
    update: mutable,
  };
}

/** dedup 매칭 결과 — exact만 auto-link, 그 외는 후보 주석(merge 금지) */
export type RefProductMatch =
  | { kind: "auto-link"; productId: string }
  | { kind: "candidate"; productId: string }
  | null;

export interface ProductMatchTarget {
  id: string;
  name: string | null;
  brand: string | null;
  manufacturer: string | null;
  modelNumber: string | null;
}

/** 정규화: 소문자 + 공백 압축 (오병합 방지를 위해 이 이상 느슨하게 만들지 말 것) */
const norm = (v: string | null | undefined): string =>
  (v ?? "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * ref → canonical product 매칭.
 * - auto-link: 제조사(manufacturer|brand) AND 모델명 정규화 exact 동시 일치만.
 * - candidate: 모델명만 일치 또는 제조사+품명 부분 일치 — 주석/제안용, merge 안 함.
 * - 웰호류 차단: fuzzy를 auto로 승격하는 분기 추가 금지.
 */
export function matchRefToProduct(
  ref: ProcurementRefRow,
  products: ProductMatchTarget[],
): RefProductMatch {
  const refMfr = norm(ref.mfrtNm);
  const refModel = norm(ref.modelNm);

  if (refMfr && refModel) {
    const exact = products.find((p) => {
      const pMfr = norm(p.manufacturer) || norm(p.brand);
      return pMfr === refMfr && norm(p.modelNumber) === refModel;
    });
    if (exact) return { kind: "auto-link", productId: exact.id };
  }

  if (refModel) {
    const modelOnly = products.find((p) => norm(p.modelNumber) === refModel);
    if (modelOnly) return { kind: "candidate", productId: modelOnly.id };
  }

  if (refMfr && ref.prdctNm) {
    const fuzzy = products.find((p) => {
      const pMfr = norm(p.manufacturer) || norm(p.brand);
      return pMfr === refMfr && norm(p.name).includes(norm(ref.prdctNm));
    });
    if (fuzzy) return { kind: "candidate", productId: fuzzy.id };
  }

  return null;
}
