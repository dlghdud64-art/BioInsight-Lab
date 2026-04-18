/**
 * Request Draft Resolution + Generation Baseline — 정합성 고정
 *
 * 역할 분리:
 *   resolutionLog = lifecycle event 기록 (무슨 decision이 있었는가)
 *   generationBaseline = regeneration 억제 기준점 (어느 context 이후 다시 생성 억제)
 *   둘은 separate but aligned — 같은 lifecycle 사건에 대해 같은 context를 가리켜야 함.
 *
 * 고정 규칙:
 * 1. accepted/edited/noop 처리마다 resolutionLog + baseline 함께 기록.
 * 2. baseline snapshot은 항상 처리 시점의 current canonical draft 기준.
 * 3. old suggestion.sourceContext 재사용 금지 — current draft 기준으로 새로 계산.
 * 4. 이벤트 순서: patch → draft recompute → resolutionLog → baseline upsert → active clear → eligibility recompute.
 * 5. baseline upsert는 idempotent — 동일 snapshot/source면 churn 없음.
 */

import type { SupplierRequestDraft } from "./request-draft-patch";
import { buildRequestDraftContextHash, buildRequestDraftFingerprint, type RequestDraftContextInput } from "./context-hash";

// ── Source enum ──

export type RequestDraftGenerationBaselineSource =
  | "generated"
  | "accepted"
  | "dismissed"
  | "edited"
  | "noop";

export type RequestDraftResolutionStatus =
  | "accepted"
  | "dismissed"
  | "edited"
  | "noop";

// ── Baseline model (supplier당 최신 1개) ──

export interface RequestDraftBaselineComparable {
  messageBody: string;
  leadTimeQuestionIncluded: boolean;
  substituteQuestionIncluded: boolean;
  attachmentIds: string[];
  itemIds: string[];
}

export interface RequestDraftGenerationBaseline {
  requestAssemblyId: string;
  supplierId: string;
  contextHash: string;
  draftFingerprint: string;
  recordedAt: string;
  source: RequestDraftGenerationBaselineSource;
  comparable: RequestDraftBaselineComparable;
}

// ── Resolution → Baseline source mapping ──

export function mapResolutionStatusToBaselineSource(
  status: RequestDraftResolutionStatus
): RequestDraftGenerationBaselineSource {
  // 1:1 mapping — ad-hoc string 하드코딩 금지
  const map: Record<RequestDraftResolutionStatus, RequestDraftGenerationBaselineSource> = {
    accepted: "accepted",
    dismissed: "dismissed",
    edited: "edited",
    noop: "noop",
  };
  return map[status];
}

// ── Current canonical baseline snapshot ──

export interface RequestDraftBaselineSnapshotInput {
  requestAssemblyId: string;
  supplierId: string;
  draft: SupplierRequestDraft;
  source: RequestDraftGenerationBaselineSource;
  now: string;
}

export function buildRequestDraftGenerationBaselineSnapshot(
  input: RequestDraftBaselineSnapshotInput
): RequestDraftGenerationBaseline {
  const { requestAssemblyId, supplierId, draft, source, now } = input;

  const contextInput: RequestDraftContextInput = {
    requestAssemblyId,
    supplierId,
    itemIds: draft.itemIds,
    messageBody: draft.messageBody,
    attachmentIds: draft.attachments.map(a => a.id),
    leadTimeQuestionIncluded: draft.leadTimeQuestionIncluded,
    substituteQuestionIncluded: draft.substituteQuestionIncluded,
    editState: draft.editState,
    mergeState: draft.mergeState,
  };

  return {
    requestAssemblyId,
    supplierId,
    contextHash: buildRequestDraftContextHash(contextInput),
    draftFingerprint: buildRequestDraftFingerprint(contextInput),
    recordedAt: now,
    source,
    comparable: {
      messageBody: draft.messageBody,
      leadTimeQuestionIncluded: draft.leadTimeQuestionIncluded,
      substituteQuestionIncluded: draft.substituteQuestionIncluded,
      attachmentIds: draft.attachments.map(a => a.id),
      itemIds: [...draft.itemIds],
    },
  };
}

// ── Idempotent baseline upsert ──

export function shouldReplaceBaseline(
  existing: RequestDraftGenerationBaseline | null | undefined,
  next: RequestDraftGenerationBaseline
): boolean {
  if (!existing) return true;

  // 동일 snapshot + 동일 source → no-op (churn 방지)
  if (
    existing.contextHash === next.contextHash &&
    existing.draftFingerprint === next.draftFingerprint &&
    existing.source === next.source
  ) {
    return false;
  }

  // source가 달라지면 갱신 (accepted → edited 등)
  // context가 달라지면 갱신 (draft 변경)
  return true;
}

// ── Unified resolution + baseline recording ──

export interface ResolutionWithBaselineInput {
  requestAssemblyId: string;
  supplierId: string;
  suggestionId: string | null;
  status: RequestDraftResolutionStatus;
  draft: SupplierRequestDraft;
  now: string;
}

export interface ResolutionRecord {
  suggestionId: string;
  scope: "request_draft";
  requestAssemblyId: string;
  supplierId: string;
  contextHash: string;
  status: RequestDraftResolutionStatus;
  resolvedAt: string;
}

export interface ResolutionWithBaselineResult {
  resolution: ResolutionRecord;
  baseline: RequestDraftGenerationBaseline;
  baselineChanged: boolean;
}

/**
 * recordResolutionAndBaseline — lifecycle event 처리 시 resolution + baseline을 함께 생성.
 * 호출자는 이 결과를 resolutionLog.push + baseline upsert에 사용.
 *
 * 순서:
 * 1. current canonical draft 기준 snapshot 계산
 * 2. resolution 기록 생성
 * 3. baseline snapshot 생성
 * 4. baseline 교체 여부 판단
 */
export function recordResolutionAndBaseline(
  input: ResolutionWithBaselineInput,
  existingBaseline: RequestDraftGenerationBaseline | null | undefined
): ResolutionWithBaselineResult {
  const { requestAssemblyId, supplierId, suggestionId, status, draft, now } = input;

  const baselineSource = mapResolutionStatusToBaselineSource(status);

  // Current canonical draft 기준 snapshot
  const baseline = buildRequestDraftGenerationBaselineSnapshot({
    requestAssemblyId,
    supplierId,
    draft,
    source: baselineSource,
    now,
  });

  // Resolution record — contextHash도 current canonical 기준
  const resolution: ResolutionRecord = {
    suggestionId: suggestionId ?? `resolved-${status}-${now}`,
    scope: "request_draft",
    requestAssemblyId,
    supplierId,
    contextHash: baseline.contextHash, // baseline과 같은 context를 가리킴
    status,
    resolvedAt: now,
  };

  const baselineChanged = shouldReplaceBaseline(existingBaseline, baseline);

  return {
    resolution,
    baseline,
    baselineChanged,
  };
}
