"use client";

/**
 * Governed Action Composer — Overlay UI Surface
 *
 * center / rail / dock grammar 유지.
 * chatbot이 아닌, 구조화된 operator control panel.
 *
 * 규칙:
 *   1. chat 말풍선 금지
 *   2. fake log / ontology traversal 연출 금지
 *   3. center = decision (intent 입력 + proposal 확인)
 *   4. rail = context (lineage + snapshot + blocker 설명)
 *   5. dock = execution (실행/예약/교정/취소)
 *   6. blocker 있으면 dock action 잠금
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X, Search, ArrowRight, AlertTriangle, CheckCircle2, XCircle,
  Shield, FileText, ChevronRight, Lock, Unlock, Clock,
  Send, Calendar, RotateCcw, Ban, Loader2,
  ChevronDown, ChevronUp, Info, Zap,
} from "lucide-react";
import {
  resolveIntent,
  selectIntent,
  getAvailableIntentsForContext,
  type ComposerWorkbenchContext,
  type IntentResolutionResult,
  type ResolvedActionIntent,
  type GovernedIntentType,
} from "@/lib/governed-action/governed-action-intent-engine";
import {
  buildProposal,
  canExecuteProposal,
  type GovernedActionProposal,
  type DryRunContext,
  type AffectedRecord,
  type ProposalBlocker,
  type ConfirmationItem,
  type ExecutionPlanStep,
} from "@/lib/governed-action/governed-action-dryrun-engine";

// ══════════════════════════════════════════════════════════════
// Props
// ══════════════════════════════════════════════════════════════

interface GovernedActionComposerProps {
  /** overlay 열림 상태 */
  open: boolean;
  /** 닫기 콜백 */
  onClose: () => void;
  /** 현재 workbench 컨텍스트 (진입점에서 주입) */
  context: ComposerWorkbenchContext | null;
  /** dry-run 컨텍스트 (store에서 계산해서 주입) */
  dryRunContext: DryRunContext | null;
  /** 실행 콜백 — 실제 mutation은 caller가 수행 */
  onExecute: (proposal: GovernedActionProposal) => void;
}

// ══════════════════════════════════════════════════════════════
// Composer phases
// ══════════════════════════════════════════════════════════════
type ComposerPhase = "intent" | "disambiguation" | "proposal" | "executing";

