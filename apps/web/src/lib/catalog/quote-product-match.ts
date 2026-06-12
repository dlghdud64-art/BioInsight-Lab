// #catalog-spec-backfill ①-b Phase 1 — 견적 파싱 item↔Product 매칭 계약 (호영님 P-track, 2026-06-11)
// 순수 함수만. DB write 없음 — canonical(db.product) boundary 침범 금지.
// 매칭키: catalogNumber exact = 강신호, productName fuzzy = 약신호(candidate).
//         specification 은 매칭키 아님(승격 payload).
// 게이트 철학: 놓침(누락) << 오매칭(canonical 오염). exact 단일일치만 auto.
//
// ⚠️ Phase 1 = 계약/시그니처 scaffolding (stub). 실제 tier 로직은 Phase 2 GREEN.

/** 견적 파싱 line item 중 매칭에 쓰는 최소 필드 (ParsedQuoteLineItem 부분집합) */
export interface QuoteMatchInput {
  /** 제품명 (약신호 — fuzzy candidate 전용) */
  productName: string | null;
  /** 카탈로그 번호 (강신호 — exact 매칭키) */
  catalogNumber: string | null;
  /** 규격 — 승격 payload. 매칭키로 쓰지 말 것. */
  specification: string | null;
}

/** 매칭 대상 canonical Product 후보 (DB 후보 fetch 결과의 부분집합) */
export interface QuoteProductTarget {
  id: string;
  name: string | null;
  catalogNumber: string | null;
  modelNumber: string | null;
}

/** 매칭 신뢰도 등급 */
export type QuoteMatchTier = "exact" | "candidate" | "none";

/** 매칭 결과 — exact=1건, candidate=N건, none=0건 */
export interface QuoteMatchResult {
  tier: QuoteMatchTier;
  matches: QuoteProductTarget[];
}

/**
 * 정규화: 소문자 + 공백 압축만 (procurement-ref `norm` 동형 엄격도).
 * ⚠️ 이 이상 느슨화 금지 — 오매칭 비용 > 누락 비용.
 */
export const normMatchKey = (v: string | null | undefined): string =>
  (v ?? "").toLowerCase().replace(/\s+/g, " ").trim();

/** ② PATCH specification 최대 길이 (route zod .max(200) 정합) */
export const SPEC_MAX_LEN = 200;

/** 승격용 spec 클램프 — 초과 시 조용한 절단 금지, 거부 사유 반환 */
export interface SpecPromotionCheck {
  ok: boolean;
  value: string | null;
  reason?: "too_long" | "empty";
}

/**
 * 승격용 spec 클램프 — 조용한 절단 금지.
 * - null/공백 → 거부(empty)
 * - SPEC_MAX_LEN 초과 → 거부(too_long), 절단하지 않음(파싱 오류·노이즈 적재 차단)
 * - 정상 → trim 값 보존
 */
export function clampSpecForPromotion(spec: string | null): SpecPromotionCheck {
  const trimmed = (spec ?? "").trim();
  if (trimmed.length === 0) return { ok: false, value: null, reason: "empty" };
  if (trimmed.length > SPEC_MAX_LEN) return { ok: false, value: null, reason: "too_long" };
  return { ok: true, value: trimmed };
}

/**
 * 견적 item → canonical Product 매칭.
 * - exact: catalogNumber 정규화 == Product.catalogNumber|modelNumber, **단일** 일치만.
 * - candidate: catalog 복수 일치 / catalog 무일치 시 productName fuzzy → 후보(merge 금지).
 * - none: 무일치 → CTA 미노출(오적재 차단).
 *
 * 게이트: catalog exact 단일일치만 auto(exact). 그 외 전부 사람 게이트(candidate) 또는 none.
 * specification 은 읽지 않음(매칭키 아님).
 */
export function matchQuoteItemToProduct(
  item: QuoteMatchInput,
  products: QuoteProductTarget[],
): QuoteMatchResult {
  const catKey = normMatchKey(item.catalogNumber);

  // 1. 강신호: catalogNumber exact (→ Product.catalogNumber | modelNumber)
  if (catKey) {
    const catMatches = products.filter(
      (p) => normMatchKey(p.catalogNumber) === catKey || normMatchKey(p.modelNumber) === catKey,
    );
    if (catMatches.length === 1) return { tier: "exact", matches: catMatches };
    if (catMatches.length >= 2) return { tier: "candidate", matches: catMatches };
    // length 0 → name fuzzy 로 폴백
  }

  // 2. 약신호: productName fuzzy → candidate (auto 승격 금지)
  const nameKey = normMatchKey(item.productName);
  if (nameKey) {
    const fuzzy = products.filter((p) => {
      const n = normMatchKey(p.name);
      return n.length > 0 && (n.includes(nameKey) || nameKey.includes(n));
    });
    if (fuzzy.length >= 1) return { tier: "candidate", matches: fuzzy };
  }

  // 3. 무일치 → none (CTA 미노출, 오적재 차단)
  return { tier: "none", matches: [] };
}
