/**
 * Request Draft Patch — field-level provenance + partial merge + user edit 보호
 *
 * ── 최상단 고정 규칙 ──
 * 1. edited=true인 필드는 AI patch가 자동 overwrite 금지. 사용자 명시 승인 시에만 교체.
 * 2. itemIds의 canonical source는 request assembly selection. AI가 itemIds를 자동 변경 불가.
 * 3. stale patch (동일 patchId 재적용 / contextHash 불일치 / user edit 이후) apply 금지.
 * 4. draft-level edited는 source of truth 아님 — fieldMeta 기반 파생값으로만 계산.
 * 5. readiness / right rail / bottom dock는 active supplier 아닌 assembly 전체 기준.
 * 6. supplier draft 전체 replace 금지. field 단위 partial merge만 허용.
 * 7. sent 상태 draft는 immutable. content overwrite / 상태 회귀 금지.
 */

// ── Field provenance ─────────────────────────────────────────────────────────

export type DraftFieldSource = "user_edit" | "ai_patch" | "seed" | "system" | "merge";

export interface DraftFieldMeta {
  source: DraftFieldSource;
  updatedAt: string;
  patchId?: string;
  contextHash?: string;
  dirty: boolean;   // 현재 값이 초기값과 다른지
  edited: boolean;  // user가 직접 수정했는지
}

export type DraftFieldKey =
  | "messageBody"
  | "questions"
  | "requestedFields"
  | "notes"
  | "attachments"
  | "leadTimeQuestionIncluded"
  | "substituteQuestionIncluded";

export type FieldMetaMap = Partial<Record<DraftFieldKey, DraftFieldMeta>>;

// ── Request question / field / attachment ────────────────────────────────────

export interface RequestQuestion {
  id: string;
  text: string;
  checked: boolean;
  source?: DraftFieldSource;
}

export interface RequestedField {
  id: string;
  label: string;
  value: string;
  source?: DraftFieldSource;
}

export interface AttachmentRef {
  id: string;
  name: string;
  type: string;
  url?: string;
}

// ── Edit / merge / origin states ─────────────────────────────────────────────

export type EditState = "pristine" | "edited";
export type MergeState = "clean" | "partial" | "conflicted";
export type DraftOrigin = "manual" | "ai_seeded" | "mixed";

// ── Last patch result ────────────────────────────────────────────────────────

export interface LastPatchResult {
  patchId: string;
  contextHash: string;
  appliedFields: DraftFieldKey[];
  skippedFields: DraftFieldKey[];
  conflictedFields: DraftFieldKey[];
  mergedFields: DraftFieldKey[];
  appliedAt: string;
}

// ── Supplier request draft ───────────────────────────────────────────────────

export interface SupplierRequestDraft {
  supplierId: string;
  vendorName: string;
  itemIds: string[];        // canonical source: assembly selection. AI 변경 금지.
  messageBody: string;
  attachments: AttachmentRef[];
  leadTimeQuestionIncluded: boolean;
  substituteQuestionIncluded: boolean;
  questions: RequestQuestion[];
  requestedFields: RequestedField[];
  notes: string;
  missingFields: string[];
  readiness: "draft" | "in_progress" | "ready" | "sent";
  // provenance / state
  fieldMeta: FieldMetaMap;
  editState: EditState;
  mergeState: MergeState;
  origin: DraftOrigin;
  lastPatchResult: LastPatchResult | null;
}

// ── Patch type ───────────────────────────────────────────────────────────────

export interface SupplierDraftPatch {
  patchId: string;
  supplierId: string;
  contextHash: string;
  source: "ai_patch" | "system";
  fields: Partial<{
    messageBody: string;
    attachments: AttachmentRef[];
    leadTimeQuestionIncluded: boolean;
    substituteQuestionIncluded: boolean;
    questions: RequestQuestion[];
    requestedFields: RequestedField[];
    notes: string;
    // itemIds는 의도적으로 제외 — AI 변경 금지
  }>;
  generatedAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function hasUserEditedField(fieldMeta: FieldMetaMap): boolean {
  return Object.values(fieldMeta).some(m => m?.source === "user_edit" && m?.edited);
}

function hasAiPatchedField(fieldMeta: FieldMetaMap): boolean {
  return Object.values(fieldMeta).some(m => m?.source === "ai_patch");
}

function mergeUniqueById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const existingIds = new Set(current.map(x => x.id));
  const newItems = incoming.filter(x => !existingIds.has(x.id));
  return [...current, ...newItems];
}

