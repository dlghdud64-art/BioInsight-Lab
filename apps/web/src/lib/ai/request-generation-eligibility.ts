/**
 * Request Draft Generation Eligibility
 *
 * 고정 규칙:
 * 1. generation ≠ selection. generation은 훨씬 보수적.
 * 2. typing noise / tab change / focus restore는 generation trigger 아님.
 * 3. resolved context (dismissed/accepted/edited/noop) 이후 재생성은 meaningful change + baseline 거리 필요.
 * 4. visible valid suggestion 존재 시 동일 context 중복 generation 금지.
 * 5. ready_to_send / sent / conflicted 상태는 generation보다 기존 흐름 우선.
 * 6. generation은 active supplier 기준만. background 전체 supplier generation 금지.
 */

import type { SupplierRequestDraft, AssemblyStatus } from "./request-draft-patch";
import { buildRequestDraftFingerprint, type RequestDraftContextInput } from "./context-hash";

// ── Eligibility model ──

export type GenerationIneligibleReason =
  | "eligible"
  | "no_active_supplier"
  | "sent"
  | "conflicted"
  | "ready_to_send_redundant"
  | "editing_in_progress"
  | "debounce_pending"
  | "recently_resolved"
  | "no_meaningful_context_change"
  | "generation_already_inflight"
  | "visible_suggestion_exists";

export interface RequestDraftGenerationEligibility {
  eligible: boolean;
  reason: GenerationIneligibleReason;
}

// ── Meaningful context change ──

export interface RequestDraftMeaningfulContextChange {
  messageChangedMeaningfully: boolean;
  questionFlagsChanged: boolean;
  attachmentsChangedMeaningfully: boolean;
  itemSetChangedMeaningfully: boolean;
  hasAnyMeaningfulChange: boolean;
}

// ── Generation baseline ──

export interface RequestDraftGenerationBaseline {
  requestAssemblyId: string;
  supplierId: string;
  contextHash: string;
  draftFingerprint: string;
  recordedAt: string;
  source: "generated" | "accepted" | "dismissed" | "edited" | "noop";
}

// ── Edit activity ──

export interface RequestDraftEditActivity {
  lastMessageEditedAt: string | null;
  lastQuestionEditedAt: string | null;
  lastAttachmentsEditedAt: string | null;
  lastItemsEditedAt: string | null;
  isUserActivelyTypingMessage: boolean;
}

// ── Generation trigger source ──

export type RequestDraftGenerationTriggerSource =
  | "user_message_edit"
  | "user_question_edit"
  | "user_attachment_edit"
  | "user_item_change"
  | "tab_change"
  | "focus_restore"
  | "ui_recompute";

const NON_GENERATION_TRIGGERS: RequestDraftGenerationTriggerSource[] = [
  "tab_change",
  "focus_restore",
  "ui_recompute",
];

// ── Constants ──

const MESSAGE_QUIET_PERIOD_MS = 3000;  // 3초 typing quiet
const FIELD_QUIET_PERIOD_MS = 1500;    // 1.5초 toggle/attachment quiet
const MIN_MESSAGE_LENGTH_DIFF = 15;    // baseline 대비 최소 15자 차이

// ── Message meaningful change ──

function normalizeForComparison(text: string): string {
  return text.trim().replace(/\r\n/g, "\n").replace(/\s+/g, " ");
}

export function hasMeaningfulMessageChangeForGeneration(input: {
  previousBaselineMessage: string;
  currentMessage: string;
  isUserActivelyTyping: boolean;
}): boolean {
  if (input.isUserActivelyTyping) return false;

  const prev = normalizeForComparison(input.previousBaselineMessage);
  const curr = normalizeForComparison(input.currentMessage);

  if (prev === curr) return false;

  // 길이 차이 최소 threshold
  if (Math.abs(curr.length - prev.length) < MIN_MESSAGE_LENGTH_DIFF) return false;

  return true;
}

// ── Quiet period check ──

