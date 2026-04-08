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
  type ExecutionPlan,
  type ExecutionStep,
} from "@/lib/ontology";
import {
  createGovernanceEvent,
  getGlobalGovernanceEventBus,
} from "@/lib/ai/governance-event-bus";

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
  const inputRef = useRef<HTMLInputElement | null>(null);

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
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const next = await buildExecutionPlan(trimmed);
      setPlan(next);
      setAcknowledged(new Set());
      if (next.steps.length === 0) {
        setNotice("해석 가능한 action이 없습니다. 더 구체적으로 적어주세요.");
      }
    } catch (err) {
      setNotice(`파싱 실패: ${(err as Error).message ?? "unknown"}`);
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

  // ── Precondition gate ───────────────────────────────────────────
  const blockers = useMemo<string[]>(() => {
    if (!plan) return ["자연어 명령을 먼저 해석하세요"];
    const out: string[] = [];
    if (plan.steps.length === 0) out.push("실행 가능한 단계 없음");
    if (plan.totalTargetCount === 0) out.push("대상 객체 없음");
    if (plan.confidence < 0.7) out.push("파싱 신뢰도 낮음 (0.7 미만)");
    // confirmationRequired 각 항목이 모두 ack 되어야 한다.
    const unackCount = plan.confirmationRequired.filter((_, idx) => !acknowledged.has(idx)).length;
    if (unackCount > 0) out.push(`확인 항목 ${unackCount}건 미체크`);
    return out;
  }, [plan, acknowledged]);

  const canExecute = blockers.length === 0;

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
              Ontology Command
            </DialogTitle>
            <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">⌘K · one-shot</span>
          </div>
          <DialogDescription className="text-xs text-slate-400 mt-1">
            자연어로 명령해 보세요. 파싱 결과가 확인 카드로 보이고, 확인 후에만 실행됩니다.
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
              placeholder="예: 승인 대기 중인 10만원 이하 주문 모두 승인해줘"
              className="flex-1 bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-600"
              aria-label="Ontology natural language command input"
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