export function GovernedActionComposer({
  open, onClose, context, dryRunContext, onExecute,
}: GovernedActionComposerProps) {
  const [phase, setPhase] = useState<ComposerPhase>("intent");
  const [inputValue, setInputValue] = useState("");
  const [intentResult, setIntentResult] = useState<IntentResolutionResult | null>(null);
  const [selectedIntent, setSelectedIntent] = useState<ResolvedActionIntent | null>(null);
  const [proposal, setProposal] = useState<GovernedActionProposal | null>(null);
  const [confirmations, setConfirmations] = useState<Record<string, boolean>>({});
  const [railExpanded, setRailExpanded] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── 열릴 때 초기화 ──
  useEffect(() => {
    if (open) {
      setPhase("intent");
      setInputValue("");
      setIntentResult(null);
      setSelectedIntent(null);
      setProposal(null);
      setConfirmations({});
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // ── 사용 가능 intent (현재 context 기반) ──
  const availableIntents = useMemo(() => {
    if (!context) return [];
    return getAvailableIntentsForContext(context);
  }, [context]);

  // ── Intent 해석 ──
  const handleIntentSubmit = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    const result = resolveIntent(trimmed, context);
    setIntentResult(result);

    if (result.resolved && result.primaryIntent) {
      // 확정 → 바로 dry-run
      setSelectedIntent(result.primaryIntent);
      if (dryRunContext) {
        const prop = buildProposal(result.primaryIntent, dryRunContext);
        setProposal(prop);
        setPhase("proposal");
      } else {
        setPhase("proposal");
      }
    } else if (result.candidates.length > 0) {
      setPhase("disambiguation");
    }
  }, [inputValue, context, dryRunContext]);

  // ── Disambiguation card 선택 ──
  const handleSelectCandidate = useCallback((intent: ResolvedActionIntent) => {
    setSelectedIntent(intent);
    if (dryRunContext) {
      const prop = buildProposal(intent, dryRunContext);
      setProposal(prop);
    }
    setPhase("proposal");
  }, [dryRunContext]);

  // ── 빠른 intent 선택 (context 기반 추천) ──
  const handleQuickIntent = useCallback((intentType: GovernedIntentType) => {
    const result = selectIntent(intentType, context);
    setIntentResult(result);
    if (result.resolved && result.primaryIntent) {
      setSelectedIntent(result.primaryIntent);
      if (dryRunContext) {
        const prop = buildProposal(result.primaryIntent, dryRunContext);
        setProposal(prop);
      }
      setPhase("proposal");
    }
  }, [context, dryRunContext]);

  // ── Confirmation 토글 ──
  const toggleConfirmation = useCallback((key: string) => {
    setConfirmations((prev) => ({ ...prev, [key]: !prev[key] }));
    if (proposal) {
      const updated = { ...proposal };
      updated.requiredConfirmations = updated.requiredConfirmations.map((c: ConfirmationItem) =>
        c.key === key ? { ...c, confirmed: !c.confirmed } : c,
      );
      setProposal(updated);
    }
  }, [proposal]);

  // ── 실행 ──
  const handleExecute = useCallback(() => {
    if (!proposal || !canExecuteProposal(proposal)) return;
    setPhase("executing");
    onExecute(proposal);
  }, [proposal, onExecute]);

  // ── 실행 가능 여부 ──
  const isExecutable = proposal ? canExecuteProposal(proposal) : false;
  const hardBlockers = proposal?.blockingReasons.filter((b: ProposalBlocker) => b.severity === "hard") ?? [];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] bg-black/40">
      <div className="w-full max-w-5xl max-h-[88vh] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">

        {/* ═══ Header ═══ */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Zap className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Governed Action Composer</h2>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                {phase === "intent" && "명령 입력"}
                {phase === "disambiguation" && "해석 선택"}
                {phase === "proposal" && "실행 계획 검토"}
                {phase === "executing" && "실행 중..."}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ═══ Body: Center + Rail ═══ */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* ── CENTER (decision) ── */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">

            {/* Intent 입력 */}
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleIntentSubmit(); }}
                  placeholder="명령을 입력하세요 (예: 즉시 발송, 승인, 견적 요청 준비...)"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                  disabled={phase === "executing"}
                />
              </div>
              <button
                onClick={handleIntentSubmit}
                disabled={!inputValue.trim() || phase === "executing"}
                className="px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                해석
              </button>
            </div>

            {/* Context 기반 빠른 액션 (intent phase일 때) */}
            {phase === "intent" && availableIntents.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">현재 작업면에서 가능한 액션</p>
                <div className="flex flex-wrap gap-1.5">
                  {availableIntents.slice(0, 6).map((m) => (
                    <button
                      key={m.intentType}
                      onClick={() => handleQuickIntent(m.intentType as GovernedIntentType)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors"
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 해석 실패 */}
            {intentResult && !intentResult.resolved && intentResult.candidates.length === 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  <p className="text-sm text-amber-700">{intentResult.failureReason}</p>
                </div>
              </div>
            )}

            {/* ═══ Disambiguation Phase ═══ */}
            {phase === "disambiguation" && intentResult && intentResult.candidates.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">여러 해석이 가능합니다. 원하는 작업을 선택하세요:</p>
                <div className="space-y-2">
                  {intentResult.candidates.map((candidate) => (
                    <button
                      key={candidate.intentId}
                      onClick={() => handleSelectCandidate(candidate)}
                      className="w-full text-left rounded-lg border border-slate-200 bg-white p-3.5 hover:bg-blue-50 hover:border-blue-200 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-semibold text-slate-800 group-hover:text-blue-700">{candidate.displayLabel}</span>
                          <RiskBadge level={candidate.riskLevel} />
                          {candidate.irreversible && (
                            <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">비가역</span>
                          )}
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-blue-400" />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{candidate.displayDescription}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">신뢰도 {Math.round(candidate.confidence * 100)}%</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ Proposal Phase — Center ═══ */}
            {phase === "proposal" && proposal && (
              <div className="space-y-4">
                {/* Action Label + Risk */}
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base font-bold text-slate-800">{proposal.actionLabel}</h3>
                  <RiskBadge level={proposal.riskLevel} />
                  {proposal.irreversible && (
                    <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">비가역</span>
                  )}
                </div>

                {/* Blast Radius */}
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">영향 범위</p>
                  <p className="text-sm text-slate-600 font-medium">{proposal.blastRadiusSummary}</p>
                  {proposal.affectedRecords.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {proposal.affectedRecords.map((r, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <FileText className="h-3 w-3 text-slate-400" />
                            <span className="text-slate-600">{r.displayLabel}</span>
                            <span className="text-slate-400">({r.entityType})</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400">{r.currentStatus}</span>
                            <ArrowRight className="h-2.5 w-2.5 text-slate-300" />
                            <span className="font-semibold text-slate-600">{r.projectedStatus}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {proposal.willMutateSupplierFacingState && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                      <AlertTriangle className="h-3 w-3" />
                      공급사에게 보이는 상태가 변경됩니다
                    </div>
                  )}
                </div>

                {/* Blockers */}
                {hardBlockers.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50/50 p-3.5">
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <Lock className="h-3 w-3" />
                      실행 차단 ({hardBlockers.length}건)
                    </p>
                    <div className="space-y-2">
                      {hardBlockers.map((b, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm text-red-700">{b.message}</p>
                            <p className="text-xs text-red-500 mt-0.5">{b.remediation}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Execution Plan */}
                <div className="rounded-lg border border-slate-200 p-3.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">실행 계획</p>
                  <div className="space-y-2">
                    {proposal.executionPlanSteps.map((step) => (
                      <div key={step.order} className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold flex items-center justify-center shrink-0">{step.order}</span>
                        <span className="text-sm text-slate-600">{step.description}</span>
                        {step.isSupplierFacing && (
                          <span className="text-[10px] text-amber-500 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 shrink-0">공급사</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Confirmations */}
                {proposal.requiredConfirmations.length > 0 && proposal.canExecute && (
                  <div className="rounded-lg border border-slate-200 p-3.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">필수 확인 항목</p>
                    <div className="space-y-2">
                      {proposal.requiredConfirmations.map((c) => (
                        <label key={c.key} className="flex items-start gap-2.5 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={c.confirmed}
                            onChange={() => toggleConfirmation(c.key)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
                          />
                          <span className={`text-sm ${c.confirmed ? "text-slate-500 line-through" : "text-slate-700"} transition-colors`}>
                            {c.label}
                            {c.required && <span className="text-red-400 ml-0.5">*</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Executing */}
            {phase === "executing" && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                <p className="text-sm font-semibold text-slate-600">실행 중...</p>
                <p className="text-xs text-slate-400">governance boundary를 통해 처리됩니다</p>
              </div>
            )}
          </div>

          {/* ── RAIL (context) ── */}
          {phase === "proposal" && proposal && (
            <div className="w-72 border-l border-slate-200 bg-slate-50/30 overflow-y-auto shrink-0">
              <div className="p-4 space-y-3">
                <button
                  onClick={() => setRailExpanded(!railExpanded)}
                  className="flex items-center justify-between w-full"
                >
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">컨텍스트</p>
                  {railExpanded ? <ChevronUp className="h-3 w-3 text-slate-400" /> : <ChevronDown className="h-3 w-3 text-slate-400" />}
                </button>

                {railExpanded && (
                  <div className="space-y-3">
                    {/* 현재 위치 */}
                    {context && (
                      <RailSection title="현재 위치">
                        <p className="text-xs text-slate-500">{context.currentRoute}</p>
                        {context.workbenchStage && (
                          <p className="text-xs text-slate-600 font-medium mt-0.5">{stageLabel(context.workbenchStage)}</p>
                        )}
                      </RailSection>
                    )}

                    {/* 선택된 entity */}
                    {selectedIntent && selectedIntent.targetEntityIds.length > 0 && (
                      <RailSection title="대상">
                        {selectedIntent.targetEntityIds.map((id) => (
                          <div key={id} className="flex items-center gap-1.5">
                            <FileText className="h-3 w-3 text-slate-400" />
                            <span className="text-xs text-slate-600 font-mono">{id}</span>
                          </div>
                        ))}
                      </RailSection>
                    )}

                    {/* Supplier info */}
                    {dryRunContext?.supplierInfo && (
                      <RailSection title="공급사">
                        <p className="text-xs text-slate-600">{dryRunContext.supplierInfo.name}</p>
                      </RailSection>
                    )}

                    {/* Snapshot validity */}
                    <RailSection title="스냅샷 유효성">
                      {Object.entries(dryRunContext?.approvalSnapshotValid ?? {}).map(([id, valid]) => (
                        <div key={id} className="flex items-center gap-1.5 text-xs">
                          {valid
                            ? <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            : <XCircle className="h-3 w-3 text-red-500" />
                          }
                          <span className={valid ? "text-slate-500" : "text-red-600 font-medium"}>{id}</span>
                        </div>
                      ))}
                      {Object.keys(dryRunContext?.approvalSnapshotValid ?? {}).length === 0 && (
                        <p className="text-xs text-slate-400">해당 없음</p>
                      )}
                    </RailSection>

                    {/* Policy / Budget */}
                    <RailSection title="정책 상태">
                      <div className="flex items-center gap-1.5 text-xs">
                        {dryRunContext?.policyHoldActive
                          ? <><Lock className="h-3 w-3 text-red-500" /><span className="text-red-600">정책 보류 활성</span></>
                          : <><Unlock className="h-3 w-3 text-emerald-500" /><span className="text-slate-500">정상</span></>
                        }
                      </div>
                      {dryRunContext?.availableBudget !== null && dryRunContext?.availableBudget !== undefined && (
                        <p className="text-xs text-slate-500 mt-1">
                          가용 예산: ₩{formatKoreanNumber(dryRunContext.availableBudget)}
                        </p>
                      )}
                    </RailSection>

                    {/* Reopen 경로 */}
                    {proposal.reopenRequired && (
                      <RailSection title="재개 경로 필요">
                        <div className="flex items-center gap-1.5 text-xs text-amber-600">
                          <RotateCcw className="h-3 w-3" />
                          <span>{proposal.reopenRequired.reason}</span>
                        </div>
                      </RailSection>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ═══ DOCK (execution) ═══ */}
        {phase === "proposal" && proposal && (
          <div className="shrink-0 px-5 py-3.5 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* 안전 취소 */}
              <button
                onClick={onClose}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-100 transition-colors"
              >
                취소
              </button>
              {/* 교정 요청 */}
              {(selectedIntent?.intentType === "dispatch_now" || selectedIntent?.intentType === "schedule_dispatch") && (
                <button
                  onClick={() => handleQuickIntent("request_correction")}
                  className="px-3 py-2 rounded-lg border border-amber-200 text-sm text-amber-600 hover:bg-amber-50 transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  교정 요청
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* 발송 예약 (dispatch 관련 intent일 때) */}
              {selectedIntent?.intentType === "dispatch_now" && (
                <button
                  onClick={() => handleQuickIntent("schedule_dispatch")}
                  disabled={hardBlockers.length > 0}
                  className="px-4 py-2 rounded-lg border border-blue-200 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  예약 발송
                </button>
              )}

              {/* 실행 */}
              <button
                onClick={handleExecute}
                disabled={!isExecutable}
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-1.5 ${
                  isExecutable
                    ? proposal.irreversible
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                {hardBlockers.length > 0 ? (
                  <><Lock className="h-3.5 w-3.5" /> 실행 차단</>
                ) : proposal.irreversible ? (
                  <><Send className="h-3.5 w-3.5" /> 실행 (비가역)</>
                ) : (
                  <><Send className="h-3.5 w-3.5" /> 실행</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════════

function RiskBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    immediate: "bg-slate-100 text-slate-500 border-slate-200",
    reviewed: "bg-blue-50 text-blue-600 border-blue-200",
    governed: "bg-amber-50 text-amber-600 border-amber-200",
    irreversible: "bg-red-50 text-red-600 border-red-200",
  };
  const labels: Record<string, string> = {
    immediate: "즉시",
    reviewed: "검토",
    governed: "통제",
    irreversible: "비가역",
  };
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${styles[level] ?? styles.reviewed}`}>
      {labels[level] ?? level}
    </span>
  );
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-white border border-slate-200 p-2.5">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function stageLabel(stage: string): string {
  const map: Record<string, string> = {
    quote_comparison: "견적 비교",
    approval_pending: "승인 대기",
    po_conversion: "PO 전환",
    po_created: "PO 생성 완료",
    dispatch_preparation: "발송 준비",
    dispatch_execution: "발송 실행",
    receiving: "수령",
    stock_management: "재고 관리",
  };
  return map[stage] ?? stage;
}

function formatKoreanNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}
