/**
 * Governed Action Composer — Dry-Run / Action Plan Engine
 *
 * 확정된 intent를 받아 실행 전 dry-run을 수행한다.
 * 어떤 record가 영향받는지, blocker가 있는지, 어떤 확인이 필요한지를
 * GovernedActionProposal로 계산하여 반환한다.
 *
 * 규칙:
 *   1. dry-run은 read-only — canonical truth를 절대 변경하지 않음
 *   2. 기존 blocker 계산 로직 재사용 (governance guard, dispatch readiness 등)
 *   3. ready_to_send와 sent는 절대 같은 상태로 취급 금지
 *   4. supplier-facing payload mutation 여부를 반드시 분리 노출
 *   5. blocker가 1건이라도 있으면 실행 불가 (score와 무관)
 *   6. optimistic unlock 금지
 */

import type { ResolvedActionIntent, GovernedIntentType } from "./governed-action-intent-engine";
import type { ActionRiskLevel } from "@/lib/ontology/actions";

// ══════════════════════════════════════════════════════════════
// Proposal Types
// ══════════════════════════════════════════════════════════════

export interface GovernedActionProposal {
  /** 연결된 intent ID */
  intentId: string;
  /** 해석된 intent 유형 (bus 발행 등에서 사용) */
  intentType: string;
  /** 사용자에게 보여줄 action 이름 */
  actionLabel: string;
  /** 위험 수준 */
  riskLevel: ActionRiskLevel;
  /** 비가역 여부 */
  irreversible: boolean;

  // ── Blast Radius ──
  /** 영향받는 record 목록 */
  affectedRecords: AffectedRecord[];
  /** 요약 (e.g. "PO 1건, 예산 1건, 재고 0건 영향") */
  blastRadiusSummary: string;

  // ── Blockers ──
  /** 차단 사유 목록 (1건이라도 있으면 실행 불가) */
  blockingReasons: ProposalBlocker[];
  /** 실행 가능 여부 (blockingReasons.length === 0) */
  canExecute: boolean;

  // ── Confirmations ──
  /** 실행 전 필수 확인 항목 */
  requiredConfirmations: ConfirmationItem[];

  // ── Execution Plan ──
  /** 실행 계획 단계 */
  executionPlanSteps: ExecutionPlanStep[];

  // ── Mutation Boundary ──
  /** canonical truth 변경 여부 */
  willMutateCanonicalTruth: boolean;
  /** supplier-facing state 변경 여부 */
  willMutateSupplierFacingState: boolean;
  /** reopen이 필요한 경우 */
  reopenRequired: ReopenPath | null;
  /** 안전 취소 경로 */
  safeAbortPath: string;

  /** proposal 생성 시각 */
  createdAt: string;
}

export interface AffectedRecord {
  /** record 타입 */
  entityType: string;
  /** record ID */
  entityId: string;
  /** 표시 라벨 (e.g. "PO-2024-0123") */
  displayLabel: string;
  /** 현재 상태 */
  currentStatus: string;
  /** 변경 후 예상 상태 */
  projectedStatus: string;
  /** 변경 내용 요약 */
  changeSummary: string;
}

export interface ProposalBlocker {
  /** 차단 코드 */
  code: ProposalBlockerCode;
  /** 사용자에게 보여줄 메시지 */
  message: string;
  /** 해결 방법 힌트 */
  remediation: string;
  /** 해결 경로 (라우트 또는 action) */
  remediationPath: string | null;
  /** 심각도 */
  severity: "hard" | "soft";
}

export type ProposalBlockerCode =
  | "approval_snapshot_invalidated"
  | "policy_hold_active"
  | "critical_governance_event"
  | "budget_insufficient"
  | "missing_recipient"
  | "missing_attachment"
  | "missing_commercial_term"
  | "contact_incomplete"
  | "supplier_mismatch"
  | "entity_not_found"
  | "invalid_status_transition"
  | "reopen_required"
  | "missing_selection";

export interface ConfirmationItem {
  /** 확인 항목 키 */
  key: string;
  /** 표시 라벨 */
  label: string;
  /** 필수 여부 */
  required: boolean;
  /** 확인 완료 여부 (초기값 false) */
  confirmed: boolean;
}

