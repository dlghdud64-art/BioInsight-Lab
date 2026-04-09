"use client";

/**
 * POCreatedReentrySurface — PO Created 진입 허브
 *
 * CLAUDE.md 규칙:
 * - terminal success card 금지 → 다음 작업 진입 허브
 * - 가장 먼저 next required action + dispatch readiness 표시
 * - center = judgment, rail = reference, dock = execution
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { PolicyStatusBadge, PolicyMessageStack, NextActionHint } from "./index";
import { QuoteChainProgressStrip, type ChainStageKey } from "./quote-chain-progress-strip";
import type { PoCreatedState, PoCreatedDecisionOptions } from "@/lib/ai/po-created-engine";
import type {
  POCreatedRecord,
  SupplierFacingPayloadStatus,
  ReentryActionKey,
} from "@/lib/ai/po-created-record";

// ══════════════════════════════════════════════
// Props
// ══════════════════════════════════════════════

export interface POCreatedReentrySurfaceProps {
  state: PoCreatedState;
  decisionOptions: PoCreatedDecisionOptions;
  /**
   * Unified canonical computed view.
   * 제공되면 surface 는 이 record 를 governance truth 로 소비하고,
   * nextAction · dispatchReadiness · supplierFacingPayloadStatus ·
   * snapshotValidity · blockingReasons · reentryAvailableActions 를
   * 그대로 화면/dock 게이팅에 사용한다 (legacy 추론 경로 우회).
   *
   * 미제공 시에는 기존 legacy path 를 그대로 유지한다 (backward compat).
   */
  record?: POCreatedRecord;
  // Evidence
  vendorName: string;
  totalAmount: number;
  poNumber: string;
  // Snapshot validity
  approvalSnapshotValid: boolean;
  conversionSnapshotValid: boolean;
  // Handlers
  onProceedToDispatchPrep?: () => void;
  onHold?: () => void;
  onReturnToConversion?: () => void;
  /** QuoteChainProgressStrip stage navigation */
  onStageClick?: (stage: ChainStageKey) => void;
  className?: string;
}

// ══════════════════════════════════════════════
// Readiness → Surface mapping
// ══════════════════════════════════════════════

type ReadinessBadge = "ready" | "incomplete" | "blocked";

function resolveReadinessSurface(state: PoCreatedState, approvalValid: boolean, conversionValid: boolean): {
  badge: ReadinessBadge;
  badgeColor: string;
  primaryMessage: string;
  blockerMessages: string[];
  nextAction: string;
} {
  const blockers: string[] = [];

  if (state.poCreatedBlockedFlag) {
    blockers.push(state.poCreatedBlockedReason || "PO Created 차단됨");
  }
  if (!approvalValid) {
    blockers.push("승인 snapshot 무효 — 재승인 필요");
  }
  if (!conversionValid) {
    blockers.push("PO 전환 snapshot 무효 — 전환 재실행 필요");
  }
  if (state.missingFieldCount > 0) {
    blockers.push(`필수 필드 ${state.missingFieldCount}건 누락`);
  }

  const isBlocked = state.poCreatedBlockedFlag || !approvalValid || !conversionValid;
  const isIncomplete = !isBlocked && state.missingFieldCount > 0;

  return {
    badge: isBlocked ? "blocked" : isIncomplete ? "incomplete" : "ready",
    badgeColor: isBlocked ? "red" : isIncomplete ? "amber" : "emerald",
    primaryMessage: isBlocked
      ? "발송 준비 차단 — 사전 조건 미충족"
      : isIncomplete
        ? `발송 준비 미완 — 필수 필드 ${state.missingFieldCount}건 보완 필요`
        : "Dispatch Preparation 진입 가능",
    blockerMessages: blockers,
    nextAction: isBlocked
      ? blockers[0] || "차단 사유 해결"
      : isIncomplete
        ? "필수 필드 완료 후 Dispatch Preparation 진입"
        : "Dispatch Preparation으로 진행",
  };
}

