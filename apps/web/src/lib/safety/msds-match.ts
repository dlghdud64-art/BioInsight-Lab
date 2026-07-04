/**
 * §msds-bulk-registration B-P2 (호영님 2026-07-04) — MSDS 문서 → 재고 품목 매칭(순수함수).
 *
 * 업로드된 MSDS 에서 추출한 식별자(CAS/제품명/Cat No.)로 재고 품목을 매칭한다.
 *   우선순위: Cat No.(SKU 유일) > CAS(단일 매칭) > 제품명(fuzzy).
 *   ⚠ CAS·이름은 다중 매칭 가능(같은 CAS·다른 SKU) → ambiguous=true 로 수동 확인 요구(auto 금지).
 *
 * 순수 함수 — DB/네트워크 무의존(단위테스트 용이). canonical 무접촉(매칭 제안만).
 */
import { normalizeCas } from "./cas-ghs-table";

export interface MsdsIdentity {
  casNo?: string | null;
  productName?: string | null;
  catalogNo?: string | null;
}

export interface MatchProduct {
  id: string;
  name: string;
  brand?: string | null;
  catalogNumber?: string | null;
  casNo?: string | null;
}

export interface MsdsMatchCandidate {
  id: string;
  name: string;
  catalogNumber: string | null;
  basis: "catalog" | "cas" | "name";
  confidence: number;
}

export interface MsdsMatchResult {
  /** 단일 고확신 매칭 시 product id, 아니면 null(수동 확인). */
  productId: string | null;
  confidence: number;
  basis: "catalog" | "cas" | "name" | "none";
  /** 다중 후보(수동 확인 필요) 또는 저확신. */
  ambiguous: boolean;
  candidates: MsdsMatchCandidate[];
}

const norm = (s: string | null | undefined): string => (s ?? "").trim().toLowerCase();

function nameScore(a: string, b: string): number {
  const x = norm(a), y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 0.8;
  if (x.includes(y) || y.includes(x)) {
    const ratio = Math.min(x.length, y.length) / Math.max(x.length, y.length);
    return 0.5 + 0.2 * ratio;
  }
  return 0;
}

/**
 * MSDS 식별자 → 재고 품목 매칭. 고확신 단일 매칭이면 productId 세팅, 아니면 candidates + ambiguous.
 */
export function matchMsdsToProducts(identity: MsdsIdentity, products: MatchProduct[]): MsdsMatchResult {
  const none: MsdsMatchResult = { productId: null, confidence: 0, basis: "none", ambiguous: false, candidates: [] };

  // 1) Cat No. (SKU 유일 식별자) — 최우선.
  const cat = norm(identity.catalogNo);
  if (cat) {
    const hits = products.filter((p) => norm(p.catalogNumber) === cat);
    if (hits.length === 1) {
      return { productId: hits[0].id, confidence: 0.98, basis: "catalog", ambiguous: false,
        candidates: [{ id: hits[0].id, name: hits[0].name, catalogNumber: hits[0].catalogNumber ?? null, basis: "catalog", confidence: 0.98 }] };
    }
    if (hits.length > 1) {
      return { productId: null, confidence: 0.98, basis: "catalog", ambiguous: true,
        candidates: hits.slice(0, 5).map((p) => ({ id: p.id, name: p.name, catalogNumber: p.catalogNumber ?? null, basis: "catalog" as const, confidence: 0.98 })) };
    }
  }

  // 2) CAS — 물질 식별자(SKU 아님). 단일 매칭만 auto, 다중은 수동.
  const cas = normalizeCas(identity.casNo);
  if (cas) {
    const hits = products.filter((p) => normalizeCas(p.casNo) === cas);
    if (hits.length === 1) {
      return { productId: hits[0].id, confidence: 0.92, basis: "cas", ambiguous: false,
        candidates: [{ id: hits[0].id, name: hits[0].name, catalogNumber: hits[0].catalogNumber ?? null, basis: "cas", confidence: 0.92 }] };
    }
    if (hits.length > 1) {
      return { productId: null, confidence: 0.92, basis: "cas", ambiguous: true,
        candidates: hits.slice(0, 5).map((p) => ({ id: p.id, name: p.name, catalogNumber: p.catalogNumber ?? null, basis: "cas" as const, confidence: 0.92 })) };
    }
  }

  // 3) 제품명 fuzzy — 항상 후보(auto 금지, 수동 확인).
  const nm = identity.productName;
  if (nm && norm(nm)) {
    const scored = products
      .map((p) => ({ p, s: nameScore(nm, p.name) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 5);
    if (scored.length > 0) {
      return {
        productId: null, // 이름 매칭은 auto 확정 금지
        confidence: scored[0].s,
        basis: "name",
        ambiguous: true,
        candidates: scored.map((x) => ({ id: x.p.id, name: x.p.name, catalogNumber: x.p.catalogNumber ?? null, basis: "name" as const, confidence: Number(x.s.toFixed(2)) })),
      };
    }
  }

  return none;
}
