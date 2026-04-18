/**
 * Bulk Action / Selection Model 계약
 *
 * selection = 반복 처리 가속 장치
 * bulk action = 같은 의미/조건의 항목에만 적용
 * 선택 가능/불가 기준이 예측 가능해야 함
 * 적용 범위와 결과가 명확해야 함
 */

// ═══════════════════════════════════════════════════
// Selection State
// ═══════════════════════════════════════════════════

export interface SelectionState<T = string> {
  selectedIds: Set<T>;
  selectableCount: number;
  totalCount: number;
  isAllSelected: boolean;
  hasSelection: boolean;
}

export function createEmptySelection<T = string>(): SelectionState<T> {
  return {
    selectedIds: new Set(),
    selectableCount: 0,
    totalCount: 0,
    isAllSelected: false,
    hasSelection: false,
  };
}

// ═══════════════════════════════════════════════════
// Eligibility — 선택 가능/불가 판정
// ═══════════════════════════════════════════════════

export type SelectionEligibility = "eligible" | "ineligible";

export interface ItemEligibility {
  id: string;
  eligibility: SelectionEligibility;
  reason?: string; // "차단 상태", "권한 부족", "선행 단계 미완료"
}

/** 항목별 선택 가능 여부 판정 */
export function checkEligibility(
  itemId: string,
  isBlocked: boolean,
  hasPermission: boolean,
  isRemoved: boolean,
): ItemEligibility {
  if (isRemoved) return { id: itemId, eligibility: "ineligible", reason: "제거된 항목" };
  if (!hasPermission) return { id: itemId, eligibility: "ineligible", reason: "권한 부족" };
  if (isBlocked) return { id: itemId, eligibility: "ineligible", reason: "차단 상태" };
  return { id: itemId, eligibility: "eligible" };
}

// ═══════════════════════════════════════════════════
// Bulk Action Types
// ═══════════════════════════════════════════════════

export type BulkActionType =
  | "approve"
  | "reject"
  | "exclude"
  | "restore"
  | "assign"
  | "send_to_compare"
  | "send_to_quote"
  | "export"
  | "tag"
  | "delete";

export type BulkActionCategory = "primary" | "secondary" | "destructive";

export interface BulkActionDefinition {
  type: BulkActionType;
  label: string;
  category: BulkActionCategory;
  requiresConfirm: boolean;
  /** 최소 선택 수 */
  minSelection: number;
  /** 선택 항목 중 이 상태만 허용 */
  allowedStatuses?: string[];
  /** 이 상태가 포함되면 불가 */
  blockedStatuses?: string[];
}

// ═══════════════════════════════════════════════════
// Bulk Action Definitions — 도메인별
// ═══════════════════════════════════════════════════

export const REVIEW_QUEUE_BULK_ACTIONS: BulkActionDefinition[] = [
  {
    type: "approve",
    label: "선택 항목 승인",
    category: "primary",
    requiresConfirm: false,
    minSelection: 1,
    allowedStatuses: ["confirmed", "needs_review"],
    blockedStatuses: ["excluded", "match_failed"],
  },
  {
    type: "send_to_compare",
    label: "비교에 담기",
    category: "secondary",
    requiresConfirm: false,
    minSelection: 1,
    blockedStatuses: ["match_failed", "excluded"],
  },
  {
    type: "exclude",
    label: "제외",
    category: "destructive",
    requiresConfirm: true,
    minSelection: 1,
  },
];

export const COMPARE_QUEUE_BULK_ACTIONS: BulkActionDefinition[] = [
  {
    type: "send_to_quote",
    label: "견적 초안으로 전송",
    category: "primary",
    requiresConfirm: false,
    minSelection: 1,
    allowedStatuses: ["selection_confirmed"],
  },
  {
    type: "delete",
    label: "비교 항목 제거",
    category: "destructive",
    requiresConfirm: true,
    minSelection: 1,
  },
];