const BADGE_MAP: Record<ReadinessBadge, "allowed" | "approval_needed" | "blocked"> = {
  ready: "allowed",
  incomplete: "approval_needed",
  blocked: "blocked",
};

// ══════════════════════════════════════════════
// Record-driven surface resolver (governed path)
// ══════════════════════════════════════════════
//
// POCreatedRecord 가 제공되면 legacy 추론을 우회하고
// record 의 필드를 그대로 UI 에 투영한다.
//
// 핵심 원칙:
// - record.nextAction 이 가장 먼저 보이는 메시지여야 한다 (CLAUDE.md)
// - record.blockingReasons 가 그대로 blocker 카드 목록이다
// - record.reentryAvailableActions 만 dock 에서 활성화된다
//   (optimistic unlock 절대 금지)
// - supplier-facing payload 상태는 internal truth 와 분리된
//   supplierFacingPayloadStatus 로 표기한다.

const PAYLOAD_STATUS_LABEL: Record<SupplierFacingPayloadStatus, { text: string; tone: "emerald" | "amber" | "red" | "slate" }> = {
  not_ready: { text: "공급사 페이로드 미완성", tone: "red" },
  draft:     { text: "공급사 페이로드 초안 — 검토 권장", tone: "amber" },
  locked:    { text: "공급사 페이로드 잠금 — 발송 가능", tone: "emerald" },
  stale:     { text: "공급사 페이로드 무효화 — 재생성 필요", tone: "red" },
};

function resolveRecordDrivenSurface(record: POCreatedRecord): {
  badge: ReadinessBadge;
  primaryMessage: string;
  blockerMessages: string[];
  nextAction: string;
  payloadStatusLabel: string;
  payloadTone: "emerald" | "amber" | "red" | "slate";
} {
  const hardBlockers = record.blockingReasons.filter((b) => b.severity === "hard");
  const softBlockers = record.blockingReasons.filter((b) => b.severity === "soft");
  const snapshotInvalid = Boolean(record.snapshotValidity.reason);
  const isBlocked = hardBlockers.length > 0 || snapshotInvalid;
  const isIncomplete = !isBlocked && (softBlockers.length > 0 || record.dispatchReadiness === "needs_review");

  const badge: ReadinessBadge = isBlocked ? "blocked" : isIncomplete ? "incomplete" : "ready";
  const payloadMeta = PAYLOAD_STATUS_LABEL[record.supplierFacingPayloadStatus];

  return {
    badge,
    primaryMessage: isBlocked
      ? "발송 준비 차단 — 사전 조건 미충족"
      : isIncomplete
        ? "검토 필요 — 발송 전 확인 필요"
        : "Dispatch Preparation 진입 가능",
    blockerMessages: record.blockingReasons.map((b) => `${b.message} → ${b.remediation}`),
    nextAction: record.nextAction,
    payloadStatusLabel: payloadMeta.text,
    payloadTone: payloadMeta.tone,
  };
}

const TONE_CLASSES: Record<"emerald" | "amber" | "red" | "slate", { border: string; bg: string; text: string }> = {
  emerald: { border: "border-emerald-500/20", bg: "bg-emerald-500/5", text: "text-emerald-300" },
  amber:   { border: "border-amber-500/20",   bg: "bg-amber-500/5",   text: "text-amber-300" },
  red:     { border: "border-red-500/20",     bg: "bg-red-500/5",     text: "text-red-300" },
  slate:   { border: "border-slate-700",      bg: "bg-slate-900/50",  text: "text-slate-400" },
};

// ══════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════

