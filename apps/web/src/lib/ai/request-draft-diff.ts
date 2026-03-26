/**
 * Request Draft Patch Diff — canonical diff 기준 실질 변경 판단
 *
 * 고정 규칙:
 * 1. patch field 존재 ≠ effective change. canonical draft 대비 실제 변경만 true.
 * 2. preview는 effective diff 기준만. payload raw field로 preview 생성 금지.
 * 3. no-op suggestion은 card/action row suppress. disabled 버튼 잔상 금지.
 * 4. diff util과 applySupplierDraftPatch() merge semantics 일치.
 * 5. no-op suppress는 새 status echo를 만들지 않음.
 */

import type { SupplierRequestDraft, SupplierDraftPatch, AttachmentRef } from "./request-draft-patch";

// ── Types ──

export type RequestDraftEffectiveChangeKey =
  | "messageBody"
  | "leadTimeQuestionIncluded"
  | "substituteQuestionIncluded"
  | "attachments"
  | "questions"
  | "requestedFields"
  | "notes";

export interface RequestDraftEffectiveChange {
  key: RequestDraftEffectiveChangeKey;
  kind: "replace" | "merge" | "toggle" | "append";
  changed: boolean;
}

export interface RequestDraftPatchDiff {
  hasEffectiveChanges: boolean;
  changes: RequestDraftEffectiveChange[];
}

export interface RequestDraftPreviewMetrics {
  addedAttachmentCount: number;
  addedQuestionCount: number;
  addedFieldCount: number;
}

export interface EffectivePreviewItem {
  key: "message" | "lead_time" | "substitute" | "attachments" | "questions" | "fields" | "notes";
  label: string;
}

// ── Normalize ──

function normalizeMessageBody(text: string): string {
  return text
    .trim()
    .replace(/\r\n/g, "\n")   // line ending
    .replace(/\n{3,}/g, "\n\n"); // triple+ newline → double
}

// ── Merge helpers (must match applySupplierDraftPatch semantics) ──

function mergeUniqueById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const existingIds = new Set(current.map(x => x.id));
  const newItems = incoming.filter(x => !existingIds.has(x.id));
  return [...current, ...newItems];
}

function isEqualAttachmentList(a: AttachmentRef[], b: AttachmentRef[]): boolean {
  if (a.length !== b.length) return false;
  const aIds = a.map(x => x.id).sort();
  const bIds = b.map(x => x.id).sort();
  return aIds.every((id, i) => id === bIds[i]);
}

function mergeUniqueByText(current: Array<{ text?: string; label?: string }>, incoming: Array<{ text?: string; label?: string }>, key: "text" | "label"): number {
  const existingSet = new Set(current.map(x => (x[key] || "").toLowerCase()));
  return incoming.filter(x => !existingSet.has((x[key] || "").toLowerCase())).length;
}

// ── Core diff ──

export function diffRequestDraftPatch(input: {
  draft: SupplierRequestDraft;
  patch: SupplierDraftPatch;
}): RequestDraftPatchDiff {
  const { draft, patch } = input;
  const fields = patch.fields;
  const changes: RequestDraftEffectiveChange[] = [];

  // messageBody
  if (typeof fields.messageBody === "string") {
    const current = normalizeMessageBody(draft.messageBody);
    const incoming = normalizeMessageBody(fields.messageBody);
    changes.push({ key: "messageBody", kind: "replace", changed: current !== incoming });
  }

  // boolean flags
  if (typeof fields.leadTimeQuestionIncluded === "boolean") {
    changes.push({
      key: "leadTimeQuestionIncluded",
      kind: "toggle",
      changed: draft.leadTimeQuestionIncluded !== fields.leadTimeQuestionIncluded,
    });
  }

  if (typeof fields.substituteQuestionIncluded === "boolean") {
    changes.push({
      key: "substituteQuestionIncluded",
      kind: "toggle",
      changed: draft.substituteQuestionIncluded !== fields.substituteQuestionIncluded,
    });
  }

  // attachments (merge semantics)
  if (Array.isArray(fields.attachments)) {
    const merged = mergeUniqueById(draft.attachments, fields.attachments as AttachmentRef[]);
    changes.push({
      key: "attachments",
      kind: "merge",
      changed: !isEqualAttachmentList(merged, draft.attachments),
    });
  }

  // questions (append_missing semantics)
  if (Array.isArray(fields.questions)) {
    const addedCount = mergeUniqueByText(draft.questions, fields.questions as Array<{ text: string }>, "text");
    changes.push({ key: "questions", kind: "append", changed: addedCount > 0 });
  }

  // requestedFields (append_missing semantics)
  if (Array.isArray(fields.requestedFields)) {
    const addedCount = mergeUniqueByText(draft.requestedFields, fields.requestedFields as Array<{ label: string }>, "label");
    changes.push({ key: "requestedFields", kind: "append", changed: addedCount > 0 });
  }

  // notes
  if (typeof fields.notes === "string") {
    changes.push({
      key: "notes",
      kind: "replace",
      changed: draft.notes.trim() !== fields.notes.trim(),
    });
  }

  return {
    hasEffectiveChanges: changes.some(c => c.changed),
    changes,
  };
}