// ── User edit action (field-level) ──────────────────────────────────────────

export function updateSupplierDraftField(
  draft: SupplierRequestDraft,
  field: DraftFieldKey,
  value: unknown
): SupplierRequestDraft {
  const now = new Date().toISOString();
  const next = { ...draft };

  // 실제 필드 업데이트
  switch (field) {
    case "messageBody": next.messageBody = value as string; break;
    case "notes": next.notes = value as string; break;
    case "leadTimeQuestionIncluded": next.leadTimeQuestionIncluded = value as boolean; break;
    case "substituteQuestionIncluded": next.substituteQuestionIncluded = value as boolean; break;
    case "questions": next.questions = value as RequestQuestion[]; break;
    case "requestedFields": next.requestedFields = value as RequestedField[]; break;
    case "attachments": next.attachments = value as AttachmentRef[]; break;
    default: break;
  }

  // provenance 기록
  next.fieldMeta = {
    ...next.fieldMeta,
    [field]: { source: "user_edit" as const, dirty: true, edited: true, updatedAt: now },
  };

  // 파생 상태 재계산
  next.editState = "edited";
  next.origin = hasAiPatchedField(next.fieldMeta) ? "mixed" : next.origin === "ai_seeded" ? "mixed" : next.origin;
  next.missingFields = recalcMissingFields(next);
  next.readiness = recalcReadiness(next);

  return next;
}

// ── Apply supplier draft patch (core merge) ─────────────────────────────────

export interface ApplyPatchResult {
  draft: SupplierRequestDraft;
  appliedFields: DraftFieldKey[];
  skippedFields: DraftFieldKey[];
  conflictedFields: DraftFieldKey[];
  mergedFields: DraftFieldKey[];
  wasNoOp: boolean;
}