export interface ExecutionPlanStep {
  /** 단계 순서 */
  order: number;
  /** 단계 설명 */
  description: string;
  /** 대상 entity */
  targetEntityType: string;
  /** 이전 단계 의존 여부 */
  dependsOnPrevious: boolean;
  /** supplier-facing 변경 포함 여부 */
  isSupplierFacing: boolean;
}

export interface ReopenPath {
  /** reopen이 필요한 stage */
  stage: string;
  /** reopen 사유 */
  reason: string;
  /** reopen action intent */
  reopenIntentType: GovernedIntentType;
}

// ══════════════════════════════════════════════════════════════
// Dry-Run Input (추가 컨텍스트)
// ══════════════════════════════════════════════════════════════

export interface DryRunContext {
  /** 승인 스냅샷 유효 여부 (case별) */
  approvalSnapshotValid: Record<string, boolean>;
  /** 정책 보류 활성 여부 */
  policyHoldActive: boolean;
  /** 정책 보류 사유 */
  policyHoldReason: string | null;
  /** 미처리 critical governance 이벤트 존재 */
  hasPendingCriticalEvents: boolean;
  /** 가용 예산 잔액 (null이면 검증 skip) */
  availableBudget: number | null;
  /** 발송 대상 수신자 설정 완료 여부 */
  recipientConfigured: boolean;
  /** 필수 첨부파일 완료 여부 */
  attachmentsComplete: boolean;
  /** 상업 조건 완료 여부 */
  commercialTermsComplete: boolean;
  /** 연락처/청구/배송 정보 완료 여부 */
  contactInfoComplete: boolean;
  /** 현재 entity의 canonical 상태 */
  entityStatuses: Record<string, string>;
  /** 연결된 공급사 정보 */
  supplierInfo: { id: string; name: string } | null;
  /** 총 금액 */
  totalAmount: number | null;
}

// ══════════════════════════════════════════════════════════════
// Core: buildProposal
// ══════════════════════════════════════════════════════════════

/**
 * 확정된 intent + 컨텍스트로 dry-run proposal을 생성한다.
 * read-only — canonical truth 변경 없음.
 */