export const QUOTE_DRAFT_BULK_ACTIONS: BulkActionDefinition[] = [
  {
    type: "approve",
    label: "선택 항목 제출",
    category: "primary",
    requiresConfirm: true,
    minSelection: 1,
    allowedStatuses: ["draft_ready"],
    blockedStatuses: ["missing_required_fields", "removed"],
  },
  {
    type: "exclude",
    label: "초안에서 제외",
    category: "destructive",
    requiresConfirm: true,
    minSelection: 1,
  },
];

// ═══════════════════════════════════════════════════
// Eligibility Check for Bulk Action
// ═══════════════════════════════════════════════════

export interface BulkActionEligibilityResult {
  eligible: string[];
  ineligible: Array<{ id: string; reason: string }>;
  canExecute: boolean;
  warningMessage?: string;
}

/** bulk action 실행 가능 여부 판정 */
export function checkBulkActionEligibility(
  selectedIds: string[],
  itemStatuses: Map<string, string>,
  actionDef: BulkActionDefinition,
): BulkActionEligibilityResult {
  const eligible: string[] = [];
  const ineligible: Array<{ id: string; reason: string }> = [];

  for (const id of selectedIds) {
    const status = itemStatuses.get(id);
    if (!status) {
      ineligible.push({ id, reason: "상태를 확인할 수 없습니다" });
      continue;
    }
    if (actionDef.blockedStatuses?.includes(status)) {
      ineligible.push({ id, reason: `${status} 상태에서는 이 작업을 수행할 수 없습니다` });
      continue;
    }
    if (actionDef.allowedStatuses && !actionDef.allowedStatuses.includes(status)) {
      ineligible.push({ id, reason: `${status} 상태는 이 작업의 대상이 아닙니다` });
      continue;
    }
    eligible.push(id);
  }

  const canExecute = eligible.length >= actionDef.minSelection;
  const warningMessage = ineligible.length > 0
    ? `선택한 ${selectedIds.length}건 중 ${eligible.length}건만 처리 가능합니다. ${ineligible.length}건은 상태 조건이 맞지 않습니다.`
    : undefined;

  return { eligible, ineligible, canExecute, warningMessage };
}

// ═══════════════════════════════════════════════════
// Bulk Action Result
// ═══════════════════════════════════════════════════

export interface BulkActionResult {
  totalRequested: number;
  succeeded: number;
  failed: number;
  failedItems: Array<{ id: string; reason: string }>;
  message: string;
}

/** 결과 메시지 생성 */
export function buildBulkResultMessage(result: BulkActionResult, actionLabel: string): string {
  if (result.failed === 0) {
    return `${result.succeeded}건 ${actionLabel} 완료`;
  }
  return `${result.succeeded}건 성공, ${result.failed}건 실패 — ${result.failedItems[0]?.reason ?? "일부 항목을 처리하지 못했습니다"}`;
}

// ═══════════════════════════════════════════════════
// Selection UI ViewModel
// ═══════════════════════════════════════════════════

export interface BulkActionBarViewModel {
  selectedCount: number;
  selectedLabel: string;       // "3개 항목 선택됨"
  availableActions: Array<{
    type: BulkActionType;
    label: string;
    category: BulkActionCategory;
    disabled: boolean;
    disabledReason?: string;
  }>;
  clearLabel: string;          // "선택 해제"
}

/** Bulk Action Bar ViewModel 생성 */
export function buildBulkActionBarViewModel(
  selectedIds: string[],
  itemStatuses: Map<string, string>,
  actionDefs: BulkActionDefinition[],
): BulkActionBarViewModel {
  return {
    selectedCount: selectedIds.length,
    selectedLabel: `${selectedIds.length}개 항목 선택됨`,
    availableActions: actionDefs.map((def) => {
      const result = checkBulkActionEligibility(selectedIds, itemStatuses, def);
      return {
        type: def.type,
        label: def.label,
        category: def.category,
        disabled: !result.canExecute,
        disabledReason: result.canExecute ? undefined : result.warningMessage,
      };
    }),
    clearLabel: "선택 해제",
  };
}
