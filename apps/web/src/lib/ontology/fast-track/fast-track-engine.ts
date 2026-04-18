/**
 * Fast-Track Recommendation Engine
 *
 * 목적: 특정 procurement case에 대해 "검토 없이 즉시 승인해도 안전한가"를
 *       deterministic 규칙으로 판정하는 read-only evaluator.
 *
 * 고정 규칙 (CLAUDE.md / ARCHITECTURE.md):
 * 1. canonical truth는 흔들지 않는다. 본 엔진은 read-only orchestrator이며,
 *    Quote/PO/Budget/Inventory 각자 source of truth 위의 computed view만 생성한다.
 * 2. AI가 "대신 발주"하지 않는다. 오직 "이 건은 안전합니다"라는 보증만 제공한다.
 *    최종 승인은 사용자의 명시적 [일괄 승인] 클릭이다.
 * 3. 동일 입력 → 동일 출력 (deterministic). AI 호출 금지.
 * 4. safetyScore는 reasons[].weight 합산이며, threshold 미만이면 recommended=false.
 * 5. blocker가 하나라도 있으면 safetyScore와 무관하게 recommended=false.
 * 6. 평가 snapshot은 재평가 시 drift 감지용으로만 사용하고,
 *    이 모듈은 snapshot을 비교/invalidation하지 않는다 (caller 책임).
 *
 * 입력:
 *   - FastTrackEvaluationInput (vendor/product/amount/history/safety)
 * 출력:
 *   - FastTrackRecommendationObject (computed view)
 */

import type {
  FastTrackRecommendationObject,
  FastTrackReason,
  FastTrackBlocker,
  FastTrackEvaluationSnapshot,
  FastTrackStatus,
  ProductCategory,
  SafetyProfile,
} from "../types";

// ══════════════════════════════════════════════════════════════════════════════
// Thresholds — 단일 출처. UI/테스트가 이 상수를 공유한다.
// ══════════════════════════════════════════════════════════════════════════════

