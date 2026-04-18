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

// ── Preview copy token system ──
//
// 어휘 영역 분리:
//   preview  → 보강 / 포함 / 추가 예정 / 조정
//   echo     → 반영됨 / 수정함 / 검토 필요
//   summary  → 준비 완료 / 미완성 / 충돌 있음 / 전송 가능
//
// 금지 어휘: 완성 / 최적화 / 자동 생성 완료 / 즉시 전송 / 대신 결정

export type RequestDraftChangeKind = "replace" | "toggle" | "merge" | "append";

export interface RequestDraftPreviewCopyToken {
  key: RequestDraftEffectiveChangeKey;
  kind: RequestDraftChangeKind;
  label: string;
}

export interface BuildPreviewCopyInput {
  change: RequestDraftEffectiveChange;
  metrics?: RequestDraftPreviewMetrics;
}

/**
 * change kind별 고정 문구 mapping.
 * - replace(message) → 초안 보강
 * - toggle(question flag) → 문의 포함
 * - merge(attachments) → n건 추가 예정
 * - append(questions/fields/notes) → n건 추가 / 보강
 */
export function buildRequestDraftPreviewCopy(
  input: BuildPreviewCopyInput
): RequestDraftPreviewCopyToken | null {
  const { change, metrics } = input;
  if (!change.changed) return null;

  switch (change.key) {
    // ── replace: 초안/문안 보강 ──
    case "messageBody":
      return { key: "messageBody", kind: "replace", label: "요청 메시지 초안 보강" };

    case "notes":
      return { key: "notes", kind: "replace", label: "비고 보강" };

    // ── toggle: 문의 포함 ──
    case "leadTimeQuestionIncluded":
      return { key: "leadTimeQuestionIncluded", kind: "toggle", label: "납기 문의 포함" };

    case "substituteQuestionIncluded":
      return { key: "substituteQuestionIncluded", kind: "toggle", label: "대체품 문의 포함" };

    // ── merge: n건 추가 예정 ──
    case "attachments": {
      const count = metrics?.addedAttachmentCount ?? 0;
      if (count <= 0) return null; // dedupe 후 0건이면 생성 금지
      return { key: "attachments", kind: "merge", label: `첨부 ${count}건 추가 예정` };
    }

    // ── append: n건 추가 ──
    case "questions": {
      const count = metrics?.addedQuestionCount ?? 0;
      if (count <= 0) return null;
      return { key: "questions", kind: "append", label: `확인 질문 ${count}건 추가` };
    }

    case "requestedFields": {
      const count = metrics?.addedFieldCount ?? 0;
      if (count <= 0) return null;
      return { key: "requestedFields", kind: "append", label: `요청 항목 ${count}건 추가` };
    }

    default:
      return null;
  }
}

// ── Effective preview items (token 기반) ──

export function buildEffectivePreviewItems(input: {
  draft: SupplierRequestDraft;
  patch: SupplierDraftPatch;
}): EffectivePreviewItem[] {
  const diff = diffRequestDraftPatch(input);
  const metrics = getRequestDraftPreviewMetrics(input.draft, input.patch);

  const items: EffectivePreviewItem[] = [];
  for (const change of diff.changes) {
    const token = buildRequestDraftPreviewCopy({ change, metrics });
    if (!token) continue;
    items.push({ key: token.key as EffectivePreviewItem["key"], label: token.label });
  }
  return items.slice(0, 4);
}

// ── No-op detection ──

export function isNoOpPatch(draft: SupplierRequestDraft, patch: SupplierDraftPatch): boolean {
  return !diffRequestDraftPatch({ draft, patch }).hasEffectiveChanges;
}
