/**
 * Request Draft Status Echo — supplier-local 최소 상태 신호
 *
 * 고정 규칙:
 * 1. 우선순위: conflict > edited > accepted > none
 * 2. primary chip은 한 시점에 1개만
 * 3. accepted echo는 약하고 비지속적 (edited/conflict 발생 시 즉시 제거)
 * 4. supplier-local header 한 곳에서만 노출
 * 5. assembly summary (right rail)와 문구/강도/역할 충돌 금지
 * 6. canonical state (editState, mergeState, resolutionLog)에서만 계산
 */

import type { SupplierRequestDraft } from "./request-draft-patch";
import type { RequestSuggestionState } from "./request-suggestion-store";

// ── Types ──

export type RequestDraftEchoKind = "none" | "accepted" | "edited" | "conflicted";

export type RequestDraftEchoTone = "neutral" | "muted" | "warning";

export interface RequestDraftStatusEcho {
  kind: RequestDraftEchoKind;
  label: string | null;
  tone: RequestDraftEchoTone;
  persistent: boolean;
}

const ECHO_NONE: RequestDraftStatusEcho = {
  kind: "none",
  label: null,
  tone: "muted",
  persistent: false,
};

// ── Accepted echo check ──

export interface AcceptedEchoInput {
  requestAssemblyId: string;
  supplierId: string;
  resolutionLog: RequestSuggestionState["resolvedHistory"];
  draft: SupplierRequestDraft;
}

export function hasRecentAcceptedEcho(input: AcceptedEchoInput): boolean {
  const { requestAssemblyId, supplierId, resolutionLog, draft } = input;

  // edited/conflicted/sent 상태면 accepted echo 불가
  if (draft.editState === "edited") return false;
  if (draft.mergeState === "conflicted") return false;
  if (draft.readiness === "sent") return false;

  // resolution log에서 가장 최근 해당 supplier의 resolution 조회
  const relevant = resolutionLog
    .filter(
      (entry: any) =>
        entry.requestAssemblyId === requestAssemblyId &&
        entry.supplierId === supplierId
    )
    .sort((a, b) => (a.resolvedAt < b.resolvedAt ? 1 : -1));

  const latest = relevant[0];
  if (!latest) return false;

  // 가장 최근이 accepted일 때만 echo 허용
  // edited나 dismissed가 최근이면 accepted echo 불가
  return latest.status === "accepted";
}

// ── Main selector ──

export function selectActiveRequestDraftStatusEcho(input: {
  draft: SupplierRequestDraft | null;
  requestAssemblyId: string | null;
  supplierId: string | null;
  resolutionLog: RequestSuggestionState["resolvedHistory"];
}): RequestDraftStatusEcho {
  const { draft, requestAssemblyId, supplierId, resolutionLog } = input;

  if (!draft || !requestAssemblyId || !supplierId) return ECHO_NONE;

  // sent → no echo
  if (draft.readiness === "sent") return ECHO_NONE;

  // Priority 1: conflict
  if (draft.mergeState === "conflicted") {
    return {
      kind: "conflicted",
      label: "충돌 검토 필요",
      tone: "warning",
      persistent: true,
    };
  }

  // Priority 2: edited
  if (draft.editState === "edited") {
    return {
      kind: "edited",
      label: "운영자가 수정함",
      tone: "neutral",
      persistent: true,
    };
  }

  // Priority 3: accepted (약하고 비지속적)
  const acceptedEcho = hasRecentAcceptedEcho({
    requestAssemblyId,
    supplierId,
    resolutionLog,
    draft,
  });

  if (acceptedEcho) {
    return {
      kind: "accepted",
      label: "AI 초안 반영됨",
      tone: "muted",
      persistent: false,
    };
  }

  // Priority 4: none
  return ECHO_NONE;
}

// ── Accepted echo TTL helper (until-next-meaningful-action 방식) ──

export function shouldDismissAcceptedEcho(input: {
  echo: RequestDraftStatusEcho;
  supplierChanged: boolean;
  fieldEdited: boolean;
  conflictOccurred: boolean;
  newSuggestionGenerated: boolean;
}): boolean {
  if (input.echo.kind !== "accepted") return false;

  // until-next-meaningful-action: 아래 중 하나 발생 시 제거
  return (
    input.supplierChanged ||
    input.fieldEdited ||
    input.conflictOccurred ||
    input.newSuggestionGenerated
  );
}
