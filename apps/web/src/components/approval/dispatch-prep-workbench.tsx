"use client";

/**
 * DispatchPreparationWorkbench — PO 발송 준비 center/rail/dock
 *
 * center = supplier-facing payload + blockers + confirmation checklist
 * rail = approval rationale + snapshot validity + supplier profile
 * dock = send now / schedule / request correction / reopen conversion / cancel
 *
 * ready_to_send ≠ sent. sent는 실제 action 이후에만.
 *
 * Mobile-first 반응형:
 *   max-md: 세로 스택 (center → rail 아코디언 → dock 하단 고정)
 *   md+: center + rail 가로 배치, dock 하단 고정
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { PolicyStatusBadge, PolicyMessageStack, NextActionHint } from "./index";
import { QuoteChainProgressStrip, type ChainStageKey } from "./quote-chain-progress-strip";
import type { DispatchPreparationGovernanceState, DispatchPolicySurface, ConfirmationItem } from "@/lib/ai/po-dispatch-governance-engine";
import { canCreateExecution } from "@/lib/ai/dispatch-execution-handoff";
import { evaluateDispatchSendPrecondition } from "@/lib/ontology/dispatch/dispatch-send-precondition";
import { useDispatchGovernanceSync } from "@/hooks/use-dispatch-governance-sync";
import { useOpenGovernedComposer } from "@/hooks/use-open-governed-composer";

/** Rail context — approval / quote / supplier 참조 정보 */
export interface DispatchRailContext {
  /** 승인 근거 요약 */
  approvalRationale: string;
  /** 견적 후보 선정 사유 */
  quoteShortlistReason: string;
  /** 공급사 프로필 요약 */
  supplierProfile: string;
  /** 공급사 라우팅 설명 */
  supplierRoutingExplanation: string;
  /** Fast-Track 수락 경로 provenance (null 이면 일반 승인 경로) */
  fastTrackProvenance?: FastTrackProvenanceInfo | null;
}

/** Fast-Track 수락 경로를 통해 승인된 PO 임을 나타내는 provenance 정보 */
export interface FastTrackProvenanceInfo {
  /** Fast-Track 수락 시점 (ISO 8601) */
  acceptedAt: string;
  /** 수락자 (이메일/이름) */
  acceptedBy: string;
  /** 수락 시점의 safetyScore */
  safetyScore: number;
  /** 자동 승인 사유 코드 목록 */
  reasonCodes: string[];
  /** 사람이 읽는 사유 요약 */
  reasonSummary: string;
}

/** Supplier-facing payload preview 데이터 */
export interface SupplierFacingPayloadPreview {
  recipientName: string;
  recipientEmail: string;
  sendChannel: string;
  poSummaryLines: string[];
  deliveryReference: string;
  paymentReference: string;
  attachmentNames: string[];
  supplierNote: string;
}

export interface DispatchPrepWorkbenchProps {
  state: DispatchPreparationGovernanceState;
  surface: DispatchPolicySurface;
  // Evidence
  vendorName: string;
  totalAmount: number;
  poNumber: string;
  // Rail context (CLAUDE.md 필수)
  railContext?: DispatchRailContext;
  // Supplier-facing payload (CLAUDE.md: center에 preview)
  supplierPayload?: SupplierFacingPayloadPreview;
  // Handlers
  onSendNow?: () => void;
  onScheduleSend?: (date: string) => void;
  onRequestCorrection?: (reason: string) => void;
  onReopenConversion?: () => void;
  onCancelPrep?: () => void;
  onStageClick?: (stage: ChainStageKey) => void;
  /** case ID for governance event subscription */
  caseId?: string;
  /** readiness 재계산 콜백 — governance 이벤트 수신 시 호출 */
  onReadinessRecalcNeeded?: () => void;
  className?: string;
}