// ── Preview metrics (실제 추가 수) ──

export function getRequestDraftPreviewMetrics(
  draft: SupplierRequestDraft,
  patch: SupplierDraftPatch
): RequestDraftPreviewMetrics {
  let addedAttachmentCount = 0;
  let addedQuestionCount = 0;
  let addedFieldCount = 0;

  if (Array.isArray(patch.fields.attachments)) {
    const existing = new Set(draft.attachments.map(a => a.id));
    addedAttachmentCount = (patch.fields.attachments as AttachmentRef[]).filter(a => !existing.has(a.id)).length;
  }

  if (Array.isArray(patch.fields.questions)) {
    addedQuestionCount = mergeUniqueByText(draft.questions, patch.fields.questions as Array<{ text: string }>, "text");
  }

  if (Array.isArray(patch.fields.requestedFields)) {
    addedFieldCount = mergeUniqueByText(draft.requestedFields, patch.fields.requestedFields as Array<{ label: string }>, "label");
  }

  return { addedAttachmentCount, addedQuestionCount, addedFieldCount };
}

// ── Effective preview items (diff 기준만) ──

export function buildEffectivePreviewItems(input: {
  draft: SupplierRequestDraft;
  patch: SupplierDraftPatch;
}): EffectivePreviewItem[] {
  const diff = diffRequestDraftPatch(input);
  const metrics = getRequestDraftPreviewMetrics(input.draft, input.patch);
  const items: EffectivePreviewItem[] = [];

  for (const change of diff.changes) {
    if (!change.changed) continue;

    switch (change.key) {
      case "messageBody":
        items.push({ key: "message", label: "요청 메시지 초안 보강" });
        break;
      case "leadTimeQuestionIncluded":
        items.push({ key: "lead_time", label: "납기 문의 포함" });
        break;
      case "substituteQuestionIncluded":
        items.push({ key: "substitute", label: "대체품 문의 포함" });
        break;
      case "attachments":
        if (metrics.addedAttachmentCount > 0) {
          items.push({ key: "attachments", label: `첨부 ${metrics.addedAttachmentCount}건 추가 예정` });
        }
        break;
      case "questions":
        if (metrics.addedQuestionCount > 0) {
          items.push({ key: "questions", label: `질문 ${metrics.addedQuestionCount}건 추가` });
        }
        break;
      case "requestedFields":
        if (metrics.addedFieldCount > 0) {
          items.push({ key: "fields", label: `요청 항목 ${metrics.addedFieldCount}건 추가` });
        }
        break;
      case "notes":
        items.push({ key: "notes", label: "비고 보강" });
        break;
    }
  }

  return items.slice(0, 4);
}

// ── No-op detection ──

export function isNoOpPatch(draft: SupplierRequestDraft, patch: SupplierDraftPatch): boolean {
  return !diffRequestDraftPatch({ draft, patch }).hasEffectiveChanges;
}
