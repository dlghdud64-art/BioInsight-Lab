/**
 * Request Draft Meaningful Context Change — category-aware generation 가치 판단
 *
 * 고정 규칙:
 * 1. meaningful change ≠ edit activity. edit activity는 "편집 중인지", meaningful change는 "generation 가치가 있는지".
 * 2. message는 가장 보수적. question/attachment/item은 구조적 변화로 더 높은 신뢰.
 * 3. baseline source별 threshold 분리: dismissed/edited/noop → strict, accepted/generated → normal.
 * 4. formatting-only/ordering-only/미세 변화는 meaningful change 아님.
 * 5. baseline comparable payload 기반 category별 비교.
 */

import type { SupplierRequestDraft } from "./request-draft-patch";
import type { RequestDraftGenerationBaselineSource } from "./request-resolution-baseline";

// ── Baseline comparable payload (최소 필드만) ──

export interface RequestDraftBaselineComparable {
  messageBody: string;
  leadTimeQuestionIncluded: boolean;
  substituteQuestionIncluded: boolean;
  attachmentIds: string[];
  itemIds: string[];
}

export function buildBaselineComparable(draft: SupplierRequestDraft): RequestDraftBaselineComparable {
  return {
    messageBody: draft.messageBody,
    leadTimeQuestionIncluded: draft.leadTimeQuestionIncluded,
    substituteQuestionIncluded: draft.substituteQuestionIncluded,
    attachmentIds: draft.attachments.map(a => a.id),
    itemIds: [...draft.itemIds],
  };
}

// ── Meaningful change model ──

export type MeaningfulChangeCategory = "messageBody" | "questionFlags" | "attachments" | "itemIds";

export interface RequestDraftMeaningfulContextChange {
  messageChangedMeaningfully: boolean;
  questionFlagsChangedMeaningfully: boolean;
  attachmentsChangedMeaningfully: boolean;
  itemSetChangedMeaningfully: boolean;
  meaningfulKeys: MeaningfulChangeCategory[];
  hasAnyMeaningfulChange: boolean;
}

// ── Threshold ──

export type MeaningfulChangeThreshold = "strict" | "normal";

export function getMeaningfulChangeThreshold(input: {
  baselineSource: RequestDraftGenerationBaselineSource | null;
  category: "message" | "question" | "attachments" | "items";
}): MeaningfulChangeThreshold {
  const { baselineSource, category } = input;

  // message는 기본적으로 보수적
  if (category === "message") {
    if (!baselineSource) return "normal";
    if (baselineSource === "dismissed" || baselineSource === "edited" || baselineSource === "noop") return "strict";
    return "normal";
  }

  // question/attachment/item은 구조적 변화이므로 상대적으로 관대
  if (!baselineSource) return "normal";
  if (baselineSource === "noop") return "strict"; // noop 후에는 구조 변화도 보수적
  return "normal";
}

// ── Message comparison ──

function normalizeMessage(text: string): string {
  return text.trim().replace(/\r\n/g, "\n").replace(/\s+/g, " ");
}

const MIN_MESSAGE_DIFF_CHARS_NORMAL = 15;
const MIN_MESSAGE_DIFF_CHARS_STRICT = 30;
const MIN_MESSAGE_WORD_DIFF_STRICT = 3;

function countWordDiff(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  let diff = 0;
  for (const w of wordsB) if (!wordsA.has(w)) diff++;
  for (const w of wordsA) if (!wordsB.has(w)) diff++;
  return diff;
}

export function isMeaningfulMessageChange(input: {
  baselineMessage: string | null;
  currentMessage: string;
  baselineSource: RequestDraftGenerationBaselineSource | null;
}): boolean {
  const baseline = normalizeMessage(input.baselineMessage ?? "");
  const current = normalizeMessage(input.currentMessage);

  // 동일 → false
  if (baseline === current) return false;
  // 빈 current → false
  if (!current) return false;
  // baseline 없었는데 current가 생김 → true (첫 작성)
  if (!baseline && current.length >= 10) return true;

  const threshold = getMeaningfulChangeThreshold({
    baselineSource: input.baselineSource,
    category: "message",
  });

  const charDiff = Math.abs(current.length - baseline.length);
  const wordDiff = countWordDiff(baseline, current);

  if (threshold === "strict") {
    // strict: 30자+ 차이 또는 3단어+ 차이
    return charDiff >= MIN_MESSAGE_DIFF_CHARS_STRICT || wordDiff >= MIN_MESSAGE_WORD_DIFF_STRICT;
  }

  // normal: 15자+ 차이
  return charDiff >= MIN_MESSAGE_DIFF_CHARS_NORMAL;
}

// ── Question flags comparison ──

export function haveQuestionFlagsChangedMeaningfully(input: {
  baselineComparable: RequestDraftBaselineComparable | null;
  draft: SupplierRequestDraft;
}): boolean {
  if (!input.baselineComparable) return false; // baseline 없으면 보수적
  return (
    input.baselineComparable.leadTimeQuestionIncluded !== input.draft.leadTimeQuestionIncluded ||
    input.baselineComparable.substituteQuestionIncluded !== input.draft.substituteQuestionIncluded
  );
}

