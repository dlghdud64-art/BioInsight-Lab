/**
 * optimization-approval.ts
 * 최적화 제안에 대한 승인 매트릭스.
 * 안전 강화 → 자동 적용, 완화 → 실험 통과 필수, 위양성 위험 → 거부.
 */

import type { ExperimentComparisonResult } from "./experiment-runner";
import type { ProposalReference } from "./policy-learning-loop";

// ──────────────────────────────────────────────
// 타입 정의
// ──────────────────────────────────────────────

/** 승인 결정 유형 */
export type ApprovalDecision =
  | "APPLY_HARDENING"             // 안전 강화 → 자동 적용 (실험 불필요)
  | "APPLY_RESTRICTED_EXPERIMENT" // 실험 필요 제안 → 실험 파이프라인 전달
  | "APPROVE_EFFICIENCY_GAIN"     // 실험 통과 + 위양성 0 → 효율 개선 승인
  | "REJECT_TOO_RISKY"            // 위양성 위험 > 0 → 거부
  | "SUSPEND_PORTFOLIO_MODE";     // 포트폴리오 모드가 SLOWDOWN/FREEZE 또는 백로그 초과 → 일시 중지

/** 포트폴리오 운영 모드 */
export type PortfolioMode = "NORMAL" | "SLOWDOWN" | "FREEZE";

/** 포트폴리오 상태 */
export interface PortfolioState {
  mode: PortfolioMode;
  reviewBacklogOverflow: boolean; // 리뷰 백로그 초과 여부
}

/** 최적화 승인 레코드 */
export interface OptimizationApproval {
  approvalId: string;
  proposalId: string;
  experimentId: string | null;    // 실험 불필요 시 null
  decision: ApprovalDecision;
  decidedBy: string | "SYSTEM";   // 자동 결정 시 "SYSTEM"
  reason: string;
  decidedAt: Date;
}

// ──────────────────────────────────────────────
// 인메모리 저장소 (production: DB-backed)
// ──────────────────────────────────────────────
const approvalStore: OptimizationApproval[] = [];

// ──────────────────────────────────────────────
// 유틸리티
// ──────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ──────────────────────────────────────────────
// 승인 평가
// ──────────────────────────────────────────────

/**
 * 최적화 제안 평가 — 승인 매트릭스 규칙에 따라 결정
 *
 * 우선순위 규칙:
 * 1. 포트폴리오 모드가 SLOWDOWN/FREEZE 또는 리뷰 백로그 초과 → SUSPEND
 * 2. 안전 강화(tightening, exclusion add) → APPLY_HARDENING (자동, 실험 불필요)
 * 3. 위양성 위험 > 0 → REJECT_TOO_RISKY
 * 4. 실험 통과 + falseSafeDelta === 0 → APPROVE_EFFICIENCY_GAIN
 * 5. 그 외 완화 제안 → APPLY_RESTRICTED_EXPERIMENT (실험 필요)
 */
export function evaluateOptimizationProposal(
  proposal: ProposalReference,
  experimentResult?: ExperimentComparisonResult,
  portfolioState?: PortfolioState
): ApprovalDecision {
  let decision: ApprovalDecision;
  let reason: string;
  let experimentId: string | null = experimentResult?.experimentId ?? null;

  // ── 1) 포트폴리오 모드 점검 ──
  if (portfolioState) {
    if (
      portfolioState.mode === "SLOWDOWN" ||
      portfolioState.mode === "FREEZE" ||
      portfolioState.reviewBacklogOverflow
    ) {
      decision = "SUSPEND_PORTFOLIO_MODE";
      reason =
        `포트폴리오 모드 ${portfolioState.mode}, ` +
        `백로그 초과: ${portfolioState.reviewBacklogOverflow} → 최적화 일시 중지`;

      recordApproval(proposal.proposalId, experimentId, decision, reason);
      return decision;
    }
  }

  // ── 2) 안전 강화 제안 → 자동 적용 ──
  if (proposal.autoApplicable) {
    decision = "APPLY_HARDENING";
    reason = `안전 강화 제안(${proposal.direction}) → 실험 없이 즉시 적용`;

    recordApproval(proposal.proposalId, experimentId, decision, reason);
    return decision;
  }

  // ── 3) 위양성 위험 검사 ──
  if (experimentResult && experimentResult.falseSafeDelta !== null && experimentResult.falseSafeDelta > 0) {
    decision = "REJECT_TOO_RISKY";
    reason =
      `falseSafeDelta=${experimentResult.falseSafeDelta} > 0 → 위양성 위험으로 거부`;

    recordApproval(proposal.proposalId, experimentId, decision, reason);
    return decision;
  }

  // ── 4) 실험 통과 + 위양성 0 → 효율 개선 승인 ──
  if (
    experimentResult &&
    experimentResult.passedAllStages &&
    (experimentResult.falseSafeDelta === null || experimentResult.falseSafeDelta <= 0)
  ) {
    decision = "APPROVE_EFFICIENCY_GAIN";
    reason =
      `실험 ${experimentResult.experimentId} 전 단계 통과, ` +
      `falseSafeDelta=${experimentResult.falseSafeDelta} ≤ 0 → 효율 개선 승인`;

    recordApproval(proposal.proposalId, experimentId, decision, reason);
    return decision;
  }

  // ── 5) 완화 제안 → 실험 필요 ──
  decision = "APPLY_RESTRICTED_EXPERIMENT";
  reason = `완화 제안(${proposal.direction}) → 실험 파이프라인 필요`;

  recordApproval(proposal.proposalId, experimentId, decision, reason);
  return decision;
}

/**
 * 승인 레코드 기록
 */
function recordApproval(
  proposalId: string,
  experimentId: string | null,
  decision: ApprovalDecision,
  reason: string
): void {
  approvalStore.push({
    approvalId: generateId("apv"),
    proposalId,
    experimentId,
    decision,
    decidedBy: "SYSTEM",
    reason,
    decidedAt: new Date(),
  });
}

/**
 * 전체 승인 이력 조회
 */
export function getApprovalHistory(): OptimizationApproval[] {
  return [...approvalStore];
}

/**
 * 특정 제안의 승인 이력 조회
 */
export function getApprovalByProposalId(
  proposalId: string
): OptimizationApproval | undefined {
  return approvalStore.find((a) => a.proposalId === proposalId);
}