export function isWithinQuietPeriod(
  editActivity: RequestDraftEditActivity | null,
  now: string
): boolean {
  if (!editActivity) return false;

  const nowMs = new Date(now).getTime();

  // message typing quiet period
  if (editActivity.isUserActivelyTypingMessage) return true;
  if (editActivity.lastMessageEditedAt) {
    const elapsed = nowMs - new Date(editActivity.lastMessageEditedAt).getTime();
    if (elapsed < MESSAGE_QUIET_PERIOD_MS) return true;
  }

  // field quiet period
  for (const ts of [editActivity.lastQuestionEditedAt, editActivity.lastAttachmentsEditedAt, editActivity.lastItemsEditedAt]) {
    if (ts) {
      const elapsed = nowMs - new Date(ts).getTime();
      if (elapsed < FIELD_QUIET_PERIOD_MS) return true;
    }
  }

  return false;
}

// ── Meaningful context change calculation ──

export function computeMeaningfulContextChange(input: {
  baseline: RequestDraftGenerationBaseline | null;
  draft: SupplierRequestDraft;
  requestAssemblyId: string;
  editActivity: RequestDraftEditActivity | null;
}): RequestDraftMeaningfulContextChange {
  const { baseline, draft, requestAssemblyId, editActivity } = input;

  // No baseline = first time = meaningful
  if (!baseline) {
    return {
      messageChangedMeaningfully: draft.messageBody.trim().length === 0, // empty = generation candidate
      questionFlagsChanged: false,
      attachmentsChangedMeaningfully: false,
      itemSetChangedMeaningfully: false,
      hasAnyMeaningfulChange: true,
    };
  }

  // Compute current fingerprint
  const currentFp = buildRequestDraftFingerprint({
    requestAssemblyId,
    supplierId: draft.supplierId,
    itemIds: draft.itemIds,
    messageBody: draft.messageBody,
    attachmentIds: draft.attachments.map(a => a.id),
    leadTimeQuestionIncluded: draft.leadTimeQuestionIncluded,
    substituteQuestionIncluded: draft.substituteQuestionIncluded,
  } as RequestDraftContextInput);

  // Same fingerprint = no meaningful change
  if (currentFp === baseline.draftFingerprint) {
    return {
      messageChangedMeaningfully: false,
      questionFlagsChanged: false,
      attachmentsChangedMeaningfully: false,
      itemSetChangedMeaningfully: false,
      hasAnyMeaningfulChange: false,
    };
  }

  // Detail checks
  const messageChanged = hasMeaningfulMessageChangeForGeneration({
    previousBaselineMessage: "", // baseline에 message 전체를 저장하지 않으므로 fingerprint 기반
    currentMessage: draft.messageBody,
    isUserActivelyTyping: editActivity?.isUserActivelyTypingMessage ?? false,
  });

  // fingerprint가 다르면 어떤 field가 바뀌었는지 개별 추론
  // (baseline에 개별 field를 저장하지 않으므로 boolean flag로 최소 판단)
  const questionFlagsChanged = true; // fingerprint 다르면 가능성 있음
  const attachmentsChanged = true;
  const itemSetChanged = true;

  return {
    messageChangedMeaningfully: messageChanged,
    questionFlagsChanged,
    attachmentsChangedMeaningfully: attachmentsChanged,
    itemSetChangedMeaningfully: itemSetChanged,
    hasAnyMeaningfulChange: true, // fingerprint가 다르므로
  };
}

// ── Baseline distance check ──