export function applySupplierDraftPatch(
  current: SupplierRequestDraft,
  patch: SupplierDraftPatch
): ApplyPatchResult {
  const noOp: ApplyPatchResult = {
    draft: current,
    appliedFields: [],
    skippedFields: [],
    conflictedFields: [],
    mergedFields: [],
    wasNoOp: true,
  };

  // Rule 6: sent draft는 immutable
  if (current.readiness === "sent") return noOp;

  // Rule: 동일 patchId 재적용 방지
  if (current.lastPatchResult?.patchId === patch.patchId) return noOp;

  // Rule: stale contextHash + user edit 이후면 재적용 금지
  if (
    current.lastPatchResult?.contextHash === patch.contextHash &&
    current.editState === "edited"
  ) {
    return noOp;
  }

  // supplierId 불일치
  if (current.supplierId !== patch.supplierId) return noOp;

  const next = { ...current };
  const appliedFields: DraftFieldKey[] = [];
  const skippedFields: DraftFieldKey[] = [];
  const conflictedFields: DraftFieldKey[] = [];
  const mergedFields: DraftFieldKey[] = [];

  for (const [field, incomingValue] of Object.entries(patch.fields)) {
    if (incomingValue === undefined) continue;
    const key = field as DraftFieldKey;
    const meta = next.fieldMeta?.[key];
    const wasUserEdited = meta?.source === "user_edit" || meta?.dirty === true || meta?.edited === true;

    // ── attachments: merge 우선 (replace 금지) ──
    if (key === "attachments") {
      const merged = mergeUniqueById(next.attachments, incomingValue as AttachmentRef[]);
      if (merged.length !== next.attachments.length) {
        next.attachments = merged;
        mergedFields.push("attachments");
        next.fieldMeta = {
          ...next.fieldMeta,
          attachments: { source: "merge", updatedAt: patch.generatedAt, patchId: patch.patchId, contextHash: patch.contextHash, dirty: false, edited: false },
        };
      } else {
        skippedFields.push("attachments");
      }
      continue;
    }

    // ── messageBody: 가장 보수적 ──
    if (key === "messageBody" && wasUserEdited) {
      conflictedFields.push("messageBody");
      continue;
    }

    // ── 기타: user edit 이면 skip ──
    if (wasUserEdited) {
      skippedFields.push(key);
      continue;
    }

    // ── 미편집 필드: 적용 ──
    switch (key) {
      case "messageBody": next.messageBody = incomingValue as string; break;
      case "notes": next.notes = incomingValue as string; break;
      case "leadTimeQuestionIncluded": next.leadTimeQuestionIncluded = incomingValue as boolean; break;
      case "substituteQuestionIncluded": next.substituteQuestionIncluded = incomingValue as boolean; break;
      case "questions": {
        // append_missing by default for AI
        const existing = next.questions;
        const existingTexts = new Set(existing.map(q => q.text.toLowerCase()));
        const newOnes = (incomingValue as RequestQuestion[]).filter(q => !existingTexts.has(q.text.toLowerCase()));
        if (newOnes.length > 0) {
          next.questions = [...existing, ...newOnes.map(q => ({ ...q, source: "ai_patch" as const }))];
          mergedFields.push("questions");
        } else {
          skippedFields.push("questions");
        }
        continue; // fieldMeta handled separately for merge
      }
      case "requestedFields": {
        const existing = next.requestedFields;
        const existingLabels = new Set(existing.map(f => f.label.toLowerCase()));
        const newOnes = (incomingValue as RequestedField[]).filter(f => !existingLabels.has(f.label.toLowerCase()));
        if (newOnes.length > 0) {
          next.requestedFields = [...existing, ...newOnes.map(f => ({ ...f, source: "ai_patch" as const }))];
          mergedFields.push("requestedFields");
        } else {
          skippedFields.push("requestedFields");
        }
        continue;
      }
      default: continue;
    }

    appliedFields.push(key);
    next.fieldMeta = {
      ...next.fieldMeta,
      [key]: {
        source: "ai_patch" as const,
        updatedAt: patch.generatedAt,
        patchId: patch.patchId,
        contextHash: patch.contextHash,
        dirty: false,
        edited: false,
      },
    };
  }

  // ── 파생 상태 재계산 ──
  next.missingFields = recalcMissingFields(next);
  next.readiness = recalcReadiness(next);

  next.mergeState =
    conflictedFields.length > 0 ? "conflicted"
    : (skippedFields.length > 0 || mergedFields.length > 0) ? "partial"
    : "clean";

  next.editState = hasUserEditedField(next.fieldMeta) ? "edited" : "pristine";

  next.origin = hasAiPatchedField(next.fieldMeta)
    ? hasUserEditedField(next.fieldMeta) ? "mixed" : "ai_seeded"
    : "manual";

  next.lastPatchResult = {
    patchId: patch.patchId,
    contextHash: patch.contextHash,
    appliedFields,
    skippedFields,
    conflictedFields,
    mergedFields,
    appliedAt: new Date().toISOString(),
  };

  return {
    draft: next,
    appliedFields,
    skippedFields,
    conflictedFields,
    mergedFields,
    wasNoOp: appliedFields.length === 0 && mergedFields.length === 0,
  };
}

// ── Missing fields (canonical 재계산) ───────────────────────────────────────

export function recalcMissingFields(draft: SupplierRequestDraft): string[] {
  const missing: string[] = [];
  if (!draft.supplierId) missing.push("supplier_missing");
  if (draft.itemIds.length === 0) missing.push("items_missing");
  if (!draft.messageBody || draft.messageBody.trim().length === 0) missing.push("message_missing");
  // 비필수: attachments, leadTime, substitute — missingFields에 포함하지 않음
  return missing;
}