export function POCreatedReentrySurface({
  state, decisionOptions, record,
  vendorName, totalAmount, poNumber,
  approvalSnapshotValid, conversionSnapshotValid,
  onProceedToDispatchPrep, onHold, onReturnToConversion,
  onStageClick,
  className,
}: POCreatedReentrySurfaceProps) {
  // Record-driven governance path 우선. record 가 없으면 legacy 로 fallback.
  // 이 분기는 UI 투영만 결정하며 canonical mutation 은 절대 발생시키지 않는다.
  const recordSurface = record ? resolveRecordDrivenSurface(record) : null;
  const legacySurface = resolveReadinessSurface(state, approvalSnapshotValid, conversionSnapshotValid);
  const surface = recordSurface
    ? {
        badge: recordSurface.badge,
        badgeColor: recordSurface.badge === "blocked" ? "red" : recordSurface.badge === "incomplete" ? "amber" : "emerald",
        primaryMessage: recordSurface.primaryMessage,
        blockerMessages: recordSurface.blockerMessages,
        nextAction: recordSurface.nextAction,
      }
    : legacySurface;

  // Dock gating — record 가 있으면 reentryAvailableActions 만 신뢰.
  // 없으면 legacy decisionOptions 를 유지한다.
  const allowedActions = React.useMemo(
    () => new Set<ReentryActionKey>(record?.reentryAvailableActions ?? []),
    [record],
  );
  const canOpenDispatchPrep = record
    ? allowedActions.has("open_dispatch_prep")
    : decisionOptions.canOpenDispatchPrep;
  const canHold = record ? allowedActions.has("hold") : decisionOptions.canHold;
  const canReopen = record ? allowedActions.has("reopen_po_conversion") : true;

  return (
    <div className={cn("flex gap-4 h-full", className)}>
      {/* ═══ CENTER — dispatch readiness + next action + summary ═══ */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Chain progress — 전체 진행 맥락 */}
        <QuoteChainProgressStrip
          currentStage="po_created"
          stageStatuses={
            surface.badge === "blocked"
              ? { po_created: "blocked" }
              : undefined
          }
          onStageClick={onStageClick}
        />

        {/* Dispatch readiness strip — 가장 먼저 보이는 영역 */}
        <div className="flex items-center gap-3 px-4 py-2.5 rounded bg-slate-900 border border-slate-800">
          <PolicyStatusBadge status={BADGE_MAP[surface.badge]} pulse={surface.badge === "blocked"} />
          <PolicyMessageStack
            primaryMessage={surface.primaryMessage}
            blockerMessages={surface.blockerMessages}
            nextActionMessage={surface.nextAction}
            compact
          />
        </div>

        {/* Next required action — 두 번째로 눈에 띄는 영역 */}
        {/* record 가 있으면 record.nextAction 이 canonical message 이다. */}
        <div className={cn("rounded border px-4 py-3",
          surface.badge === "ready" ? "border-emerald-500/20 bg-emerald-500/5" : surface.badge === "blocked" ? "border-red-500/20 bg-red-500/5" : "border-amber-500/20 bg-amber-500/5"
        )}>
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">다음 필요 작업</span>
          <p className={cn("text-sm font-medium mt-0.5",
            surface.badge === "ready" ? "text-emerald-300" : surface.badge === "blocked" ? "text-red-300" : "text-amber-300"
          )}>
            {surface.nextAction || decisionOptions.decisionReasonSummary}
          </p>
        </div>

        {/* Supplier-facing payload status — internal truth 와 분리된 send-target 상태 */}
        {recordSurface && record && (
          <div className={cn("rounded border px-4 py-2.5", TONE_CLASSES[recordSurface.payloadTone].border, TONE_CLASSES[recordSurface.payloadTone].bg)}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">공급사 페이로드</span>
                <p className={cn("text-xs font-medium mt-0.5", TONE_CLASSES[recordSurface.payloadTone].text)}>
                  {recordSurface.payloadStatusLabel}
                </p>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">
                readiness · {record.dispatchReadiness.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        )}

        {/* Blocking reasons — record-driven hard/soft 목록 */}
        {recordSurface && record && record.blockingReasons.length > 0 && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-4 space-y-2">
            <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500">차단/검토 사유</h4>
            {record.blockingReasons.map((b, i) => (
              <div key={`${b.code}-${i}`} className="flex items-start gap-2 text-xs">
                <span className={cn("shrink-0 mt-0.5", b.severity === "hard" ? "text-red-400" : "text-amber-400")}>
                  {b.severity === "hard" ? "✕" : "△"}
                </span>
                <div className="min-w-0">
                  <span className={b.severity === "hard" ? "text-red-300" : "text-amber-300"}>{b.message}</span>
                  <span className="text-slate-500 ml-2">→ {b.remediation}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PO summary */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">PO 생성 정보</h3>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-slate-500 text-xs">PO 번호</span>
              <p className="text-slate-700 font-mono">{poNumber || state.poCreatedObjectId || "미할당"}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">공급사</span>
              <p className="text-slate-700">{vendorName}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">금액</span>
              <p className="text-sm font-semibold tabular-nums text-slate-900">{totalAmount.toLocaleString()}원</p>
            </div>
          </div>
        </div>

        {/* Status detail */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-4 space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500">생성 상태</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Status</span>
              <span className="text-slate-600">{state.poCreatedStatus.replace(/_/g, " ")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Substatus</span>
              <span className="text-slate-600">{state.substatus.replace(/_/g, " ")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">공급사 수</span>
              <span className="text-slate-600 tabular-nums">{state.createdVendorCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">라인 수</span>
              <span className="text-slate-600 tabular-nums">{state.createdLineCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">상업 필드</span>
              <span className="text-slate-600 tabular-nums">{state.createdCommercialFieldCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">운영 필드</span>
              <span className="text-slate-600 tabular-nums">{state.createdOperationalFieldCount}</span>
            </div>
          </div>
          {state.missingFieldCount > 0 && (
            <div className="mt-2 flex items-center gap-2 text-xs text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
              <span>누락 필드 {state.missingFieldCount}건 — 보완 필요</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ RAIL — snapshot validity + basis summary ═══ */}
      <div className="w-64 shrink-0 space-y-3">
        {/* Snapshot validity */}
        <div className={cn("rounded border p-3 text-xs",
          approvalSnapshotValid && conversionSnapshotValid ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"
        )}>
          <h5 className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1">Snapshot 유효성</h5>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">견적 승인</span>
              <span className={approvalSnapshotValid ? "text-emerald-400" : "text-red-400"}>
                {approvalSnapshotValid ? "유효" : "무효"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">PO 전환</span>
              <span className={conversionSnapshotValid ? "text-emerald-400" : "text-red-400"}>
                {conversionSnapshotValid ? "유효" : "무효"}
              </span>
            </div>
          </div>
        </div>

        {/* Basis summary */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 text-xs space-y-1.5">
          <h5 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Created Basis</h5>
          <div className="flex justify-between">
            <span className="text-slate-500">결제 조건</span>
            <span className="text-slate-600">{state.createdBasis.paymentTerm || "미설정"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">납품 대상</span>
            <span className="text-slate-600 truncate ml-2">{state.createdBasis.deliveryTarget || "미설정"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">배송처</span>
            <span className="text-slate-600 truncate ml-2">{state.createdBasis.shipToReference || "미설정"}</span>
          </div>
        </div>

        {/* Blocked reason (if any) */}
        {state.poCreatedBlockedFlag && state.poCreatedBlockedReason && (
          <div className="rounded border border-red-500/20 bg-red-500/5 p-3 text-xs">
            <span className="text-red-400 font-medium">차단 사유</span>
            <p className="text-red-300/80 mt-0.5">{state.poCreatedBlockedReason}</p>
          </div>
        )}
      </div>

      {/* ═══ DOCK ═══ */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950 px-4 py-3">
        <div className="flex items-center justify-between">
          <NextActionHint
            message={surface.nextAction}
            variant={surface.badge === "blocked" ? "blocked" : "default"}
          />
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {onReturnToConversion && canReopen && (
              <button onClick={onReturnToConversion} className="rounded border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors">
                PO 전환 재열기
              </button>
            )}
            {onHold && canHold && (
              <button onClick={onHold} className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors">
                보류
              </button>
            )}
            {onProceedToDispatchPrep && canOpenDispatchPrep && (
              <button onClick={onProceedToDispatchPrep} className="rounded bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-medium text-white transition-colors">
                Dispatch Preparation 진입
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
