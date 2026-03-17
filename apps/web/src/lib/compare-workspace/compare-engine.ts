/**
 * Compare Engine — V1 최소 구현
 *
 * 두 제품의 canonical field를 비교하여 structured diff를 생성한다.
 * V1: Product 데이터 기반 비교만 지원 (문서 파싱 없음).
 */

import type {
  DiffResult,
  DiffItem,
  DiffType,
  DiffSignificance,
  DiffActionability,
  DiffSummary,
  DiffVerdict,
} from "./03-diff-output-spec";
import type { CanonicalFieldKey } from "./01-canonical-schema";
import { DEFAULT_FIELD_SIGNIFICANCE } from "./03-diff-output-spec";

// ── Product → Canonical Field 매핑 ──

interface ProductForCompare {
  id: string;
  name: string;
  brand?: string | null;
  catalogNumber?: string | null;
  grade?: string | null;
  specification?: string | null;
  storageCondition?: string | null;
  safetyNote?: string | null;
  vendors?: VendorForCompare[];
}

interface VendorForCompare {
  vendor?: { name?: string | null } | null;
  priceInKRW?: number | null;
  leadTime?: number | null;
  minOrderQty?: number | null;
  stockStatus?: string | null;
}

interface FieldDef {
  key: CanonicalFieldKey;
  label: string;
  extract: (p: ProductForCompare) => unknown;
}

const COMPARE_FIELDS: FieldDef[] = [
  { key: "productName", label: "제품명", extract: (p) => p.name },
  { key: "manufacturer", label: "브랜드/제조사", extract: (p) => p.brand },
  { key: "catalogNumber", label: "카탈로그 번호", extract: (p) => p.catalogNumber },
  { key: "grade", label: "Grade", extract: (p) => p.grade },
  { key: "packSize", label: "규격", extract: (p) => p.specification },
  { key: "storageCondition", label: "보관 조건", extract: (p) => p.storageCondition },
  {
    key: "supplier",
    label: "주 공급사",
    extract: (p) => p.vendors?.[0]?.vendor?.name ?? null,
  },
  {
    key: "quoteAmount",
    label: "최저가 (₩)",
    extract: (p) => {
      const prices = p.vendors
        ?.map((v) => v.priceInKRW)
        .filter((x): x is number => x != null && x > 0);
      return prices && prices.length > 0 ? Math.min(...prices) : null;
    },
  },
  {
    key: "leadTimeDays",
    label: "최단 납기 (일)",
    extract: (p) => {
      const times = p.vendors
        ?.map((v) => v.leadTime)
        .filter((x): x is number => x != null && x > 0);
      return times && times.length > 0 ? Math.min(...times) : null;
    },
  },
  {
    key: "moq",
    label: "최소 주문량",
    extract: (p) => {
      const qtys = p.vendors
        ?.map((v) => v.minOrderQty)
        .filter((x): x is number => x != null && x > 0);
      return qtys && qtys.length > 0 ? Math.min(...qtys) : null;
    },
  },
];

// ── Diff 계산 ──

function determineDiffType(a: unknown, b: unknown): DiffType {
  if (a == null && b == null) return "IDENTICAL";
  if (a != null && b == null) return "SOURCE_ONLY";
  if (a == null && b != null) return "TARGET_ONLY";

  const strA = String(a).trim().toLowerCase();
  const strB = String(b).trim().toLowerCase();

  if (strA === strB) return "IDENTICAL";

  // 숫자 비교: 값이 같으면 FORMAT_DIFF
  const numA = Number(a);
  const numB = Number(b);
  if (!isNaN(numA) && !isNaN(numB) && numA === numB) return "FORMAT_DIFF";

  return "DIFFERENT";
}