// ── Attachments comparison (set 기준, ordering 제외) ──

export function haveAttachmentsChangedMeaningfully(input: {
  baselineAttachmentIds: string[] | null;
  currentAttachmentIds: string[];
}): boolean {
  if (!input.baselineAttachmentIds) return input.currentAttachmentIds.length > 0;

  const baseSet = new Set(input.baselineAttachmentIds);
  const currSet = new Set(input.currentAttachmentIds);

  if (baseSet.size !== currSet.size) return true;
  for (const id of currSet) if (!baseSet.has(id)) return true;
  for (const id of baseSet) if (!currSet.has(id)) return true;
  return false;
}

// ── ItemIds comparison (set 기준, ordering 제외) ──

export function hasItemSetChangedMeaningfully(input: {
  baselineItemIds: string[] | null;
  currentItemIds: string[];
}): boolean {
  if (!input.baselineItemIds) return input.currentItemIds.length > 0;

  const baseSet = new Set(input.baselineItemIds);
  const currSet = new Set(input.currentItemIds);

  if (baseSet.size !== currSet.size) return true;
  for (const id of currSet) if (!baseSet.has(id)) return true;
  for (const id of baseSet) if (!currSet.has(id)) return true;
  return false;
}

// ── Unified meaningful change computation ──

export interface MeaningfulChangeInput {
  baseline: {
    source: RequestDraftGenerationBaselineSource;
    comparable: RequestDraftBaselineComparable;
  } | null;
  draft: SupplierRequestDraft;
}

export function computeMeaningfulContextChange(
  input: MeaningfulChangeInput
): RequestDraftMeaningfulContextChange {
  const { baseline, draft } = input;
  const baselineSource = baseline?.source ?? null;
  const comparable = baseline?.comparable ?? null;

  // ── Category 판단 (우선순위: items > attachments > questions > message) ──

  const itemSetChangedMeaningfully = hasItemSetChangedMeaningfully({
    baselineItemIds: comparable?.itemIds ?? null,
    currentItemIds: draft.itemIds,
  });

  const attachmentsChangedMeaningfully = haveAttachmentsChangedMeaningfully({
    baselineAttachmentIds: comparable?.attachmentIds ?? null,
    currentAttachmentIds: draft.attachments.map(a => a.id),
  });

  const questionFlagsChangedMeaningfully = haveQuestionFlagsChangedMeaningfully({
    baselineComparable: comparable,
    draft,
  });

  const messageChangedMeaningfully = isMeaningfulMessageChange({
    baselineMessage: comparable?.messageBody ?? null,
    currentMessage: draft.messageBody,
    baselineSource,
  });

  // ── meaningfulKeys (우선순위 순서) ──
  const meaningfulKeys: MeaningfulChangeCategory[] = [];
  if (itemSetChangedMeaningfully) meaningfulKeys.push("itemIds");
  if (attachmentsChangedMeaningfully) meaningfulKeys.push("attachments");
  if (questionFlagsChangedMeaningfully) meaningfulKeys.push("questionFlags");
  if (messageChangedMeaningfully) meaningfulKeys.push("messageBody");

  return {
    messageChangedMeaningfully,
    questionFlagsChangedMeaningfully,
    attachmentsChangedMeaningfully,
    itemSetChangedMeaningfully,
    meaningfulKeys,
    hasAnyMeaningfulChange: meaningfulKeys.length > 0,
  };
}

// ── Baseline distance (source별 threshold + category 조합) ──

export function hasEnoughDistanceFromBaseline(input: {
  baseline: { source: RequestDraftGenerationBaselineSource; comparable: RequestDraftBaselineComparable };
  change: RequestDraftMeaningfulContextChange;
}): boolean {
  const { baseline, change } = input;

  if (!change.hasAnyMeaningfulChange) return false;

  // 구조 변화 (items/attachments/questions)가 있으면 대부분 허용
  const hasStructuralChange =
    change.itemSetChangedMeaningfully ||
    change.attachmentsChangedMeaningfully ||
    change.questionFlagsChangedMeaningfully;

  switch (baseline.source) {
    case "dismissed":
    case "noop":
      // 가장 보수적: 구조 변화 2개+ 또는 구조 1개 + message
      if (hasStructuralChange && change.meaningfulKeys.length >= 2) return true;
      return false;

    case "edited":
      // 보수적: 구조 변화 1개+ 필수
      return hasStructuralChange;

    case "accepted":
      // normal: meaningful change 1개면 허용
      return change.hasAnyMeaningfulChange;

    case "generated":
      // normal: meaningful change 있으면 허용
      return change.hasAnyMeaningfulChange;

    default:
      return change.hasAnyMeaningfulChange;
  }
}