export function DispatchPrepWorkbench({
  state, surface, vendorName, totalAmount, poNumber,
  railContext, supplierPayload,
  onSendNow, onScheduleSend, onRequestCorrection, onReopenConversion, onCancelPrep,
  onStageClick,
  caseId,
  onReadinessRecalcNeeded,
  className,
}: DispatchPrepWorkbenchProps) {
  // Layer 1: governance state guard (기존 — backward compat)
  const sendGuard = canCreateExecution(state);

  // Layer 2: comprehensive dock locks (invalidation + snapshot + confirmation)
  const allConfirmed = state.allConfirmed ?? state.confirmationChecklist.every((c: ConfirmationItem) => !c.required || c.confirmed);
  const { dockLocks, irreversibleLocked } = useDispatchGovernanceSync({
    poNumber,
    caseId: caseId ?? poNumber,
    readiness: state.readiness,
    snapshotValid: state.approvalSnapshotValid && state.conversionSnapshotValid,
    allConfirmed,
    onReadinessRecalcNeeded,
  });

  // Layer 3: send precondition contract — single source of truth.
  // governance state 가 모든 derived check 를 거친 후의 마지막 정문.
  // 본 layer 는 hook 의 mutation-time 재검증과 동일한 함수를 호출한다.
  const sendPrecondition = React.useMemo(
    () => evaluateDispatchSendPrecondition(state),
    [state],
  );

  // Combined guard: 세 layer 모두 allow — optimistic unlock 금지
  const sendAllowed =
    sendGuard.allowed && !dockLocks.sendNowLocked && sendPrecondition.sendNowAllowed;
  const scheduleAllowed =
    sendGuard.allowed &&
    !dockLocks.scheduleSendLocked &&
    sendPrecondition.scheduleSendAllowed;
  const lockReason =
    (!sendPrecondition.sendNowAllowed && sendPrecondition.summary) ||
    dockLocks.lockReason ||
    sendGuard.denyReason;

  const [railOpen, setRailOpen] = React.useState(false);
  const openComposer = useOpenGovernedComposer();

  const handleOpenComposer = React.useCallback(() => {
    openComposer({
      origin: "dispatch_dock",
      workbenchStage: "dispatch_preparation",
      selectedEntityIds: [poNumber],
      selectedEntityType: "purchase_order",
      currentStatus: "dispatch_preparation",
      linkedPoNumber: poNumber,
      linkedSupplierName: vendorName,
      dryRunContext: {
        approvalSnapshotValid: { [poNumber]: state.approvalSnapshotValid },
        policyHoldActive: state.hardBlockers.some((b) => b.type === "policy_hold_active"),
        policyHoldReason: state.hardBlockers.find((b) => b.type === "policy_hold_active")?.detail ?? null,
        hasPendingCriticalEvents: state.hardBlockers.some((b) => b.type === "snapshot_invalidated" || b.type === "approval_expired"),
        availableBudget: null,
        recipientConfigured: Boolean(surface.statusBadge !== "blocked"),
        attachmentsComplete: !state.hardBlockers.some((b) => b.type === "required_document_missing"),
        commercialTermsComplete: !state.hardBlockers.some((b) => b.type === "commercial_terms_missing"),
        contactInfoComplete: true,
        entityStatuses: { [poNumber]: "dispatch_preparation" },
        supplierInfo: { id: poNumber, name: vendorName },
        totalAmount,
      },
    });
  }, [openComposer, poNumber, state, surface, vendorName, totalAmount]);

  return (
    <div
      role="main"
      aria-label="Dispatch Preparation Workbench"
      className={cn(
        // 모바일: 세로 스택 + 하단 dock 공간 확보
        "flex flex-col pb-20",
        // 데스크톱: 가로 배치
        "md:flex-row md:gap-4 md:h-full md:pb-0",
        className,
      )}>
      {/* ═══ CENTER ═══ */}
      <div className="flex-1 min-w-0 space-y-3 md:space-y-4">
        {/* Chain progress */}
        <QuoteChainProgressStrip
          currentStage="dispatch_prep"
          stageStatuses={
            state.readiness === "blocked"
              ? { dispatch_prep: "blocked" }
              : undefined
          }
          onStageClick={onStageClick}
        />

        {/* Next required action — center top (CLAUDE.md: 항상 center top에서 읽히는지) */}
        <div className={cn(
          "flex items-start gap-2 px-3 md:px-4 py-2.5 rounded border text-xs",
          surface.statusBadge === "blocked" ? "border-red-500/30 bg-red-500/5 text-red-300" :
          surface.statusBadge === "reapproval_needed" ? "border-amber-500/30 bg-amber-500/5 text-amber-300" :
          "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
        )}>
          <span className="shrink-0 mt-0.5 font-medium">{surface.statusBadge === "blocked" ? "✕" : surface.statusBadge === "reapproval_needed" ? "△" : "→"}</span>
          <span className="font-medium">{surface.nextAction}</span>
        </div>

        {/* Policy strip */}
        <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-2.5 rounded bg-slate-900 border border-slate-800">
          <PolicyStatusBadge status={surface.statusBadge} pulse={surface.statusBadge === "blocked" || surface.statusBadge === "reapproval_needed"} />
          <PolicyMessageStack primaryMessage={surface.primaryMessage} blockerMessages={surface.blockerMessages} warningMessages={surface.warningMessages} nextActionMessage={surface.nextAction} compact />
        </div>

        {/* PO summary */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 md:p-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2 md:mb-3">발송 대상</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3 text-sm">
            <div><span className="text-slate-500 text-xs">PO 번호</span><p className="text-slate-700 font-mono">{poNumber}</p></div>
            <div><span className="text-slate-500 text-xs">공급사</span><p className="text-slate-700">{vendorName}</p></div>
            <div><span className="text-slate-500 text-xs">금액</span><p className="text-sm font-semibold tabular-nums text-slate-900">{totalAmount.toLocaleString()}원</p></div>
          </div>
        </div>

        {/* Blockers */}
        {state.hardBlockers.length > 0 && (
          <div className="rounded border border-red-500/20 bg-red-500/5 p-3 md:p-4 space-y-2">
            <h4 className="text-xs font-medium text-red-300">발송 차단 사유</h4>
            {state.hardBlockers.map((b, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-red-400 shrink-0 mt-0.5">✕</span>
                <div>
                  <span className="text-red-300">{b.detail}</span>
                  <span className="block sm:inline text-red-400/70 sm:ml-2">→ {b.remediationAction}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Soft blockers / warnings */}
        {state.softBlockers.length > 0 && (
          <div className="rounded border border-amber-500/20 bg-amber-500/5 p-3 md:p-4 space-y-2">
            <h4 className="text-xs font-medium text-amber-300">검토 권장 사항</h4>
            {state.softBlockers.map((b, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-amber-400 shrink-0 mt-0.5">△</span>
                <div>
                  <span className="text-amber-300">{b.detail}</span>
                  <span className="block sm:inline text-amber-400/70 sm:ml-2">→ {b.remediationAction}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Confirmation checklist */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 md:p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500">발송 전 확인</h4>
            <span className="text-xs text-slate-400">{surface.checklistProgress}</span>
          </div>
          <div className="space-y-1.5 md:space-y-1">
            {state.confirmationChecklist.map(item => (
              <div key={item.key} className="flex items-center gap-2 text-xs">
                <span className={cn("h-4 w-4 md:h-3.5 md:w-3.5 rounded border flex items-center justify-center text-[10px] md:text-[9px]",
                  item.confirmed ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" : item.required ? "border-red-500/30 text-red-400" : "border-slate-700 text-slate-500"
                )}>
                  {item.confirmed ? "✓" : item.required ? "!" : "·"}
                </span>
                <span className={item.confirmed ? "text-slate-600" : item.required ? "text-red-300" : "text-slate-500"}>
                  {item.label}
                </span>
                {item.required && !item.confirmed && <span className="text-[10px] text-red-400/70">필수</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Supplier-facing payload preview (CLAUDE.md: center 필수) */}
        {supplierPayload && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3 md:p-4 space-y-2">
            <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500">공급사 발송 내용</h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
              <div>
                <span className="text-slate-500">수신자</span>
                <p className="text-slate-600 break-all">{supplierPayload.recipientName} ({supplierPayload.recipientEmail})</p>
              </div>
              <div>
                <span className="text-slate-500">발송 채널</span>
                <p className="text-slate-600">{supplierPayload.sendChannel}</p>
              </div>
            </div>
            {supplierPayload.poSummaryLines.length > 0 && (
              <div className="text-xs">
                <span className="text-slate-500">PO 요약</span>
                {supplierPayload.poSummaryLines.map((line, i) => (
                  <p key={i} className="text-slate-600">{line}</p>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
              <div>
                <span className="text-slate-500">납품 참조</span>
                <p className="text-slate-600">{supplierPayload.deliveryReference || "미지정"}</p>
              </div>
              <div>
                <span className="text-slate-500">결제 참조</span>
                <p className="text-slate-600">{supplierPayload.paymentReference || "미지정"}</p>
              </div>
            </div>
            {supplierPayload.attachmentNames.length > 0 && (
              <div className="text-xs">
                <span className="text-slate-500">첨부</span>
                <p className="text-slate-600">{supplierPayload.attachmentNames.join(", ")}</p>
              </div>
            )}
            {supplierPayload.supplierNote && (
              <div className="text-xs">
                <span className="text-slate-500">공급사 전달 사항</span>
                <p className="text-slate-600">{supplierPayload.supplierNote}</p>
              </div>
            )}
          </div>
        )}

        {/* Locked vs Editable fields */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3">
            <h5 className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1">잠긴 필드 ({state.lockedFields.length})</h5>
            <div className="flex flex-wrap gap-1">
              {state.lockedFields.map(f => <span key={f} className="text-[10px] bg-slate-800 text-slate-500 rounded px-1.5 py-0.5">{f}</span>)}
            </div>
          </div>
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3">
            <h5 className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1">수정 가능 ({state.editableFields.length})</h5>
            <div className="flex flex-wrap gap-1">
              {state.editableFields.map(f => <span key={f} className="text-[10px] bg-blue-500/10 text-blue-400 rounded px-1.5 py-0.5">{f}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ RAIL ═══ */}
      {/* 모바일: 토글 가능한 아코디언 / 데스크톱: 상시 표시 */}
      <div
        role="complementary"
        aria-label="참고 정보"
        className="mt-3 md:mt-0 md:w-64 md:shrink-0"
      >
        {/* 모바일 토글 버튼 */}
        <button
          onClick={() => setRailOpen((v) => !v)}
          aria-expanded={railOpen}
          className="flex w-full items-center justify-between rounded border border-slate-800 bg-slate-900/50 px-3 py-2.5 text-xs font-medium text-slate-400 md:hidden active:scale-[0.98] transition-transform"
        >
          <span>참조 정보 (승인 근거 / 스냅샷 / 공급사)</span>
          <span className={cn("transition-transform", railOpen && "rotate-180")}>▾</span>
        </button>

        <div className={cn(
          // 모바일: 아코디언
          "overflow-hidden transition-all duration-200 md:overflow-visible",
          railOpen ? "max-h-[2000px] opacity-100 mt-2" : "max-h-0 opacity-0 md:max-h-none md:opacity-100",
        )}>
          <div className="space-y-3">
            {/* Snapshot validity */}
            <div className={cn("rounded border p-3 text-xs",
              state.approvalSnapshotValid && state.conversionSnapshotValid ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"
            )}>
              <h5 className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1">Snapshot 유효성</h5>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">견적 승인</span>
                  <span className={state.approvalSnapshotValid ? "text-emerald-400" : "text-red-400"}>{state.approvalSnapshotValid ? "유효" : "무효"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">PO 전환</span>
                  <span className={state.conversionSnapshotValid ? "text-emerald-400" : "text-red-400"}>{state.conversionSnapshotValid ? "유효" : "무효"}</span>
                </div>
              </div>
              {state.snapshotInvalidationReason && <p className="text-red-400/70 text-[10px] mt-1">{state.snapshotInvalidationReason}</p>}
            </div>

            {/* Fast-Track Provenance */}
            {railContext?.fastTrackProvenance && (
              <div className="rounded border border-lime-500/20 bg-lime-500/5 p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-lime-400 text-xs">⚡</span>
                  <h5 className="text-[10px] font-medium uppercase tracking-wider text-lime-400">
                    Fast-Track 수락 경로
                  </h5>
                </div>
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">안전 점수</span>
                    <span className="text-lime-300 tabular-nums">
                      {(railContext.fastTrackProvenance.safetyScore * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">수락자</span>
                    <span className="text-slate-400">{railContext.fastTrackProvenance.acceptedBy}</span>
                  </div>
                  <p className="text-slate-500 leading-tight mt-1">
                    {railContext.fastTrackProvenance.reasonSummary}
                  </p>
                </div>
                <p className="text-[9px] text-lime-500/60 mt-1.5 leading-tight">
                  일반 승인 대비 검토 depth 가 낮습니다. 발송 전 공급사 조건을 재확인하세요.
                </p>
              </div>
            )}

            {/* Delta since approval */}
            {state.supplierFacingPayloadDelta.length > 0 && (
              <div className="rounded border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <h5 className="text-[10px] font-medium uppercase tracking-wider text-amber-400">
                    승인 이후 변경
                  </h5>
                  <span className="text-[10px] font-medium text-amber-500/80">
                    {state.supplierFacingPayloadDelta.length}건
                  </span>
                </div>
                <ul className="space-y-0.5">
                  {state.supplierFacingPayloadDelta.map((d, i) => (
                    <li key={i} className="text-[10px] text-amber-300 flex gap-1.5">
                      <span className="text-amber-500/60 shrink-0">•</span>
                      <span className="leading-tight">{d}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[9px] text-amber-500/60 mt-1.5 leading-tight">
                  재승인 또는 PO 전환 재실행 후 재검토 필요
                </p>
              </div>
            )}

            {/* Approval rationale */}
            {railContext?.approvalRationale && (
              <div className="rounded border border-slate-800 bg-slate-900/50 p-3 text-xs space-y-1">
                <h5 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">승인 근거</h5>
                <p className="text-slate-600">{railContext.approvalRationale}</p>
              </div>
            )}

            {/* Quote shortlist context */}
            {railContext?.quoteShortlistReason && (
              <div className="rounded border border-slate-800 bg-slate-900/50 p-3 text-xs space-y-1">
                <h5 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">견적 선정 사유</h5>
                <p className="text-slate-600">{railContext.quoteShortlistReason}</p>
              </div>
            )}

            {/* Supplier profile */}
            {railContext?.supplierProfile && (
              <div className="rounded border border-slate-800 bg-slate-900/50 p-3 text-xs space-y-1">
                <h5 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">공급사 프로필</h5>
                <p className="text-slate-600">{railContext.supplierProfile}</p>
                {railContext.supplierRoutingExplanation && (
                  <>
                    <h5 className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mt-1.5">라우팅 설명</h5>
                    <p className="text-slate-600">{railContext.supplierRoutingExplanation}</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ DOCK ═══ */}
      <div
        role="toolbar"
        aria-label="작업 도구"
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-800 bg-slate-950 px-3 py-2.5 md:absolute md:px-4 md:py-3 safe-area-pb"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <NextActionHint
            message={surface.nextAction}
            variant={surface.statusBadge === "blocked" ? "blocked" : surface.statusBadge === "reapproval_needed" ? "urgent" : "default"}
          />
          {/* 모바일: 가로 스크롤 가능한 액션 버튼 / 데스크톱: 한 줄 */}
          <div className="flex items-center gap-2 overflow-x-auto snap-x shrink-0 pb-0.5 sm:pb-0">
            {onCancelPrep && (
              <button
                onClick={onCancelPrep}
                aria-label="발송 취소"
                className="shrink-0 rounded border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 active:scale-95 min-h-[40px] px-3 py-2 md:py-1.5 text-xs font-medium text-red-300 transition-all snap-start"
              >
                취소
              </button>
            )}
            {onReopenConversion && (
              <button
                onClick={onReopenConversion}
                aria-label="PO 전환 다시 열기"
                className="shrink-0 rounded border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 min-h-[40px] px-3 py-2 md:py-1.5 text-xs font-medium text-amber-300 transition-all snap-start"
              >
                PO 전환 재열기
              </button>
            )}
            {onRequestCorrection && state.readiness === "blocked" && (
              <button
                onClick={() => onRequestCorrection(state.hardBlockers[0]?.remediationAction || "")}
                aria-label="보정 요청"
                className="shrink-0 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 active:scale-95 min-h-[40px] px-3 py-2 md:py-1.5 text-xs font-medium text-slate-600 transition-all snap-start"
              >
                보정 요청
              </button>
            )}
            {onScheduleSend && (
              <button
                onClick={() => onScheduleSend("")}
                disabled={!scheduleAllowed}
                title={!scheduleAllowed ? (lockReason ?? undefined) : undefined}
                aria-label="발송 예약"
                className="shrink-0 rounded border border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/20 active:scale-95 min-h-[40px] px-3 py-2 md:py-1.5 text-xs font-medium text-blue-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed snap-start"
              >
                예약 발송
              </button>
            )}
            <button
              onClick={handleOpenComposer}
              aria-label="Governed Action Composer 열기"
              className="shrink-0 rounded border border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/20 active:scale-95 min-h-[40px] px-3 py-2 md:py-1.5 text-xs font-medium text-blue-300 transition-all snap-start"
            >
              통제 실행
            </button>
            {onSendNow && (
              <button
                onClick={onSendNow}
                disabled={!sendAllowed}
                title={!sendAllowed ? (lockReason ?? undefined) : undefined}
                aria-label="지금 발송"
                className="shrink-0 rounded bg-blue-600 hover:bg-blue-500 active:scale-95 min-h-[40px] px-4 py-2 md:py-1.5 text-xs font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed snap-start"
              >
                발송 실행
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