function determineActionability(
  diffType: DiffType,
  significance: DiffSignificance
): DiffActionability {
  if (diffType === "IDENTICAL" || diffType === "FORMAT_DIFF") return "INFORMATIONAL";
  if (significance === "CRITICAL") return "REQUIRES_DECISION";
  if (significance === "HIGH") return "REQUIRES_REVIEW";
  if (significance === "MEDIUM") return "REQUIRES_INQUIRY";
  return "INFORMATIONAL";
}

function computeVerdict(items: DiffItem[]): { verdict: DiffVerdict; reason: string } {
  const diffs = items.filter(
    (i) => i.diffType !== "IDENTICAL" && i.diffType !== "FORMAT_DIFF"
  );
  if (diffs.length === 0) {
    return { verdict: "EQUIVALENT", reason: "모든 비교 항목이 동일합니다." };
  }

  const criticals = diffs.filter((i) => i.significance === "CRITICAL");
  const highs = diffs.filter((i) => i.significance === "HIGH");

  if (criticals.length > 0) {
    return {
      verdict: "INCOMPATIBLE",
      reason: `치명적 차이 ${criticals.length}건 발견. 전문가 검토가 필요합니다.`,
    };
  }
  if (highs.length >= 2) {
    return {
      verdict: "SIGNIFICANT_DIFFERENCES",
      reason: `중요 차이 ${highs.length}건 발견. 세부 검토를 권장합니다.`,
    };
  }
  if (highs.length === 1 || diffs.length > 3) {
    return {
      verdict: "MINOR_DIFFERENCES",
      reason: `경미한 차이 ${diffs.length}건. 대체 가능성 있음.`,
    };
  }
  return {
    verdict: "MINOR_DIFFERENCES",
    reason: `차이 ${diffs.length}건 발견. 세부 확인 권장.`,
  };
}

// ── 공개 API ──

export function computeProductDiff(
  source: ProductForCompare,
  target: ProductForCompare,
  compareId: string
): DiffResult {
  const items: DiffItem[] = [];

  for (const field of COMPARE_FIELDS) {
    const sourceVal = field.extract(source);
    const targetVal = field.extract(target);
    const diffType = determineDiffType(sourceVal, targetVal);
    const significance = DEFAULT_FIELD_SIGNIFICANCE[field.key] ?? "MEDIUM";
    const actionability = determineActionability(diffType, significance);

    items.push({
      fieldKey: field.key,
      fieldLabel: field.label,
      diffType,
      sourceValue: sourceVal ?? null,
      targetValue: targetVal ?? null,
      significance,
      actionability,
    });
  }

  const diffs = items.filter(
    (i) => i.diffType !== "IDENTICAL" && i.diffType !== "FORMAT_DIFF"
  );
  const { verdict, reason } = computeVerdict(items);

  const summary: DiffSummary = {
    criticalCount: diffs.filter((i) => i.significance === "CRITICAL").length,
    highCount: diffs.filter((i) => i.significance === "HIGH").length,
    mediumCount: diffs.filter((i) => i.significance === "MEDIUM").length,
    lowCount: diffs.filter((i) => i.significance === "LOW").length,
    infoCount: diffs.filter((i) => i.significance === "INFO").length,
    overallVerdict: verdict,
    verdictReason: reason,
  };

  return {
    compareId,
    sourceEntityId: source.id,
    targetEntityId: target.id,
    compareType: "PRODUCT_VS_PRODUCT",
    totalFieldsCompared: items.length,
    totalDifferences: diffs.length,
    items,
    summary,
    ontologyHints: [],
    computedAt: new Date(),
  };
}

/**
 * 여러 제품 간 pairwise diff 생성.
 * 첫 번째 제품을 기준(source)으로 나머지와 각각 비교.
 */
export function computeMultiProductDiff(
  products: ProductForCompare[],
  sessionId: string
): DiffResult[] {
  if (products.length < 2) return [];
  const source = products[0];
  return products.slice(1).map((target, idx) =>
    computeProductDiff(source, target, `${sessionId}-${idx}`)
  );
}
