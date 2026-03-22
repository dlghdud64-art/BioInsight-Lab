/**
 * Budget / Policy Guardrail Layer
 *
 * Cross-stage rule evaluation layer.
 * 각 procurement stage 진입/전이 시점에 평가되며,
 * 경고 / 조건부 진행 / 차단 3단계로 결과를 압축합니다.
 *
 * 화면마다 개별 하드코딩하지 않고, 이 공통 모델을 통해 평가합니다.
 */

import type { ProcurementStage, ApprovalPolicy, ApprovalStatus } from "./procurement-stage";

// ── Severity ────────────────────────────────────────────────────

export type GuardrailSeverity = "warning" | "conditional" | "blocked";

export const SEVERITY_CONFIG: Record<GuardrailSeverity, { label: string; color: string; bgColor: string; borderColor: string; icon: string }> = {
  warning:     { label: "경고",       color: "text-amber-400",   bgColor: "bg-amber-600/10",  borderColor: "border-amber-600/30",  icon: "AlertTriangle" },
  conditional: { label: "조건부 진행", color: "text-blue-400",    bgColor: "bg-blue-600/10",   borderColor: "border-blue-600/30",   icon: "Info" },
  blocked:     { label: "차단",       color: "text-red-400",     bgColor: "bg-red-600/10",    borderColor: "border-red-600/30",    icon: "AlertCircle" },
};

// ── Rule Types ──────────────────────────────────────────────────

export type GuardrailRuleType =
  | "budget"
  | "vendor_policy"
  | "document_requirement"
  | "hazardous_handling"
  | "inventory_status"
  | "reorder_constraint"
  | "approval_dependency";

// ── Rule Evaluation Result ──────────────────────────────────────

export interface GuardrailResult {
  ruleId: string;
  ruleType: GuardrailRuleType;
  severity: GuardrailSeverity;
  affectedStage: ProcurementStage | "all";
  message: string;
  blockingReason: string;
  recommendedAction: string;
  resolvable: boolean;
}

// ── Evaluation Context ──────────────────────────────────────────

export interface GuardrailContext {
  stage: ProcurementStage;
  totalAmount?: number;
  budgetLimit?: number;
  vendorApproved?: boolean;
  requiredDocs?: string[];
  presentDocs?: string[];
  isHazardous?: boolean;
  hazardousDocsReady?: boolean;
  approvalPolicy?: ApprovalPolicy;
  approvalStatus?: ApprovalStatus;
  lotRequired?: boolean;
  lotProvided?: boolean;
  expiryRequired?: boolean;
  expiryProvided?: boolean;
  locationRequired?: boolean;
  locationProvided?: boolean;
  quarantineActive?: boolean;
  disposalPending?: boolean;
}

// ── Core Evaluation Function ────────────────────────────────────

