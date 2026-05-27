/**
 * Request Draft Suggestion Action Gate
 *
 * 고정 규칙:
 * 1. gate가 hidden이면 개별 action은 모두 visible=false
 * 2. 우선순위: no suggestion > supplier mismatch > resolved > stale > sent > conflicted > redundant > visible
 * 3. hidden 되어야 할 상태에 disabled 버튼 잔상 금지
 * 4. handler 진입 시에도 동일 gate 재검증
 * 5. canonical state 기반만 사용, 임시 UI boolean 금지
 */

import type { SupplierRequestDraft } from "./request-draft-patch";
import type { RequestDraftSuggestion } from "./request-suggestion-store";

// ── Gate ──

export type RequestDraftSuggestionGate =
  | "hidden_no_suggestion"
  | "hidden_stale"
  | "hidden_resolved"
  | "hidden_supplier_mismatch"
  | "hidden_sent"
  | "hidden_conflicted"
  | "hidden_redundant"
  | "visible";

// ── Action state ──

export type ActionDisabledReason =
  | "none"
  | "stale"
  | "resolved"
  | "supplier_mismatch"
  | "sent"
  | "conflicted"
  | "redundant"
  | "applying"
  | "review_unavailable";

export interface RequestDraftActionState {
  visible: boolean;
  disabled: boolean;
  reason: ActionDisabledReason;
}

export interface RequestDraftSuggestionActionability {
  gate: RequestDraftSuggestionGate;
  accept: RequestDraftActionState;
  review: RequestDraftActionState;
  dismiss: RequestDraftActionState;
}

// ── Hidden action (reusable) ──

function hiddenAction(reason: ActionDisabledReason): RequestDraftActionState {
  return { visible: false, disabled: true, reason };
}

function enabledAction(): RequestDraftActionState {
  return { visible: true, disabled: false, reason: "none" };
}

function disabledAction(reason: ActionDisabledReason): RequestDraftActionState {
  return { visible: true, disabled: true, reason };
}

// ── Gate selector ──

export interface RequestDraftGateInput {
  suggestion: RequestDraftSuggestion | null;
  draft: SupplierRequestDraft | null;
  activeSupplierRequestId: string | null;
  assemblyStatus: "drafting" | "partial_ready" | "ready_to_send" | "sent";
  isResolvedContext: boolean;
  isStaleContext: boolean;
  isNoOp: boolean;
}

export function selectRequestDraftSuggestionGate(
  input: RequestDraftGateInput
): RequestDraftSuggestionGate {
  const { suggestion, draft, activeSupplierRequestId, assemblyStatus, isResolvedContext, isStaleContext, isNoOp } = input;

  // 1. No suggestion
  if (!suggestion || !draft) return "hidden_no_suggestion";

  // 2. Supplier mismatch
  if (!activeSupplierRequestId) return "hidden_supplier_mismatch";
  if (suggestion.sourceContext.supplierId !== activeSupplierRequestId) {
    return "hidden_supplier_mismatch";
  }

  // 3. Resolved
  if (isResolvedContext) return "hidden_resolved";

  // 4. Stale
  if (isStaleContext) return "hidden_stale";

  // 5. Sent
  if (draft.readiness === "sent" || assemblyStatus === "sent") return "hidden_sent";

  // 6. Conflicted
  if (draft.mergeState === "conflicted") return "hidden_conflicted";

  // 7. Redundant (ready_to_send + draft ready + no conflict)
  if (
    assemblyStatus === "ready_to_send" &&
    draft.readiness === "ready" &&
    (draft.mergeState as string) !== "conflicted"
  ) {
    return "hidden_redundant";
  }

  // 8. No-op (실질 변경 없음 → card/action row suppress)
  if (isNoOp) return "hidden_redundant";

  return "visible";
}

// ── Unified actionability selector ──

export interface ActionabilityInput extends RequestDraftGateInput {
  isApplying: boolean;
  canReview: boolean;
}

export function selectRequestDraftSuggestionActionability(
  input: ActionabilityInput
): RequestDraftSuggestionActionability {
  const gate = selectRequestDraftSuggestionGate(input);

  // Gate가 hidden이면 모든 action suppress
  if (gate !== "visible") {
    const reason: ActionDisabledReason =
      gate === "hidden_stale" ? "stale" :
      gate === "hidden_resolved" ? "resolved" :
      gate === "hidden_supplier_mismatch" ? "supplier_mismatch" :
      gate === "hidden_sent" ? "sent" :
      gate === "hidden_conflicted" ? "conflicted" :
      gate === "hidden_redundant" ? "redundant" :
      "stale";

    return {
      gate,
      accept: hiddenAction(reason),
      review: hiddenAction(reason),
      dismiss: hiddenAction(reason),
    };
  }

  // Gate visible → 액션별 세부 조건
  const { isApplying, canReview } = input;

  return {
    gate,
    accept: isApplying ? disabledAction("applying") : enabledAction(),
    review: isApplying
      ? disabledAction("applying")
      : canReview
        ? enabledAction()
        : disabledAction("review_unavailable"),
    dismiss: isApplying ? disabledAction("applying") : enabledAction(),
  };
}

// ── Handler guard ──

export function guardedAction(
  actionability: RequestDraftSuggestionActionability,
  action: "accept" | "review" | "dismiss"
): boolean {
  if (actionability.gate !== "visible") return false;
  const state = actionability[action];
  return state.visible && !state.disabled;
}
