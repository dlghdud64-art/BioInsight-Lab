/**
 * Request Draft Patch — field-group 단위 partial merge + user-owned field 보호
 *
 * 규칙:
 * - AI patch는 activeSupplierRequestId 기준 현재 supplier draft에만 적용
 * - draft 전체 replace 금지, field-group 단위 partial merge만
 * - user edited field는 AI가 overwrite 금지
 * - replace_ai_only는 마지막 source가 ai인 항목에만 적용
 * - attachments 실파일 리스트는 AI가 직접 변경 금지
 */

// ── Field provenance ─────────────────────────────────────────────────────────

export type DraftFieldSource = "user" | "ai" | "system";

export interface DraftFieldMeta {
  source: DraftFieldSource;
  updatedAt: string;
  edited: boolean; // true = user가 수정한 상태, AI overwrite 금지
}

export interface SupplierRequestDraftMeta {
  fieldMeta: {
    messageBody?: DraftFieldMeta;
    questions?: DraftFieldMeta;
    requestedFields?: DraftFieldMeta;
    notes?: DraftFieldMeta;
    attachmentsMeta?: DraftFieldMeta;
    followupFlags?: DraftFieldMeta;
  };
}

// ── Request question / field ─────────────────────────────────────────────────

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

export interface RequestAttachment {
  id: string;
  name: string;
  type: string;
  url?: string;
}

// ── Supplier request draft ───────────────────────────────────────────────────

export interface SupplierRequestDraft {
  supplierId: string;
  itemIds: string[];
  messageBody: string;
  attachments: RequestAttachment[];
  leadTimeQuestionIncluded: boolean;
  substituteQuestionIncluded: boolean;
  missingFields: string[];
  readiness: "draft" | "in_progress" | "ready" | "sent";
  questions?: RequestQuestion[];
  requestedFields?: RequestedField[];
  notes?: string;
  meta?: SupplierRequestDraftMeta;
}

// ── Patch types ──────────────────────────────────────────────────────────────

export type RequestDraftPatch =
  | { group: "messageBody"; supplierId: string; value: string }
  | { group: "questions"; supplierId: string; mode: "append_missing" | "toggle_on" | "replace_ai_only"; value: RequestQuestion[] }
  | { group: "requestedFields"; supplierId: string; mode: "append_missing" | "replace_ai_only"; value: RequestedField[] }
  | { group: "attachmentsMeta"; supplierId: string; value: { suggestedAttachmentTypes: Array<"spec_sheet" | "quote_target_list" | "internal_note"> } }
  | { group: "notes"; supplierId: string; value: string }
  | { group: "followupFlags"; supplierId: string; value: { leadTimeQuestionIncluded?: boolean; substituteQuestionIncluded?: boolean } };

// ── Merge logic ──────────────────────────────────────────────────────────────

function isUserEdited(draft: SupplierRequestDraft, fieldName: string): boolean {
  const meta = draft.meta?.fieldMeta?.[fieldName as keyof SupplierRequestDraftMeta["fieldMeta"]];
  return meta?.source === "user" && meta?.edited === true;
}

function setFieldMeta(draft: SupplierRequestDraft, fieldName: string, source: DraftFieldSource): SupplierRequestDraft {
  const now = new Date().toISOString();
  const currentMeta = draft.meta || { fieldMeta: {} };
  return {
    ...draft,
    meta: {
      ...currentMeta,
      fieldMeta: {
        ...currentMeta.fieldMeta,
        [fieldName]: { source, updatedAt: now, edited: source === "user" },
      },
    },
  };
}

export interface MergeResult {
  draft: SupplierRequestDraft;
  mergedFields: string[];
  blockedFields: string[];
}

/**
 * mergeRequestDraftPatch — field-group 단위 partial merge
 *
 * merge 우선순위:
 * 1. active supplier draft 확인
 * 2. supplierId 일치 확인
 * 3. field-group별 merge strategy 적용
 * 4. user-edited field 보호
 * 5. derived state 재계산 (missingFields, readiness)
 */