// ── Readiness (canonical 재계산) ─────────────────────────────────────────────

export function recalcReadiness(draft: SupplierRequestDraft): SupplierRequestDraft["readiness"] {
  if (draft.readiness === "sent") return "sent"; // immutable
  const missing = recalcMissingFields(draft);
  if (missing.length === 0 && draft.messageBody.trim().length > 0) return "ready";
  if (draft.messageBody.length > 0 || draft.questions.length > 0 || draft.leadTimeQuestionIncluded || draft.substituteQuestionIncluded) return "in_progress";
  return "draft";
}

// ── Assembly-level readiness (active supplier 의존 없음) ─────────────────────

export interface AssemblySummary {
  totalSuppliers: number;
  readyCount: number;
  inProgressCount: number;
  draftCount: number;
  sentCount: number;
  missingFieldCount: number;
  conflictedDraftCount: number;
  partialDraftCount: number;
  estimatedTotal: number | null;
  canSubmitAssembly: boolean;
}

export type AssemblyStatus = "drafting" | "partial_ready" | "ready_to_send" | "sent";

export function selectAssemblySummary(
  draftMap: Record<string, SupplierRequestDraft>
): AssemblySummary {
  const drafts = Object.values(draftMap);
  let readyCount = 0, inProgressCount = 0, draftCount = 0, sentCount = 0;
  let missingFieldCount = 0, conflictedDraftCount = 0, partialDraftCount = 0;

  for (const d of drafts) {
    const r = recalcReadiness(d);
    if (r === "ready") readyCount++;
    else if (r === "in_progress") inProgressCount++;
    else if (r === "sent") sentCount++;
    else draftCount++;
    missingFieldCount += recalcMissingFields(d).length;
    if (d.mergeState === "conflicted") conflictedDraftCount++;
    if (d.mergeState === "partial") partialDraftCount++;
  }

  const canSubmitAssembly =
    drafts.length > 0 &&
    (readyCount + sentCount) === drafts.length &&
    conflictedDraftCount === 0;

  return {
    totalSuppliers: drafts.length,
    readyCount,
    inProgressCount,
    draftCount,
    sentCount,
    missingFieldCount,
    conflictedDraftCount,
    partialDraftCount,
    estimatedTotal: null,
    canSubmitAssembly,
  };
}

export function selectAssemblyStatus(
  draftMap: Record<string, SupplierRequestDraft>
): AssemblyStatus {
  const summary = selectAssemblySummary(draftMap);
  if (summary.sentCount === summary.totalSuppliers && summary.totalSuppliers > 0) return "sent";
  if (summary.canSubmitAssembly) return "ready_to_send";
  if (summary.readyCount > 0 || summary.inProgressCount > 0) return "partial_ready";
  return "drafting";
}

// ── Stale patch check ────────────────────────────────────────────────────────

export function isPatchStale(
  patch: SupplierDraftPatch,
  draft: SupplierRequestDraft,
  currentContextHash: string
): boolean {
  if (patch.contextHash !== currentContextHash) return true;
  if (patch.supplierId !== draft.supplierId) return true;
  if (draft.lastPatchResult?.patchId === patch.patchId) return true; // 이미 적용됨
  return false;
}

// ── Draft-level edited (selector용 파생값, source of truth 아님) ─────────────

export function isDraftEdited(draft: SupplierRequestDraft): boolean {
  return hasUserEditedField(draft.fieldMeta);
}

// ── Create empty draft ──────────────────────────────────────────────────────

export function createEmptyDraft(supplierId: string, vendorName: string, itemIds: string[]): SupplierRequestDraft {
  return {
    supplierId,
    vendorName,
    itemIds,
    messageBody: "",
    attachments: [],
    leadTimeQuestionIncluded: false,
    substituteQuestionIncluded: false,
    questions: [],
    requestedFields: [],
    notes: "",
    missingFields: ["message_missing"],
    readiness: "draft",
    fieldMeta: {},
    editState: "pristine",
    mergeState: "clean",
    origin: "manual",
    lastPatchResult: null,
  };
}