export const FAST_TRACK_THRESHOLDS = {
  /** 과거 구매 이력 인정 기간 (개월) */
  historyWindowMonths: 3,
  /** 과거 이력 최소 건수 (동일 vendor+product 정상 구매) */
  minHistoryCount: 3,
  /** Fast-Track 자격 최소 safetyScore */
  minSafetyScore: 0.7,
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// Input contracts
// ══════════════════════════════════════════════════════════════════════════════

/** 평가 대상 단일 품목 */
export interface FastTrackCandidateItem {
  productId: string;
  productName: string;
  category: ProductCategory;
  /** 안전 프로필 — 없으면 평가에 "정보 부족"으로 반영 */
  safetyProfile: SafetyProfile | null;
  /** 규제/컨트롤 품목 플래그 (pharmacopoeia/controlled substance 등) */
  regulatedFlag: boolean;
  /** 수동 검토 강제 플래그 (운영자가 지정한 경우) */
  manualReviewRequired: boolean;
}

/** 과거 구매 이력 요약 (vendor+product 조합 단위로 caller가 집계) */
export interface FastTrackHistoryRecord {
  vendorId: string;
  productId: string;
  /** window 기간 내 정상 완료된 구매 건수 */
  successfulOrders: number;
  /** 마지막 정상 구매 일자 (ISO 8601) */
  lastOrderedAt: string | null;
  /** window 기간 내 클레임/반품/이상 건수 */
  issueCount: number;
}

export interface FastTrackEvaluationInput {
  /** 평가 대상 procurement case id (Quote id / PO draft id 등 caller 식별자) */
  procurementCaseId: string;
  vendorId: string;
  vendorName: string;
  totalAmount: number;
  items: FastTrackCandidateItem[];
  /** 동일 vendor+product 기준으로 caller가 집계해 전달한 과거 이력 */
  histories: FastTrackHistoryRecord[];
  /** 평가 기준 시각 (테스트 determinism용, 미전달 시 now()) */
  evaluatedAt?: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Evaluator
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Fast-Track 자격 평가.
 *
 * 본 함수는 mutation을 하지 않으며, 동일 입력에 대해 동일한 Recommendation을 반환한다.
 * 반환된 객체는 "자격 있음/없음"을 나타내는 computed view일 뿐, 실제 승인 실행은 아니다.
 */
export function evaluateFastTrack(
  input: FastTrackEvaluationInput,
): FastTrackRecommendationObject {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  const reasons: FastTrackReason[] = [];
  const blockers: FastTrackBlocker[] = [];

  // ── 1. 위험물질 검사 ─────────────────────────────────────────────────────────
  const hazardCodesSeen = new Set<string>();
  const hazardousItems: string[] = [];
  for (const item of input.items) {
    const codes = item.safetyProfile?.hazardCodes ?? [];
    for (const c of codes) {
      if (c && c.trim().length > 0) {
        hazardCodesSeen.add(c);
      }
    }
    if (codes.some((c) => isHazardous(c))) {
      hazardousItems.push(item.productName);
    }
  }

  if (hazardousItems.length > 0) {
    blockers.push({
      code: "hazardous_item_present",
      message: `위험물질 포함 — ${hazardousItems.join(", ")}`,
      remediation: "MSDS 확인 후 일반 검토 경로로 진행",
    });
  } else {
    reasons.push({
      code: "no_hazard_flags",
      weight: 0.35,
      message: "위험물질 플래그 없음 — 안전 보관 요건 일반 수준",
    });
  }

  // ── 2. 규제/manual review 검사 ──────────────────────────────────────────────
  const regulatedItems = input.items.filter((i) => i.regulatedFlag).map((i) => i.productName);
  const manualItems = input.items.filter((i) => i.manualReviewRequired).map((i) => i.productName);

  if (regulatedItems.length > 0) {
    blockers.push({
      code: "regulated_item_present",
      message: `규제 품목 포함 — ${regulatedItems.join(", ")}`,
      remediation: "컴플라이언스 검토 필요",
    });
  } else {
    reasons.push({
      code: "no_regulatory_flags",
      weight: 0.25,
      message: "규제/컨트롤 품목 아님",
    });
  }

  if (manualItems.length > 0) {
    blockers.push({
      code: "manual_review_required",
      message: `수동 검토 지정 — ${manualItems.join(", ")}`,
      remediation: "운영자 수동 승인 필요",
    });
  }

  // ── 3. 과거 정상 구매 이력 검사 ─────────────────────────────────────────────
  const historyCoverage = computeHistoryCoverage(
    input.items,
    input.histories,
    input.vendorId,
  );

  if (historyCoverage.allCovered) {
    reasons.push({
      code: "repeat_purchase_history",
      weight: 0.4,
      message:
        `최근 ${FAST_TRACK_THRESHOLDS.historyWindowMonths}개월 내 ` +
        `${FAST_TRACK_THRESHOLDS.minHistoryCount}회 이상 정상 구매 이력 (${input.vendorName})`,
    });
  } else {
    blockers.push({
      code: "insufficient_history",
      message: historyCoverage.reason,
      remediation:
        `${input.vendorName} 기준 최소 ${FAST_TRACK_THRESHOLDS.minHistoryCount}회 정상 구매 이력 필요`,
    });
  }

  // ── 4. safetyScore 합산 + 권장 여부 결정 ────────────────────────────────────
  const safetyScore = clamp01(reasons.reduce((sum, r) => sum + r.weight, 0));
  const recommended =
    blockers.length === 0 && safetyScore >= FAST_TRACK_THRESHOLDS.minSafetyScore;

  const status: FastTrackStatus = recommended ? "eligible" : "not_eligible";

  // ── 5. snapshot ─────────────────────────────────────────────────────────────
  const snapshot: FastTrackEvaluationSnapshot = {
    vendorId: input.vendorId,
    productIds: input.items.map((i) => i.productId).sort(),
    totalAmount: input.totalAmount,
    historyCount: historyCoverage.totalSuccessfulOrders,
    hazardCodesSeen: Array.from(hazardCodesSeen).sort(),
  };

  // ── 6. Object identity ──────────────────────────────────────────────────────
  const objectId = buildFastTrackObjectId(input.procurementCaseId, evaluatedAt);

  return {
    objectId,
    objectType: "FastTrackRecommendation",
    createdAt: evaluatedAt,
    updatedAt: evaluatedAt,
    procurementCaseId: input.procurementCaseId,
    recommendationStatus: status,
    safetyScore,
    recommended,
    reasons,
    blockers,
    evaluationSnapshot: snapshot,
    evaluatedAt,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Snapshot drift — caller가 재평가 시 stale 여부를 결정할 때 사용
// ══════════════════════════════════════════════════════════════════════════════

/**
 * 기존 Recommendation의 snapshot과 현재 재평가 input을 비교해 stale 여부를 판단.
 * drift 원인을 명시적으로 반환해 Queue UI가 그대로 노출할 수 있게 한다.
 */
export function detectFastTrackSnapshotDrift(
  previous: FastTrackRecommendationObject,
  current: FastTrackEvaluationInput,
): { isStale: boolean; reason: string | null } {
  const prev = previous.evaluationSnapshot;
  if (prev.vendorId !== current.vendorId) {
    return { isStale: true, reason: "공급사 변경됨" };
  }
  const currentProductIds = current.items.map((i) => i.productId).sort();
  if (
    prev.productIds.length !== currentProductIds.length ||
    prev.productIds.some((id, idx) => id !== currentProductIds[idx])
  ) {
    return { isStale: true, reason: "품목 구성 변경됨" };
  }
  if (prev.totalAmount !== current.totalAmount) {
    return { isStale: true, reason: "금액 변경됨" };
  }
  const hazardNow = collectHazardCodes(current.items);
  if (
    prev.hazardCodesSeen.length !== hazardNow.length ||
    prev.hazardCodesSeen.some((c, idx) => c !== hazardNow[idx])
  ) {
    return { isStale: true, reason: "안전 프로필 변경됨" };
  }
  return { isStale: false, reason: null };
}

// ══════════════════════════════════════════════════════════════════════════════
// Helpers — internal, 외부 노출하지 않음
// ══════════════════════════════════════════════════════════════════════════════

/**
 * hazard code가 MSDS 기준 "fast-track 거부"에 해당하는지 판단.
 * GHS H-code 기준: H2xx 폭발/인화성, H3xx 건강 위해, H4xx 환경 위해.
 * 본 엔진은 모든 H-code를 hazardous로 간주한다 (보수적).
 */
function isHazardous(code: string): boolean {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return false;
  return trimmed.startsWith("H") && /^H\d{3}/.test(trimmed);
}

interface HistoryCoverageResult {
  allCovered: boolean;
  reason: string;
  totalSuccessfulOrders: number;
}

function computeHistoryCoverage(
  items: FastTrackCandidateItem[],
  histories: FastTrackHistoryRecord[],
  vendorId: string,
): HistoryCoverageResult {
  let totalSuccessful = 0;
  const uncoveredProductNames: string[] = [];

  for (const item of items) {
    const rec = histories.find(
      (h) => h.vendorId === vendorId && h.productId === item.productId,
    );
    if (
      !rec ||
      rec.successfulOrders < FAST_TRACK_THRESHOLDS.minHistoryCount ||
      rec.issueCount > 0
    ) {
      uncoveredProductNames.push(item.productName);
    }
    if (rec) totalSuccessful += rec.successfulOrders;
  }

  if (uncoveredProductNames.length > 0) {
    return {
      allCovered: false,
      reason: `과거 정상 구매 이력 부족 — ${uncoveredProductNames.join(", ")}`,
      totalSuccessfulOrders: totalSuccessful,
    };
  }

  return {
    allCovered: true,
    reason: "",
    totalSuccessfulOrders: totalSuccessful,
  };
}

function collectHazardCodes(items: FastTrackCandidateItem[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    for (const c of item.safetyProfile?.hazardCodes ?? []) {
      if (c && c.trim().length > 0) set.add(c);
    }
  }
  return Array.from(set).sort();
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return Math.round(n * 10000) / 10000;
}

function buildFastTrackObjectId(caseId: string, evaluatedAt: string): string {
  // Deterministic id — caller가 동일 caseId + 동일 evaluatedAt로 호출하면 동일 id.
  const safeCase = caseId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeTs = evaluatedAt.replace(/[^0-9]/g, "");
  return `fasttrackrec_${safeCase}_${safeTs}`;
}