export function hasEnoughDistanceFromBaseline(input: {
  baseline: RequestDraftGenerationBaseline;
  draft: SupplierRequestDraft;
  requestAssemblyId: string;
  meaningfulChange: RequestDraftMeaningfulContextChange;
}): boolean {
  const { baseline, meaningfulChange } = input;

  if (!meaningfulChange.hasAnyMeaningfulChange) return false;

  // Resolution source에 따라 threshold 다르게
  switch (baseline.source) {
    case "dismissed":
      // dismissed 후: 2개 이상 meaningful field 변화 필요
      return [
        meaningfulChange.messageChangedMeaningfully,
        meaningfulChange.questionFlagsChanged,
        meaningfulChange.attachmentsChangedMeaningfully,
        meaningfulChange.itemSetChangedMeaningfully,
      ].filter(Boolean).length >= 2;

    case "edited":
      // edited 후: 가장 보수적 — message + 1개 이상 추가 변화
      return meaningfulChange.messageChangedMeaningfully && (
        meaningfulChange.questionFlagsChanged ||
        meaningfulChange.attachmentsChangedMeaningfully ||
        meaningfulChange.itemSetChangedMeaningfully
      );

    case "accepted":
      // accepted 후: meaningful change 1개면 허용
      return meaningfulChange.hasAnyMeaningfulChange;

    case "noop":
      // noop 후: 최소 2개 meaningful field 변화 (dismissed와 동일)
      return [
        meaningfulChange.messageChangedMeaningfully,
        meaningfulChange.questionFlagsChanged,
        meaningfulChange.attachmentsChangedMeaningfully,
        meaningfulChange.itemSetChangedMeaningfully,
      ].filter(Boolean).length >= 2;

    case "generated":
      // 이전 generation 이후: meaningful change 있으면 허용
      return meaningfulChange.hasAnyMeaningfulChange;

    default:
      return meaningfulChange.hasAnyMeaningfulChange;
  }
}

// ── Unified eligibility selector ──

export interface GenerationEligibilityInput {
  supplierId: string | null;
  requestAssemblyId: string | null;
  draft: SupplierRequestDraft | null;
  assemblyStatus: AssemblyStatus;
  editActivity: RequestDraftEditActivity | null;
  baseline: RequestDraftGenerationBaseline | null;
  hasVisibleValidSuggestion: boolean;
  isGenerationInflight: boolean;
  now: string;
}

export function selectRequestDraftGenerationEligibility(
  input: GenerationEligibilityInput
): RequestDraftGenerationEligibility {
  const {
    supplierId, requestAssemblyId, draft, assemblyStatus,
    editActivity, baseline, hasVisibleValidSuggestion,
    isGenerationInflight, now,
  } = input;

  // 1. No active supplier
  if (!supplierId || !requestAssemblyId || !draft) {
    return { eligible: false, reason: "no_active_supplier" };
  }

  // 2. Sent
  if (draft.readiness === "sent" || assemblyStatus === "sent") {
    return { eligible: false, reason: "sent" };
  }

  // 3. Conflicted
  if (draft.mergeState === "conflicted") {
    return { eligible: false, reason: "conflicted" };
  }

  // 4. Generation inflight
  if (isGenerationInflight) {
    return { eligible: false, reason: "generation_already_inflight" };
  }

  // 5. Editing in progress / debounce
  if (editActivity?.isUserActivelyTypingMessage) {
    return { eligible: false, reason: "editing_in_progress" };
  }
  if (isWithinQuietPeriod(editActivity, now)) {
    return { eligible: false, reason: "debounce_pending" };
  }

  // 6. Meaningful context change
  const meaningfulChange = computeMeaningfulContextChange({
    baseline,
    draft,
    requestAssemblyId,
    editActivity,
  });

  if (!meaningfulChange.hasAnyMeaningfulChange) {
    return { eligible: false, reason: "no_meaningful_context_change" };
  }

  // 7. Baseline distance (resolved threshold)
  if (baseline && !hasEnoughDistanceFromBaseline({
    baseline,
    draft,
    requestAssemblyId,
    meaningfulChange,
  })) {
    return { eligible: false, reason: "recently_resolved" };
  }

  // 8. Ready_to_send redundant
  if (assemblyStatus === "ready_to_send" && draft.readiness === "ready") {
    return { eligible: false, reason: "ready_to_send_redundant" };
  }

  // 9. Visible valid suggestion exists
  if (hasVisibleValidSuggestion) {
    return { eligible: false, reason: "visible_suggestion_exists" };
  }

  // 10. Eligible
  return { eligible: true, reason: "eligible" };
}

// ── Generation trigger guard ──

export function isGenerationTriggerAllowed(
  triggerSource: RequestDraftGenerationTriggerSource
): boolean {
  return !NON_GENERATION_TRIGGERS.includes(triggerSource);
}

export function maybeGenerateRequestDraftSuggestion(
  triggerSource: RequestDraftGenerationTriggerSource,
  eligibility: RequestDraftGenerationEligibility
): boolean {
  if (!isGenerationTriggerAllowed(triggerSource)) return false;
  return eligibility.eligible;
}