export function mergeRequestDraftPatch(
  draft: SupplierRequestDraft,
  patch: RequestDraftPatch
): MergeResult {
  // supplierId 불일치면 skip
  if (draft.supplierId !== patch.supplierId) {
    return { draft, mergedFields: [], blockedFields: [patch.group] };
  }

  const mergedFields: string[] = [];
  const blockedFields: string[] = [];
  let result = { ...draft };

  switch (patch.group) {
    case "messageBody": {
      if (isUserEdited(draft, "messageBody")) {
        blockedFields.push("messageBody");
      } else {
        result.messageBody = patch.value;
        result = setFieldMeta(result, "messageBody", "ai");
        mergedFields.push("messageBody");
      }
      break;
    }

    case "questions": {
      if (patch.mode === "append_missing") {
        // 기존 user 입력 유지, 누락분만 추가
        const existing = result.questions || [];
        const existingTexts = new Set(existing.map(q => q.text.toLowerCase()));
        const newOnes = patch.value.filter(q => !existingTexts.has(q.text.toLowerCase()));
        if (newOnes.length > 0) {
          result.questions = [...existing, ...newOnes.map(q => ({ ...q, source: "ai" as const }))];
          result = setFieldMeta(result, "questions", "ai");
          mergedFields.push("questions");
        }
      } else if (patch.mode === "toggle_on") {
        // false → true만 허용, true → false는 AI가 하지 않음
        const existing = result.questions || [];
        result.questions = existing.map(q => {
          const match = patch.value.find(pq => pq.id === q.id);
          if (match && !q.checked) return { ...q, checked: true };
          return q;
        });
        mergedFields.push("questions");
      } else if (patch.mode === "replace_ai_only") {
        // 마지막 source가 ai인 항목만 교체
        if (isUserEdited(draft, "questions")) {
          blockedFields.push("questions");
        } else {
          const existing = result.questions || [];
          const userOwned = existing.filter(q => q.source === "user");
          result.questions = [...userOwned, ...patch.value.map(q => ({ ...q, source: "ai" as const }))];
          result = setFieldMeta(result, "questions", "ai");
          mergedFields.push("questions");
        }
      }
      break;
    }

    case "requestedFields": {
      if (patch.mode === "append_missing") {
        const existing = result.requestedFields || [];
        const existingLabels = new Set(existing.map(f => f.label.toLowerCase()));
        const newOnes = patch.value.filter(f => !existingLabels.has(f.label.toLowerCase()));
        if (newOnes.length > 0) {
          result.requestedFields = [...existing, ...newOnes.map(f => ({ ...f, source: "ai" as const }))];
          result = setFieldMeta(result, "requestedFields", "ai");
          mergedFields.push("requestedFields");
        }
      } else if (patch.mode === "replace_ai_only") {
        if (isUserEdited(draft, "requestedFields")) {
          blockedFields.push("requestedFields");
        } else {
          const existing = result.requestedFields || [];
          const userOwned = existing.filter(f => f.source === "user");
          result.requestedFields = [...userOwned, ...patch.value.map(f => ({ ...f, source: "ai" as const }))];
          result = setFieldMeta(result, "requestedFields", "ai");
          mergedFields.push("requestedFields");
        }
      }
      break;
    }

    case "attachmentsMeta": {
      // attachments 실파일 리스트는 AI가 직접 변경 금지
      // suggestion metadata만 저장 (실제 파일 첨부는 user action)
      result = setFieldMeta(result, "attachmentsMeta", "ai");
      mergedFields.push("attachmentsMeta");
      break;
    }

    case "notes": {
      if (isUserEdited(draft, "notes")) {
        blockedFields.push("notes");
      } else {
        result.notes = patch.value;
        result = setFieldMeta(result, "notes", "ai");
        mergedFields.push("notes");
      }
      break;
    }

    case "followupFlags": {
      // false → true 제안만 허용, true → false는 AI가 하지 않음
      if (patch.value.leadTimeQuestionIncluded === true && !result.leadTimeQuestionIncluded) {
        result.leadTimeQuestionIncluded = true;
        mergedFields.push("leadTimeQuestionIncluded");
      }
      if (patch.value.substituteQuestionIncluded === true && !result.substituteQuestionIncluded) {
        result.substituteQuestionIncluded = true;
        mergedFields.push("substituteQuestionIncluded");
      }
      if (mergedFields.length > 0) {
        result = setFieldMeta(result, "followupFlags", "ai");
      }
      break;
    }
  }

  // derived state 재계산
  result.missingFields = calculateMissingFields(result);
  result.readiness = calculateDraftReadiness(result);

  return { draft: result, mergedFields, blockedFields };
}

// ── Derived state calculators ────────────────────────────────────────────────

export function calculateMissingFields(draft: SupplierRequestDraft): string[] {
  const missing: string[] = [];
  if (!draft.messageBody || draft.messageBody.length < 10) missing.push("message_missing");
  if (!draft.leadTimeQuestionIncluded) missing.push("leadtime_question_missing");
  if (!draft.substituteQuestionIncluded) missing.push("substitute_question_missing");
  if (draft.attachments.length === 0) missing.push("attachment_missing");
  return missing;
}

export function calculateDraftReadiness(draft: SupplierRequestDraft): SupplierRequestDraft["readiness"] {
  if (draft.readiness === "sent") return "sent"; // 이미 전송됨 — AI가 변경 금지
  const missing = calculateMissingFields(draft);
  if (missing.length === 0 && draft.messageBody.length >= 20) return "ready";
  if (draft.messageBody.length > 0 || (draft.questions && draft.questions.length > 0)) return "in_progress";
  return "draft";
}

export function calculateAssemblyReadiness(
  draftMap: Record<string, SupplierRequestDraft>
): { totalSuppliers: number; readyCount: number; missingCount: number; totalMissingFields: number; canSendAll: boolean } {
  const drafts = Object.values(draftMap);
  const totalSuppliers = drafts.length;
  const readyCount = drafts.filter(d => d.readiness === "ready" || d.readiness === "sent").length;
  const missingCount = drafts.filter(d => d.readiness !== "ready" && d.readiness !== "sent").length;
  const totalMissingFields = drafts.reduce((sum, d) => sum + d.missingFields.length, 0);
  const canSendAll = totalSuppliers > 0 && readyCount === totalSuppliers;
  return { totalSuppliers, readyCount, missingCount, totalMissingFields, canSendAll };
}

// ── User edit helpers ────────────────────────────────────────────────────────

export function markFieldAsUserEdited(
  draft: SupplierRequestDraft,
  fieldName: keyof SupplierRequestDraftMeta["fieldMeta"]
): SupplierRequestDraft {
  return setFieldMeta(draft, fieldName, "user");
}