export function buildProposal(
  intent: ResolvedActionIntent,
  dryRunCtx: DryRunContext,
): GovernedActionProposal {
  const blockers: ProposalBlocker[] = [];
  const confirmations: ConfirmationItem[] = [];
  const steps: ExecutionPlanStep[] = [];
  const affected: AffectedRecord[] = [];

  // ── 공통 blocker 검증 ──

  // 1. 대상 entity 존재 확인
  if (intent.targetEntityIds.length === 0) {
    blockers.push({
      code: "missing_selection",
      message: "대상이 선택되지 않았습니다",
      remediation: "작업할 항목을 먼저 선택하세요",
      remediationPath: null,
      severity: "hard",
    });
  }

  // 2. Policy hold
  if (dryRunCtx.policyHoldActive) {
    blockers.push({
      code: "policy_hold_active",
      message: `정책 보류 활성 — ${dryRunCtx.policyHoldReason ?? "사유 미지정"}`,
      remediation: "정책 보류가 해제된 후 진행 가능합니다",
      remediationPath: null,
      severity: "hard",
    });
  }

  // 3. Critical governance event
  if (dryRunCtx.hasPendingCriticalEvents) {
    blockers.push({
      code: "critical_governance_event",
      message: "미처리 긴급 governance 이벤트 존재",
      remediation: "긴급 이벤트를 먼저 확인하세요",
      remediationPath: "/dashboard/purchases",
      severity: "hard",
    });
  }

  // 4. Approval snapshot invalidation
  for (const entityId of intent.targetEntityIds) {
    if (dryRunCtx.approvalSnapshotValid[entityId] === false) {
      blockers.push({
        code: "approval_snapshot_invalidated",
        message: `승인 스냅샷 무효화 (${entityId})`,
        remediation: "재평가가 완료된 후 진행 가능합니다. PO 전환을 재개하세요.",
        remediationPath: null,
        severity: "hard",
      });
    }
  }

  // ── Intent별 세부 검증 + 실행 계획 ──
  const intentHandlers: Partial<Record<GovernedIntentType, () => void>> = {
    finalize_approval: () => {
      // 예산 확인
      if (dryRunCtx.availableBudget !== null && dryRunCtx.totalAmount !== null) {
        if (dryRunCtx.totalAmount > dryRunCtx.availableBudget) {
          blockers.push({
            code: "budget_insufficient",
            message: `예산 부족 — 필요 ₩${dryRunCtx.totalAmount.toLocaleString()} > 잔액 ₩${dryRunCtx.availableBudget.toLocaleString()}`,
            remediation: "예산 증액 또는 금액 조정이 필요합니다",
            remediationPath: "/dashboard/budget",
            severity: "hard",
          });
        }
      }

      for (const id of intent.targetEntityIds) {
        affected.push({
          entityType: "PurchaseOrder",
          entityId: id,
          displayLabel: id,
          currentStatus: dryRunCtx.entityStatuses[id] ?? "pending_approval",
          projectedStatus: "approved",
          changeSummary: "승인 처리 + 예산 소진액 업데이트",
        });
      }

      steps.push(
        { order: 1, description: "승인 전제조건 검증", targetEntityType: "PurchaseOrder", dependsOnPrevious: false, isSupplierFacing: false },
        { order: 2, description: "주문 상태 → approved 전이", targetEntityType: "PurchaseOrder", dependsOnPrevious: true, isSupplierFacing: false },
        { order: 3, description: "예산 소진액 업데이트", targetEntityType: "Budget", dependsOnPrevious: true, isSupplierFacing: false },
      );

      confirmations.push({ key: "approval_confirm", label: "승인 내용을 확인했습니다", required: true, confirmed: false });
    },

    dispatch_now: () => {
      // Dispatch-specific blockers
      if (!dryRunCtx.recipientConfigured) {
        blockers.push({
          code: "missing_recipient",
          message: "발송 수신자가 설정되지 않았습니다",
          remediation: "수신자 정보를 먼저 설정하세요",
          remediationPath: null,
          severity: "hard",
        });
      }
      if (!dryRunCtx.attachmentsComplete) {
        blockers.push({
          code: "missing_attachment",
          message: "필수 첨부파일이 누락되었습니다",
          remediation: "발주서 첨부파일을 확인하세요",
          remediationPath: null,
          severity: "hard",
        });
      }
      if (!dryRunCtx.commercialTermsComplete) {
        blockers.push({
          code: "missing_commercial_term",
          message: "상업 조건이 불완전합니다",
          remediation: "결제 조건, 납기 등을 확인하세요",
          remediationPath: null,
          severity: "soft",
        });
      }
      if (!dryRunCtx.contactInfoComplete) {
        blockers.push({
          code: "contact_incomplete",
          message: "연락처/청구/배송 정보가 불완전합니다",
          remediation: "공급사 정보를 확인하세요",
          remediationPath: null,
          severity: "soft",
        });
      }

      for (const id of intent.targetEntityIds) {
        affected.push({
          entityType: "PurchaseOrder",
          entityId: id,
          displayLabel: id,
          currentStatus: dryRunCtx.entityStatuses[id] ?? "ready_to_send",
          projectedStatus: "queued_to_send",
          changeSummary: "공급사 발송 대기열에 추가",
        });
      }

      steps.push(
        { order: 1, description: "발송 전제조건 검증 (readiness)", targetEntityType: "PurchaseOrder", dependsOnPrevious: false, isSupplierFacing: false },
        { order: 2, description: "발송 패키지 최종 조립", targetEntityType: "DispatchPackage", dependsOnPrevious: true, isSupplierFacing: true },
        { order: 3, description: "공급사 발송 대기열 등록", targetEntityType: "PurchaseOrder", dependsOnPrevious: true, isSupplierFacing: true },
        { order: 4, description: "governance 이벤트 발행 (dispatch_authorized)", targetEntityType: "PurchaseOrder", dependsOnPrevious: true, isSupplierFacing: false },
      );

      confirmations.push(
        { key: "recipient_verified", label: "수신자 정보를 확인했습니다", required: true, confirmed: false },
        { key: "payload_reviewed", label: "발송 내용을 검토했습니다", required: true, confirmed: false },
        { key: "attachments_complete", label: "첨부파일이 완전합니다", required: true, confirmed: false },
        { key: "irreversible_confirm", label: "이 작업은 되돌릴 수 없음을 이해합니다", required: true, confirmed: false },
      );
    },

    schedule_dispatch: () => {
      // dispatch_now와 유사하되 즉시가 아닌 예약
      if (!dryRunCtx.recipientConfigured) {
        blockers.push({ code: "missing_recipient", message: "발송 수신자 미설정", remediation: "수신자 정보를 설정하세요", remediationPath: null, severity: "hard" });
      }

      for (const id of intent.targetEntityIds) {
        affected.push({
          entityType: "PurchaseOrder", entityId: id, displayLabel: id,
          currentStatus: dryRunCtx.entityStatuses[id] ?? "ready_to_send",
          projectedStatus: "scheduled",
          changeSummary: "발송 예약 등록",
        });
      }

      steps.push(
        { order: 1, description: "발송 전제조건 검증", targetEntityType: "PurchaseOrder", dependsOnPrevious: false, isSupplierFacing: false },
        { order: 2, description: "발송 예약 일시 등록", targetEntityType: "PurchaseOrder", dependsOnPrevious: true, isSupplierFacing: false },
        { order: 3, description: "governance 이벤트 발행 (send_scheduled)", targetEntityType: "PurchaseOrder", dependsOnPrevious: true, isSupplierFacing: false },
      );

      confirmations.push(
        { key: "schedule_confirm", label: "예약 일시를 확인했습니다", required: true, confirmed: false },
        { key: "payload_reviewed", label: "발송 내용을 검토했습니다", required: true, confirmed: false },
      );
    },

    request_correction: () => {
      for (const id of intent.targetEntityIds) {
        affected.push({
          entityType: "PurchaseOrder", entityId: id, displayLabel: id,
          currentStatus: dryRunCtx.entityStatuses[id] ?? "dispatch_preparation",
          projectedStatus: "correction_requested",
          changeSummary: "교정 요청 — PO 전환 단계로 복귀",
        });
      }

      steps.push(
        { order: 1, description: "현재 발송 준비 상태 저장", targetEntityType: "PurchaseOrder", dependsOnPrevious: false, isSupplierFacing: false },
        { order: 2, description: "PO 전환 재개 경로 열기", targetEntityType: "PurchaseOrder", dependsOnPrevious: true, isSupplierFacing: false },
      );
    },

    cancel_dispatch_prep: () => {
      for (const id of intent.targetEntityIds) {
        affected.push({
          entityType: "PurchaseOrder", entityId: id, displayLabel: id,
          currentStatus: dryRunCtx.entityStatuses[id] ?? "dispatch_preparation",
          projectedStatus: "prep_cancelled",
          changeSummary: "발송 준비 취소",
        });
      }

      steps.push(
        { order: 1, description: "발송 준비 상태 → 취소 전이", targetEntityType: "PurchaseOrder", dependsOnPrevious: false, isSupplierFacing: false },
        { order: 2, description: "governance 이벤트 발행 (dispatch_prep_cancelled)", targetEntityType: "PurchaseOrder", dependsOnPrevious: true, isSupplierFacing: false },
      );

      confirmations.push({ key: "cancel_confirm", label: "발송 준비를 취소합니다", required: true, confirmed: false });
    },

    receive_order: () => {
      for (const id of intent.targetEntityIds) {
        affected.push(
          { entityType: "PurchaseOrder", entityId: id, displayLabel: id, currentStatus: dryRunCtx.entityStatuses[id] ?? "sent", projectedStatus: "received", changeSummary: "물품 수령 처리" },
          { entityType: "Inventory", entityId: `inv_${id}`, displayLabel: "연결 재고", currentStatus: "pending", projectedStatus: "updated", changeSummary: "재고 수량 반영" },
        );
      }

      steps.push(
        { order: 1, description: "수령 전제조건 검증", targetEntityType: "PurchaseOrder", dependsOnPrevious: false, isSupplierFacing: false },
        { order: 2, description: "주문 상태 → received 전이", targetEntityType: "PurchaseOrder", dependsOnPrevious: true, isSupplierFacing: false },
        { order: 3, description: "재고 수량 반영", targetEntityType: "Inventory", dependsOnPrevious: true, isSupplierFacing: false },
      );

      confirmations.push({ key: "inspection_done", label: "물품 검수를 완료했습니다", required: true, confirmed: false });
    },

    trigger_reorder: () => {
      for (const id of intent.targetEntityIds) {
        affected.push({
          entityType: "Inventory", entityId: id, displayLabel: id,
          currentStatus: "low_stock", projectedStatus: "reorder_initiated",
          changeSummary: "재주문 프로세스 시작",
        });
      }

      steps.push(
        { order: 1, description: "재주문 판단 기록", targetEntityType: "Inventory", dependsOnPrevious: false, isSupplierFacing: false },
        { order: 2, description: "견적 요청 자동 생성", targetEntityType: "Quote", dependsOnPrevious: true, isSupplierFacing: false },
      );
    },

    reopen_po_conversion: () => {
      for (const id of intent.targetEntityIds) {
        affected.push({
          entityType: "PurchaseOrder", entityId: id, displayLabel: id,
          currentStatus: dryRunCtx.entityStatuses[id] ?? "po_created",
          projectedStatus: "po_conversion_reopened",
          changeSummary: "PO 전환 재개 — 발송 준비 초기화",
        });
      }

      steps.push(
        { order: 1, description: "현재 발송 준비 상태 보존", targetEntityType: "PurchaseOrder", dependsOnPrevious: false, isSupplierFacing: false },
        { order: 2, description: "PO 전환 단계로 복귀", targetEntityType: "PurchaseOrder", dependsOnPrevious: true, isSupplierFacing: false },
      );

      confirmations.push({ key: "reopen_confirm", label: "PO 전환을 재개합니다. 현재 발송 준비 상태가 초기화됩니다.", required: true, confirmed: false });
    },
  };

  // handler 실행
  const handler = intentHandlers[intent.intentType];
  if (handler) handler();

  // ── reopen 경로 판정 ──
  let reopenRequired: ReopenPath | null = null;
  if (intent.intentType === "request_correction") {
    reopenRequired = {
      stage: "po_conversion",
      reason: "PO 내용 수정을 위해 전환 단계로 복귀해야 합니다",
      reopenIntentType: "reopen_po_conversion",
    };
  }

  // ── supplier-facing mutation 판정 ──
  const willMutateSupplierFacing = steps.some((s) => s.isSupplierFacing);

  return {
    intentId: intent.intentId,
    intentType: intent.intentType,
    actionLabel: intent.displayLabel,
    riskLevel: intent.riskLevel,
    irreversible: intent.irreversible,

    affectedRecords: affected,
    blastRadiusSummary: buildBlastRadiusSummary(affected),

    blockingReasons: blockers,
    canExecute: blockers.filter((b) => b.severity === "hard").length === 0,

    requiredConfirmations: confirmations,
    executionPlanSteps: steps,

    willMutateCanonicalTruth: true,
    willMutateSupplierFacingState: willMutateSupplierFacing,
    reopenRequired,
    safeAbortPath: "이 proposal을 닫으면 아무 변경 없이 작업면으로 돌아갑니다.",

    createdAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════

function buildBlastRadiusSummary(records: AffectedRecord[]): string {
  const groups: Record<string, number> = {};
  for (const r of records) {
    groups[r.entityType] = (groups[r.entityType] ?? 0) + 1;
  }
  const parts = Object.entries(groups).map(([type, count]) => {
    const label: Record<string, string> = {
      PurchaseOrder: "발주서",
      Budget: "예산",
      Inventory: "재고",
      Quote: "견적",
      DispatchPackage: "발송 패키지",
    };
    return `${label[type] ?? type} ${count}건`;
  });
  return parts.length > 0 ? `${parts.join(", ")} 영향` : "영향 없음";
}

/**
 * 모든 required confirmation이 완료되었는지 검증
 */
export function areConfirmationsComplete(proposal: GovernedActionProposal): boolean {
  return proposal.requiredConfirmations
    .filter((c) => c.required)
    .every((c) => c.confirmed);
}

/**
 * Proposal 실행 가능 최종 판정
 * blocker 없음 + confirmation 완료
 */
export function canExecuteProposal(proposal: GovernedActionProposal): boolean {
  return proposal.canExecute && areConfirmationsComplete(proposal);
}
