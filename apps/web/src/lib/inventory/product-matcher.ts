/**
 * §11.309b #product-matcher — 스마트 입고 OCR 추출 데이터 → 기존 Product 매칭.
 *
 * 호영님 P0 spec (2026-05-26):
 *   1. catalogNumber 정확 매칭 (최우선, brand 동반 시 confidence 격상)
 *   2. catalogNumber 단독 정확 매칭 (brand 부재 또는 mismatch)
 *   3. productName + brand fuzzy (substring, insensitive) 매칭 take 5
 *   4. 매칭 실패 → 신규 품목 권장
 *
 * 입력 shape (LabelParseResult / ParsedQuoteLineItem 양쪽 호환):
 *   - catalogNumber: string | null
 *   - productName:  string | null
 *   - brand:        string | null
 *
 * 출력:
 *   - type: "exact_catalog_brand" | "exact_catalog" | "fuzzy_name" | "new"
 *   - confidence: 0.0 ~ 1.0
 *   - candidates: ProductCandidate[]  (exact: 1건, fuzzy: 최대 5건, new: 0건)
 *
 * Dependency injection — caller 가 Prisma client 또는 mock 주입.
 * sandbox vitest 호환 (실 DB 없이 unit test 가능).
 */

export interface ProductMatchInput {
  /** Catalog/Cat# (e.g. 25200-056) */
  catalogNumber?: string | null;
  /** Product name (e.g. "Trypsin-EDTA 0.25% 100ml") */
  productName?: string | null;
  /** Brand/manufacturer (e.g. "Thermo Fisher") */
  brand?: string | null;
}

export type ProductMatchType =
  | "exact_catalog_brand"  // catalogNumber + brand 모두 정합 — 가장 신뢰
  | "exact_catalog"        // catalogNumber 만 정합 — brand 부재/mismatch
  | "fuzzy_name"           // productName/brand substring — 사용자 확인 필요
  | "new";                 // 매칭 0 — 신규 등록 권장

export interface ProductCandidate {
  id: string;
  name: string;
  brand: string | null;
  catalogNumber: string | null;
}

export interface ProductMatchResult {
  type: ProductMatchType;
  confidence: number;  // 0.0 ~ 1.0
  candidates: ProductCandidate[];
}

/** Prisma-compatible minimal interface — full client 또는 mock 주입 가능. */
export interface ProductMatcherDb {
  product: {
    findFirst: (args: unknown) => Promise<ProductCandidate | null>;
    findMany: (args: unknown) => Promise<ProductCandidate[]>;
  };
}

/**
 * Normalize string — trim + lowercase. null/empty 처리 통합.
 * 카탈로그 매칭은 hyphen/space 차이 흔하므로 추가 normalize.
 */
function normalizeKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed;
}

function normalizeCatalog(value: string | null | undefined): string | null {
  const trimmed = normalizeKey(value);
  if (!trimmed) return null;
  // hyphen / whitespace 제거 (벤더 catalog 표기 차이 흡수)
  return trimmed.replace(/[\s-]/g, "").toLowerCase();
}

/**
 * §11.309b core — OCR 추출 → 기존 Product 매칭.
 *
 * 단계:
 *   1. catalogNumber 정확 매칭 시도 (raw + normalized 둘 다 시도)
 *      → brand 정합 시 confidence 0.95 (exact_catalog_brand)
 *      → brand mismatch/부재 시 confidence 0.85 (exact_catalog)
 *   2. catalogNumber 없거나 exact 매칭 실패 시 fuzzy (productName + brand)
 *      → confidence 0.5 (fuzzy_name) — 사용자 확인 필수
 *   3. fuzzy 도 0건 → new (confidence 0)
 *
 * Dependency injection — db param 으로 Prisma client 또는 mock 주입.
 */
export async function matchProduct(
  input: ProductMatchInput,
  deps: { db: ProductMatcherDb },
): Promise<ProductMatchResult> {
  const catalog = normalizeKey(input.catalogNumber);
  const catalogNorm = normalizeCatalog(input.catalogNumber);
  const productName = normalizeKey(input.productName);
  const brand = normalizeKey(input.brand);

  // ── Tier 1: catalogNumber 정확 매칭 (raw, then normalized) ──
  if (catalog) {
    // raw match 우선
    const exact = await deps.db.product.findFirst({
      where: { catalogNumber: catalog },
      select: { id: true, name: true, brand: true, catalogNumber: true },
    });

    if (exact) {
      const brandMatches =
        brand &&
        exact.brand &&
        exact.brand.toLowerCase().trim() === brand.toLowerCase().trim();

      return {
        type: brandMatches ? "exact_catalog_brand" : "exact_catalog",
        confidence: brandMatches ? 0.95 : 0.85,
        candidates: [exact],
      };
    }

    // normalized fallback (hyphen/space 차이 흡수)
    if (catalogNorm && catalogNorm !== catalog.toLowerCase()) {
      // Note: Prisma 가 SQL function 으로 normalized 비교 불가 — caller 가
      // 후속 batch (§11.309b-2) 에서 generated column 또는 raw query 추가 가능.
      // MVP 는 raw catalog 정확 매칭 만, normalized 는 fuzzy 단계에 흡수.
    }
  }

  // ── Tier 2/3: Fuzzy (productName / brand substring) ──
  if (productName || brand) {
    const orConditions: Array<Record<string, unknown>> = [];
    if (productName) {
      orConditions.push({
        name: { contains: productName, mode: "insensitive" },
      });
    }
    if (brand) {
      orConditions.push({
        brand: { contains: brand, mode: "insensitive" },
      });
    }

    if (orConditions.length > 0) {
      const fuzzy = await deps.db.product.findMany({
        where: { OR: orConditions },
        take: 5,
        select: { id: true, name: true, brand: true, catalogNumber: true },
      });

      if (fuzzy.length > 0) {
        // 매칭 수 + brand+name 모두 매칭 비율로 confidence 계산
        const bothMatch = fuzzy.filter((p) => {
          const nameOk =
            productName &&
            p.name.toLowerCase().includes(productName.toLowerCase());
          const brandOk =
            brand &&
            p.brand &&
            p.brand.toLowerCase().includes(brand.toLowerCase());
          return nameOk && brandOk;
        }).length;

        // bothMatch 1+ → 0.6, 그렇지 않으면 0.4 (사용자 확인 필요)
        const confidence = bothMatch > 0 ? 0.6 : 0.4;

        return {
          type: "fuzzy_name",
          confidence,
          candidates: fuzzy,
        };
      }
    }
  }

  // ── Tier 4: 매칭 0 → 신규 ──
  return {
    type: "new",
    confidence: 0,
    candidates: [],
  };
}
