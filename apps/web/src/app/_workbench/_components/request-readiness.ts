/**
 * Request Readiness — 견적 요청 생성 가능 여부 판정 로직.
 *
 * 4가지 overall 상태:
 * - ready_to_create_request: 후보 충분, hard blocker 없음
 * - review_first: compare ambiguity / vendor 선택 필요
 * - blocked: 후보 없음 / 필수 정보 부족
 * - partial_ready: 일부 usable, 일부 review/block
 *
 * 3가지 item-level flag:
 * - hard_blocker: vendor 없음
 * - review_required: 가격 없음, compare 미완료
 * - soft_warning: catalogNumber/spec 부족
 */

// ── Item-level flags ──

export interface CandidateFlag {
  type: "hard_blocker" | "review_required" | "soft_warning";
  label: string;
  detail: string;
}

export interface CandidateAssessment {
  itemId: string;
  productId: string;
  productName: string;
  vendorName: string;
  catalogNumber: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  isInCompare: boolean;
  flags: CandidateFlag[];
  status: "ready" | "review" | "blocked";
}

// ── Overall readiness ──

export type RequestReadinessLevel =
  | "ready_to_create_request"
  | "review_first"
  | "blocked"
  | "partial_ready";

export interface RequestReadiness {
  level: RequestReadinessLevel;
  label: string;
  detail: string;
  candidates: CandidateAssessment[];
  summary: {
    total: number;
    ready: number;
    review: number;
    blocked: number;
  };
  hardBlockers: string[];
  reviewItems: string[];
  softWarnings: string[];
}

// ── Calculation ──

export function calculateRequestReadiness(
  quoteItems: any[],
  compareIds: string[],
  products: any[],
): RequestReadiness {
  const candidates: CandidateAssessment[] = quoteItems.map((item) => {
    const product = products.find((p: any) => p.id === item.productId);
    const flags: CandidateFlag[] = [];

    // Hard blocker: no vendor
    if (!item.vendorName && !item.vendorId) {
      flags.push({
        type: "hard_blocker",
        label: "공급사 없음",
        detail: "공급사 정보가 없어 견적 요청 불가",
      });
    }

    // Review: no price
    if (!item.unitPrice || item.unitPrice <= 0) {
      flags.push({
        type: "review_required",
        label: "가격 미확인",
        detail: "단가가 0원 — 공급사에 가격 확인 필요",
      });
    }

    // Review: in compare but compare not completed (ambiguity)
    if (compareIds.includes(item.productId)) {
      flags.push({
        type: "review_required",
        label: "비교 진행 중",
        detail: "비교 목록에 포함됨 — 최적 후보 확정 후 요청 권장",
      });
    }

    // Soft warning: no catalog number
    const catNo = product?.catalogNumber || item.catalogNumber;
    if (!catNo) {
      flags.push({
        type: "soft_warning",
        label: "카탈로그 번호 없음",
        detail: "Cat. No. 미등록 — 요청 시 확인 지연 가능",
      });
    }

    // Soft warning: missing spec
    if (product && !product.specification && !product.grade) {
      flags.push({
        type: "soft_warning",
        label: "스펙 미상세",
        detail: "용량/grade 정보 없음 — 공급사 확인 필요",
      });
    }

    const hasBlocker = flags.some((f) => f.type === "hard_blocker");
    const hasReview = flags.some((f) => f.type === "review_required");
    const status: CandidateAssessment["status"] = hasBlocker
      ? "blocked"
      : hasReview
        ? "review"
        : "ready";

    return {
      itemId: item.id,
      productId: item.productId,
      productName: item.productName || product?.name || "제품",
      vendorName: item.vendorName || "—",
      catalogNumber: catNo || null,
      unitPrice: item.unitPrice || 0,
      quantity: item.quantity || 1,
      lineTotal: item.lineTotal || 0,
      isInCompare: compareIds.includes(item.productId),
      flags,
      status,
    };
  });

  const summary = {
    total: candidates.length,
    ready: candidates.filter((c) => c.status === "ready").length,
    review: candidates.filter((c) => c.status === "review").length,
    blocked: candidates.filter((c) => c.status === "blocked").length,
  };

  const hardBlockers: string[] = [];
  const reviewItems: string[] = [];
  const softWarnings: string[] = [];

  if (candidates.length === 0) {
    hardBlockers.push("견적 요청 후보가 없습니다");
  }
  candidates.forEach((c) => {
    c.flags.forEach((f) => {
      const msg = `${c.productName}: ${f.label}`;
      if (f.type === "hard_blocker") hardBlockers.push(msg);
      else if (f.type === "review_required") reviewItems.push(msg);
      else softWarnings.push(msg);
    });
  });

  // Overall level
  let level: RequestReadinessLevel;
  let label: string;
  let detail: string;

  if (candidates.length === 0) {
    level = "blocked";
    label = "요청 불가";
    detail = "견적 요청 후보를 먼저 추가하세요";
  } else if (summary.blocked === summary.total) {
    level = "blocked";
    label = "요청 불가";
    detail = "모든 후보에 필수 정보가 부족합니다";
  } else if (summary.blocked > 0 || (summary.review > 0 && summary.ready > 0)) {
    level = "partial_ready";
    label = "일부 준비 완료";
    detail = `${summary.ready}건 요청 가능, ${summary.review + summary.blocked}건 확인 필요`;
  } else if (summary.review > 0) {
    level = "review_first";
    label = "검토 필요";
    detail = `${summary.review}건의 후보를 먼저 확인하세요`;
  } else {
    level = "ready_to_create_request";
    label = "요청 가능";
    detail = `${summary.total}건 모두 준비 완료`;
  }

  return { level, label, detail, candidates, summary, hardBlockers, reviewItems, softWarnings };
}
