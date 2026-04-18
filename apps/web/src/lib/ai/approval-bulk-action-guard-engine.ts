/**
 * Approval Bulk Action Guard Engine — bulk 승인 시 tier 제한 + 안전 필터링
 *
 * RULES:
 * 1. Tier 3 (irreversible): bulk 금지 — 개별 승인 필수
 * 2. Tier 2 (org impact): 제한적 bulk (SoD/delegation 충돌 없는 건만)
 * 3. Tier 1 (routine): bulk 허용
 * 4. dualApprovalRequired: bulk 제외
 * 5. snapshotInvalidated / reapproval_required: bulk 제외
 * 6. delegation conflict detected: bulk 제외
 * 7. SoD violation detected: bulk 제외
 * 8. escalation required: bulk 제외
 */

import type { ApprovalInboxItemV2, ApprovalDomain } from "./approval-inbox-projection-v2-engine";
import type { ActionRiskTier } from "./dispatch-v2-permission-policy-engine";

// ── Bulk Eligibility Result ──
export interface BulkEligibilityResult {
  eligible: ApprovalInboxItemV2[];
  excluded: BulkExcludedItem[];
  totalEligible: number;
  totalExcluded: number;
  exclusionSummary: Record<string, number>;
}

export interface BulkExcludedItem {
  item: ApprovalInboxItemV2;
  exclusionReason: BulkExclusionReason;
  detail: string;
}

export type BulkExclusionReason =
  | "tier3_irreversible"
  | "dual_approval_required"
  | "snapshot_invalidated"
  | "reapproval_required"
  | "delegation_conflict"
  | "sod_violation"
  | "escalation_required"
  | "expired_needs_action"
  | "policy_blocker";

// ── Check Bulk Eligibility ──
export function checkBulkActionEligibility(
  items: ApprovalInboxItemV2[],
  bulkAction: "approve" | "assign" | "escalate",
): BulkEligibilityResult {
  const eligible: ApprovalInboxItemV2[] = [];
  const excluded: BulkExcludedItem[] = [];
  const exclusionSummary: Record<string, number> = {};

  const addExclusion = (item: ApprovalInboxItemV2, reason: BulkExclusionReason, detail: string) => {
    excluded.push({ item, exclusionReason: reason, detail });
    exclusionSummary[reason] = (exclusionSummary[reason] || 0) + 1;
  };

  for (const item of items) {
    let isExcluded = false;

    // Rule 1: Tier 3 → bulk approve 금지
    if (bulkAction === "approve" && item.riskTier === "tier3_irreversible") {
      addExclusion(item, "tier3_irreversible", "Tier 3 irreversible — 개별 승인 필수");
      isExcluded = true;
    }

    // Rule 4: dual approval → bulk 제외
    if (!isExcluded && bulkAction === "approve" && item.dualApprovalRequired) {
      addExclusion(item, "dual_approval_required", "이중 승인 필요 — bulk 제외");
      isExcluded = true;
    }

    // Rule 5: snapshot invalidated → bulk 제외
    if (!isExcluded && item.snapshotInvalidated) {
      addExclusion(item, "snapshot_invalidated", "Snapshot 무효화됨 — 재승인 필요");
      isExcluded = true;
    }

    // Rule 5b: reapproval required → bulk 제외
    if (!isExcluded && item.itemStatus === "reapproval_required") {
      addExclusion(item, "reapproval_required", "재승인 필요 — 개별 검토 필수");
      isExcluded = true;
    }

    // Rule 6: delegation conflict → bulk 제외
    if (!isExcluded && item.sodViolationDetected) {
      addExclusion(item, "sod_violation", `SoD 위반: ${item.sodViolationDetail}`);
      isExcluded = true;
    }

    // Rule 8: escalation required → bulk 제외
    if (!isExcluded && item.escalationRequired) {
      addExclusion(item, "escalation_required", "에스컬레이션 필요 — 상위 승인자 처리 필수");
      isExcluded = true;
    }

    // Rule: expired → bulk 제외
    if (!isExcluded && item.itemStatus === "expired_needs_action") {
      addExclusion(item, "expired_needs_action", "만료 — 개별 처리 필요");
      isExcluded = true;
    }

    // Rule: policy blocker → bulk approve 제외
    if (!isExcluded && bulkAction === "approve" && item.policyBlockerCount > 0) {
      addExclusion(item, "policy_blocker", `정책 위반 ${item.policyBlockerCount}건 — 개별 검토 필수`);
      isExcluded = true;
    }

    // Rule 2: Tier 2 → restricted bulk (only if no other exclusion)
    // Tier 2 with SoD/delegation issues already caught above
    // Tier 2 without issues → allowed in bulk

    if (!isExcluded) {
      eligible.push(item);
    }
  }

  return {
    eligible, excluded,
    totalEligible: eligible.length,
    totalExcluded: excluded.length,
    exclusionSummary,
  };
}

// ── Bulk Action Summary (for confirmation UI) ──
export interface BulkActionConfirmation {
  action: "approve" | "assign" | "escalate";
  eligibleCount: number;
  excludedCount: number;
  exclusionReasons: string[];
  riskWarning: string;
  confirmationMessage: string;
}

export function buildBulkActionConfirmation(
  result: BulkEligibilityResult,
  action: "approve" | "assign" | "escalate",
): BulkActionConfirmation {
  const exclusionReasons = Object.entries(result.exclusionSummary)
    .map(([reason, count]) => `${reason}: ${count}건`);

  let riskWarning = "";
  if (result.totalEligible > 10) riskWarning = "대량 처리 — 주의 필요";
  if (result.eligible.some(i => i.riskTier === "tier2_org_impact")) riskWarning = "Tier 2 항목 포함 — 개별 확인 권장";

  return {
    action,
    eligibleCount: result.totalEligible,
    excludedCount: result.totalExcluded,
    exclusionReasons,
    riskWarning,
    confirmationMessage: `${result.totalEligible}건 ${action} 처리 (${result.totalExcluded}건 제외)`,
  };
}
