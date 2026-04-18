"use client";

/**
 * OntologyCommandOverlay — ⌘K / Ctrl+K global ontology command layer.
 *
 * 설계 원칙 (CLAUDE.md governance grammar):
 * - workbench(center/rail/dock) 밖에서만 동작하는 단일 overlay. center/rail 침범 금지.
 * - AI/chatbot UI 아님. one-shot: 입력 → parse → confirmation card → execute.
 * - canonical truth를 직접 변경하지 않는다. 실행 시 governance event만 publish
 *   (각 domain store가 이미 가진 subscribe/targeted invalidation에 편승).
 * - dead button 금지: precondition이 열리지 않으면 [확인 실행]은 disabled.
 * - IMMUTABLE Action Ledger: append-only in-memory log (session scope).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  buildExecutionPlan,
  setNLLocalOrderProvider,
  type ExecutionPlan,
  type ExecutionStep,
} from "@/lib/ontology";
import {
  createGovernanceEvent,
  getGlobalGovernanceEventBus,
} from "@/lib/ai/governance-event-bus";
import { useOrderQueueStore } from "@/lib/store/order-queue-store";

interface LedgerEntry {
  ledgerId: string;
  rawInput: string;
  stepCount: number;
  totalTargets: number;
  confidence: number;
  mode: "execute" | "dry_run";
  executedAt: string;
}

const LEDGER_LIMIT = 8;
const PREVIEW_ROW_LIMIT = 5;
const FALLBACK_MESSAGE =
  "자연어를 이해하지 못했습니다. 예: '10만원 미만 승인 대기건 찾아줘' 처럼 다시 입력해 보세요.";

function formatConfidence(conf: number): string {
  if (!conf) return "—";
  return `${Math.round(conf * 100)}%`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function stepLabelPrefix(step: ExecutionStep): string {
  return `#${step.order}`;
}

export function OntologyCommandOverlay() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<ExecutionPlan | null>(null);
  const [acknowledged, setAcknowledged] = useState<Set<number>>(new Set());
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewReviewed, setPreviewReviewed] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // ── Local canonical snapshot provider 주입 ─────────────────────
  // Supabase가 비어 있는 환경에서도 파싱/미리보기가 동작하도록
  // order-queue-store를 NL resolver에 fallback으로 연결한다.
  useEffect(() => {
    setNLLocalOrderProvider(() => {
      const orders = useOrderQueueStore.getState().orders;
      return orders.map((o) => ({
        id: o.id,
        status: o.status,
        totalAmount: o.totalAmount,
      }));
    });
    return () => setNLLocalOrderProvider(null);
  }, []);

  // ── Global hotkey ⌘K / Ctrl+K ───────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isToggle = (e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K");
      if (isToggle) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Focus input when opened & reset transient state ─────────────
  useEffect(() => {
    if (!open) {
      setPlan(null);
      setAcknowledged(new Set());
      setNotice(null);
      setPreviewReviewed(false);
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [open]);

  // ── Parse current input into execution plan ─────────────────────
  const handleParse = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      setPlan(null);
      setAcknowledged(new Set());
      setPreviewReviewed(false);
      return;
    }
    setLoading(true);
    setNotice(null);
    setPreviewReviewed(false);
    try {
      const next = await buildExecutionPlan(trimmed);
      setPlan(next);
      setAcknowledged(new Set());
      if (next.steps.length === 0 || next.totalTargetCount === 0) {
        // 파싱 자체는 성공했지만 해석된 action/target이 없는 경우도
        // 사용자에게는 동일하게 "이해하지 못했다"고 친절히 표시한다.
        setNotice(FALLBACK_MESSAGE);
      }
    } catch (err) {
      // raw JS error 메시지 노출 금지 — 콘솔에만 남기고 UI에는 fallback 표시
      if (typeof console !== "undefined") {
        console.warn("[ontology-command-overlay] buildExecutionPlan 실패:", err);
      }
      setNotice(FALLBACK_MESSAGE);
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [input]);

  const onInputKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void handleParse();
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    },
    [handleParse],
  );

  // ── Preview: plan의 대상 ID를 로컬 canonical snapshot과 조인하여
  //     사용자가 실제로 무엇이 바뀔지 미리 확인하게 한다 (dry-run gate).
  const ordersById = useOrderQueueStore((s) => s.orders);
  const previewRows = useMemo(() => {
    if (!plan) return [];
    const ids = new Set(plan.steps.flatMap((s) => s.targetIds));
    if (ids.size === 0) return [];
    return ordersById
      .filter((o) => ids.has(o.id))
      .slice(0, PREVIEW_ROW_LIMIT)
      .map((o) => ({
        id: o.id,
        poNumber: o.poNumber,
        productName: o.productName,
        vendorName: o.vendorName,
        totalAmount: o.totalAmount,
        status: o.status,
      }));
  }, [plan, ordersById]);

  const previewMoreCount = useMemo(() => {
    if (!plan) return 0;
    return Math.max(0, plan.totalTargetCount - previewRows.length);
  }, [plan, previewRows.length]);

  // ── Precondition gate ───────────────────────────────────────────
  const blockers = useMemo<string[]>(() => {
    if (!plan) return ["자연어 명령을 먼저 해석하세요"];
    const out: string[] = [];
    if (plan.steps.length === 0) out.push("실행 가능한 단계 없음");
    if (plan.totalTargetCount === 0) out.push("대상 객체 없음");
    if (plan.confidence < 0.7) out.push("파싱 신뢰도 낮음 (0.7 미만)");
    if (!previewReviewed && plan.totalTargetCount > 0) {
      out.push("추천 결과 검토 필요");
    }
    // confirmationRequired 각 항목이 모두 ack 되어야 한다.
    const unackCount = plan.confirmationRequired.filter((_, idx) => !acknowledged.has(idx)).length;
    if (unackCount > 0) out.push(`확인 항목 ${unackCount}건 미체크`);
    return out;
  }, [plan, acknowledged, previewReviewed]);

  const canExecute = blockers.length === 0;

  const recommendationHeadline = useMemo(() => {
    if (!plan || plan.steps.length === 0) return null;
    const primary = plan.steps[0];
    const actionLabelMap: Record<string, string> = {
      APPROVE: "일괄 승인 준비",
      REJECT: "일괄 반려 준비",
      DISPATCH_NOW: "공급사 발송 준비",
      SCHEDULE_DISPATCH: "발송 예약 준비",
      RECEIVE_ORDER: "수령 처리 준비",
      TRIGGER_REORDER: "재주문 준비",
      SEND_VENDOR_EMAIL: "공급사 메일 발송 준비",
      HOLD_FOR_REVIEW: "검토 보류 준비",
      REQUEST_BUDGET_INCREASE: "예산 증액 요청 준비",
      REQUEST_CORRECTION: "수정 요청 준비",
    };
    const verb = actionLabelMap[primary.actionType] ?? "작업 준비";
    return `💡 추천 액션: 조건에 맞는 ${plan.totalTargetCount}건 ${verb}`;
  }, [plan]);

  // ── Execute / dry-run — canonical truth는 직접 변경 X, governance event만 publish ─
  const appendLedger = useCallback((entry: LedgerEntry) => {
    setLedger((prev) => [entry, ...prev].slice(0, LEDGER_LIMIT));
  }, []);

  const handleExecute = useCallback(
    (mode: "execute" | "dry_run") => {
      if (!plan) return;
      if (mode === "execute" && !canExecute) return;

      const bus = getGlobalGovernanceEventBus();
      const evt = createGovernanceEvent(
        "quote_chain",
        mode === "execute" ? "ontology_command_executed" : "ontology_command_dry_run",
        {
          caseId: `ontology-cmd-${Date.now().toString(36)}`,
          poNumber: "",
          fromStatus: "nl_input",
          toStatus: mode === "execute" ? "dispatched" : "planned",
          actor: "ontology_command_overlay",
          detail: plan.rawInput,
          severity: mode === "execute" ? "warning" : "info",
          chainStage: null,
          affectedObjectIds: plan.steps.flatMap((s) => s.targetIds),
          payload: {
            steps: plan.steps.map((s) => ({
              order: s.order,
              actionType: s.actionType,
              label: s.label,
              targetCount: s.targetIds.length,
              includesNotification: s.includesNotification,
            })),
            confidence: plan.confidence,
            mode,
          },
        },
      );
      bus.publish(evt);

      appendLedger({
        ledgerId: evt.eventId,
        rawInput: plan.rawInput,
        stepCount: plan.steps.length,
        totalTargets: plan.totalTargetCount,
        confidence: plan.confidence,
        mode,
        executedAt: evt.timestamp,
      });

      if (mode === "execute") {
        setNotice("실행 이벤트 발행 완료. 대상 surface가 targeted invalidation으로 갱신됩니다.");
        setInput("");
        setPlan(null);
        setAcknowledged(new Set());
        setPreviewReviewed(false);
      } else {
        setNotice("dry-run: 실제 변경 없이 plan만 기록했습니다.");
      }
    },
    [plan, canExecute, appendLedger],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl bg-slate-950 text-slate-100 border-slate-800 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-slate-800">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-sm font-semibold tracking-wide text-slate-100">
              Ontology 검색
            </DialogTitle>
            <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">⌘K · search</span>
          </div>
          <DialogDescription className="text-xs text-slate-400 mt-1">
            조건으로 대기 건을 검색하고 미리보기 합니다. AI의 선제 제안은 화면 상단에 자동으로 뜨니, 여기서는 직접 찾고 싶을 때만 사용하세요.
          </DialogDescription>
        </DialogHeader>

        {/* ── Input row (center of overlay) ───────────────────── */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onInputKey}
              placeholder="예: 10만원 이하 승인 대기건 찾기"
              className="flex-1 bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-600"
              aria-label="Ontology 조건 검색 입력"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleParse}
              disabled={loading || !input.trim()}
              className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            >
              {loading ? "해석중…" : "해석"}
            </Button>
          </div>
          {notice && (
            <p className="mt-2 text-[11px] text-amber-300/90">{notice}</p>
          )}
        </div>

        {/* ── Recommendation headline + preview (decision dry-run) ───────────── */}
        {plan && plan.steps.length > 0 && plan.totalTargetCount > 0 && (
          <div className="px-5 pb-3">
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
              <div className="text-[12px] font-medium text-amber-200">
                {recommendationHeadline}
              </div>
              {previewRows.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {previewRows.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center justify-between gap-3 text-[11px] text-slate-200"
                    >
                      <span className="truncate">
                        <span className="text-slate-400 font-mono mr-1">{row.poNumber}</span>
                        {row.productName}
                        <span className="text-slate-500"> · {row.vendorName}</span>
                      </span>
                      <span className="text-slate-300 font-mono shrink-0">
                        {row.totalAmount.toLocaleString()}원
                      </span>
                    </li>
                  ))}
                  {previewMoreCount > 0 && (
                    <li className="text-[10px] text-slate-400">
                      … 외 {previewMoreCount}건
                    </li>
                  )}
                </ul>
              ) : (
                <p className="mt-2 text-[11px] text-slate-400">
                  대상 ID는 있지만 현재 로컬 주문 목록과 매칭되는 행이 없습니다.
                </p>
              )}
              <div className="mt-3 flex items-center gap-2">
                <input
                  id="ontology-preview-ack"
                  type="checkbox"
                  checked={previewReviewed}
                  onChange={(e) => setPreviewReviewed(e.target.checked)}
                  className="accent-amber-400"
                />
                <label
                  htmlFor="ontology-preview-ack"
                  className="text-[11px] text-amber-100 cursor-pointer select-none"
                >
                  위 추천 결과를 확인했습니다
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ── Parsed Plan card (decision) ───────────────────── */}
        {plan && plan.steps.length > 0 && (
          <div className="px-5 pb-3">
            <div className="rounded-md border border-slate-800 bg-slate-900/60">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
                <span className="text-[11px] uppercase tracking-wider text-slate-400">Parsed Plan</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-slate-700 text-slate-300 text-[10px]">
                    conf {formatConfidence(plan.confidence)}
                  </Badge>
                  <Badge variant="outline" className="border-slate-700 text-slate-300 text-[10px]">
                    targets {plan.totalTargetCount}
                  </Badge>
                </div>
              </div>
              <ul className="divide-y divide-slate-800">
                {plan.steps.map((step) => (
                  <li key={step.order} className="px-3 py-2 flex items-start gap-2 text-xs">
                    <span className="text-slate-500 font-mono">{stepLabelPrefix(step)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-100 font-medium truncate">{step.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {step.actionType} · targets {step.targetIds.length}
                        {step.includesNotification ? " · +notify" : ""}
                        {step.dependsOnPrevious ? " · depends prev" : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ── Preconditions / confirmations (context rail-role) ─ */}
        {plan && (plan.confirmationRequired.length > 0 || blockers.length > 0) && (
          <div className="px-5 pb-3">
            <div className="rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">
                Preconditions
              </div>
              {plan.confirmationRequired.length > 0 && (
                <ul className="space-y-1 mb-2">
                  {plan.confirmationRequired.map((msg, idx) => {
                    const checked = acknowledged.has(idx);
                    return (
                      <li key={idx} className="flex items-start gap-2 text-[11px]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = new Set(acknowledged);
                            if (e.target.checked) next.add(idx);
                            else next.delete(idx);
                            setAcknowledged(next);
                          }}
                          className="mt-0.5 accent-amber-400"
                          aria-label={`confirm ${idx}`}
                        />
                        <span className={checked ? "text-slate-300" : "text-amber-300/90"}>
                          {msg}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {blockers.length > 0 && (
                <div className="text-[10px] text-rose-300/90">
                  blocked: {blockers.join(" · ")}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Dock (action) ───────────────────────────────────── */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-slate-800 bg-slate-950">
          <span className="text-[10px] text-slate-500 font-mono">
            append-only ledger · session scope
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
            >
              취소
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExecute("dry_run")}
              disabled={!plan || plan.steps.length === 0}
              className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            >
              dry-run
            </Button>
            <Button
              size="sm"
              onClick={() => handleExecute("execute")}
              disabled={!canExecute}
              className="bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-40 disabled:bg-slate-700 disabled:text-slate-400"
            >
              확인 실행
            </Button>
          </div>
        </div>

        {/* ── Recent ledger (append-only) ─────────────────────── */}
        {ledger.length > 0 && (
          <div className="px-5 pb-5 pt-2 border-t border-slate-800 bg-slate-950/80">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
              Recent (session)
            </div>
            <ul className="space-y-1">
              {ledger.map((entry) => (
                <li
                  key={entry.ledgerId}
                  className="flex items-center justify-between gap-2 text-[10px] text-slate-400 font-mono"
                >
                  <span className="truncate">
                    [{formatTime(entry.executedAt)}] {entry.mode === "execute" ? "EXEC" : "DRY "} · {entry.stepCount} step · tgt {entry.totalTargets} · {formatConfidence(entry.confidence)}
                  </span>
                  <span className="text-slate-600 truncate max-w-[220px]">{entry.rawInput}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