export function evaluateGuardrails(ctx: GuardrailContext): GuardrailResult[] {
  const results: GuardrailResult[] = [];

  // 1. Budget
  if (ctx.totalAmount != null && ctx.budgetLimit != null) {
    const ratio = ctx.totalAmount / ctx.budgetLimit;
    if (ratio > 1) {
      results.push({
        ruleId: "budget_exceeded",
        ruleType: "budget",
        severity: "blocked",
        affectedStage: ctx.stage,
        message: `예산 초과 (${Math.round(ratio * 100)}%)`,
        blockingReason: `총액 ₩${ctx.totalAmount.toLocaleString("ko-KR")}이 예산 한도 ₩${ctx.budgetLimit.toLocaleString("ko-KR")}을 초과`,
        recommendedAction: "예산 예외 사유 기록 또는 수량 조정",
        resolvable: true,
      });
    } else if (ratio > 0.9) {
      results.push({
        ruleId: "budget_warning",
        ruleType: "budget",
        severity: "warning",
        affectedStage: ctx.stage,
        message: `예산 90% 이상 사용 (${Math.round(ratio * 100)}%)`,
        blockingReason: "예산 한도에 근접",
        recommendedAction: "예산 여유 확인",
        resolvable: true,
      });
    }
  }

  // 2. Vendor Policy
  if (ctx.vendorApproved === false) {
    const stagesBlockedByVendor: ProcurementStage[] = ["po_conversion_candidate", "po_ready"];
    const isBlockingStage = stagesBlockedByVendor.includes(ctx.stage);
    results.push({
      ruleId: "unapproved_vendor",
      ruleType: "vendor_policy",
      severity: isBlockingStage ? "blocked" : "warning",
      affectedStage: ctx.stage,
      message: "미승인 공급사",
      blockingReason: "승인되지 않은 공급사 — 발주 전환 불가",
      recommendedAction: "승인 공급사로 변경 또는 공급사 승인 요청",
      resolvable: true,
    });
  }

  // 3. Document Requirement
  if (ctx.requiredDocs && ctx.presentDocs) {
    const missing = ctx.requiredDocs.filter(d => !ctx.presentDocs!.includes(d));
    if (missing.length > 0) {
      const requestStages: ProcurementStage[] = ["po_conversion_candidate", "po_ready"];
      const isBlockingStage = requestStages.includes(ctx.stage);
      results.push({
        ruleId: "docs_missing",
        ruleType: "document_requirement",
        severity: isBlockingStage ? "blocked" : "conditional",
        affectedStage: ctx.stage,
        message: `필수 문서 ${missing.length}건 누락 (${missing.join(", ")})`,
        blockingReason: `${missing.join(", ")} 미첨부`,
        recommendedAction: "문서 추가 요청 또는 공급사에 문서 요청",
        resolvable: true,
      });
    }
  }

  // 4. Hazardous Handling
  if (ctx.isHazardous) {
    if (!ctx.hazardousDocsReady) {
      results.push({
        ruleId: "hazardous_docs",
        ruleType: "hazardous_handling",
        severity: "conditional",
        affectedStage: ctx.stage,
        message: "위험물 취급 문서 확인 필요",
        blockingReason: "위험물/특수 취급 품목 — 추가 문서 필요",
        recommendedAction: "MSDS / 위험물 취급 허가 확인",
        resolvable: true,
      });
    }
  }

  // 5. Approval Dependency
  if (ctx.approvalPolicy && ctx.approvalPolicy !== "none" && ctx.approvalStatus) {
    const poStages: ProcurementStage[] = ["po_conversion_candidate", "po_ready"];
    if (poStages.includes(ctx.stage)) {
      if (ctx.approvalPolicy === "external_manual" && ctx.approvalStatus !== "externally_approved") {
        results.push({
          ruleId: "external_approval_pending",
          ruleType: "approval_dependency",
          severity: ctx.approvalStatus === "externally_rejected" ? "blocked" : "conditional",
          affectedStage: ctx.stage,
          message: ctx.approvalStatus === "externally_rejected" ? "외부 승인 반려" : "외부 승인 대기 중",
          blockingReason: "외부 승인이 완료되지 않음",
          recommendedAction: ctx.approvalStatus === "externally_rejected" ? "반려 사유 확인 후 재요청 또는 대안 검토" : "외부 승인 완료 후 진행",
          resolvable: true,
        });
      }
      if (ctx.approvalPolicy === "in_app_light" && ctx.approvalStatus !== "in_app_approved") {
        results.push({
          ruleId: "in_app_approval_pending",
          ruleType: "approval_dependency",
          severity: ctx.approvalStatus === "in_app_rejected" ? "blocked" : "conditional",
          affectedStage: ctx.stage,
          message: ctx.approvalStatus === "in_app_rejected" ? "내부 승인 반려" : "내부 승인 대기 중",
          blockingReason: "내부 승인이 완료되지 않음",
          recommendedAction: "승인 요청 확인",
          resolvable: true,
        });
      }
    }
  }

  // 6. Inventory Status (receiving / stocked stages)
  if (ctx.lotRequired && !ctx.lotProvided) {
    results.push({
      ruleId: "lot_missing",
      ruleType: "inventory_status",
      severity: "blocked",
      affectedStage: ctx.stage,
      message: "Lot 번호 필수 미입력",
      blockingReason: "필수 lot 정보 없이 재고 반영 불가",
      recommendedAction: "lot/batch 번호 입력",
      resolvable: true,
    });
  }
  if (ctx.expiryRequired && !ctx.expiryProvided) {
    results.push({
      ruleId: "expiry_missing",
      ruleType: "inventory_status",
      severity: "blocked",
      affectedStage: ctx.stage,
      message: "유효기한 필수 미입력",
      blockingReason: "필수 expiry 정보 없이 재고 반영 불가",
      recommendedAction: "유효기한 입력",
      resolvable: true,
    });
  }
  if (ctx.locationRequired && !ctx.locationProvided) {
    results.push({
      ruleId: "location_missing",
      ruleType: "inventory_status",
      severity: "blocked",
      affectedStage: ctx.stage,
      message: "보관 위치 필수 미지정",
      blockingReason: "보관 위치 없이 재고 반영 불가",
      recommendedAction: "보관 위치 지정",
      resolvable: true,
    });
  }
  if (ctx.quarantineActive) {
    results.push({
      ruleId: "quarantine_active",
      ruleType: "inventory_status",
      severity: "blocked",
      affectedStage: ctx.stage,
      message: "격리 상태 — 사용 불가",
      blockingReason: "격리 해제 전 재고 사용/반영 차단",
      recommendedAction: "격리 해제 또는 폐기 검토",
      resolvable: true,
    });
  }

  // 7. Reorder Constraint
  if (ctx.disposalPending) {
    results.push({
      ruleId: "disposal_pending",
      ruleType: "reorder_constraint",
      severity: "conditional",
      affectedStage: ctx.stage,
      message: "폐기 예정 재고 포함",
      blockingReason: "폐기 예정 lot가 수량에 포함되어 있음",
      recommendedAction: "폐기 lot 제외 후 재주문 수량 재계산",
      resolvable: true,
    });
  }

  return results;
}

// ── Helpers ─────────────────────────────────────────────────────

/** 차단 규칙이 있는지 확인 */
export function hasBlocker(results: GuardrailResult[]): boolean {
  return results.some(r => r.severity === "blocked");
}

/** severity별 개수 */
export function countBySeverity(results: GuardrailResult[]): Record<GuardrailSeverity, number> {
  return {
    warning: results.filter(r => r.severity === "warning").length,
    conditional: results.filter(r => r.severity === "conditional").length,
    blocked: results.filter(r => r.severity === "blocked").length,
  };
}

/** 단계 통과 가능 여부 (차단 없으면 통과) */
export function canProceed(results: GuardrailResult[]): boolean {
  return !hasBlocker(results);
}

/** 요약 문구 생성 */
export function getGuardrailSummary(results: GuardrailResult[]): string {
  const counts = countBySeverity(results);
  if (results.length === 0) return "모든 조건 충족";
  const parts: string[] = [];
  if (counts.blocked > 0) parts.push(`차단 ${counts.blocked}`);
  if (counts.conditional > 0) parts.push(`조건부 ${counts.conditional}`);
  if (counts.warning > 0) parts.push(`경고 ${counts.warning}`);
  return parts.join(" · ");
}
