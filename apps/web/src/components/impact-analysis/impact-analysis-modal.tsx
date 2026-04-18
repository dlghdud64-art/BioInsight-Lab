"use client";

/**
 * ImpactAnalysisModal — What-if simulation modal (발주 승인 전)
 *
 * 트리거: 발주 대기열의 액션 버튼 (예: "PO 생성" / "승인")
 * 흐름:
 *   1. 모달 open → /api/ai/impact-analysis 호출
 *   2. recharts BarChart로 예산 Before/After 시각화
 *   3. Gemini(또는 local fallback) 텍스트 리포트 렌더링
 *   4. [최종 승인] 클릭 시에만 onConfirm 호출 (canonical mutation은 caller에 위임)
 *
 * 본 컴포넌트는 자체 mutation을 절대 일으키지 않는다.
 * canonical truth(예산/재고 store)는 caller가 onConfirm 안에서만 변경한다.
 */

import { csrfFetch } from "@/lib/api-client";
import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, AlertTriangle, ShieldCheck, ShieldAlert } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ImpactAnalysisInput,
  ImpactAnalysisSimulation,
} from "@/lib/ai/impact-analysis-engine";

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

export interface ImpactAnalysisAPIResult {
  simulation: ImpactAnalysisSimulation;
  report: {
    budgetImpactReport: string;
    inventoryImpactReport: string;
    recommendation: string;
    severity: "ok" | "review" | "blocked";
  };
  source: "gemini" | "local";
}

export interface ImpactAnalysisModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 분석에 필요한 입력 — open=true가 되면 fetch */
  input: ImpactAnalysisInput | null;
  /** 최종 승인 시 호출 — canonical mutation은 여기서만 */
  onConfirm: (result: ImpactAnalysisAPIResult) => void | Promise<void>;
  /**
   * 배치 5: severity=blocked 회수 경로.
   * 교정 요청 (공급사/라인/문서 수정 후 재시뮬레이션).
   * 지정되지 않으면 버튼이 노출되지 않는다 (dead button 방지).
   */
  onRequestCorrection?: (result: ImpactAnalysisAPIResult) => void | Promise<void>;
  /**
   * 배치 5: severity=blocked 회수 경로.
   * PO conversion 단계로 되돌린다 (승인 전 단계 복귀).
   * 지정되지 않으면 버튼이 노출되지 않는다.
   */
  onReopenConversion?: (result: ImpactAnalysisAPIResult) => void | Promise<void>;
  /** 헤더에 노출할 보조 라벨 (선택) */
  headerHint?: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════════════════

export function ImpactAnalysisModal({
  open,
  onOpenChange,
  input,
  onConfirm,
  onRequestCorrection,
  onReopenConversion,
  headerHint,
}: ImpactAnalysisModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ImpactAnalysisAPIResult | null>(null);
  const [confirming, setConfirming] = React.useState(false);

  // open=true가 되면 fetch
  React.useEffect(() => {
    if (!open || !input) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);
    csrfFetch("/api/ai/impact-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("API 호출 실패");
        const json = await res.json();
        if (!json.success) throw new Error(json.error ?? "분석 실패");
        if (!cancelled) setResult(json.data as ImpactAnalysisAPIResult);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "알 수 없는 오류");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, input]);

  const handleClose = (next: boolean) => {
    if (confirming) return;
    onOpenChange(next);
    if (!next) {
      setResult(null);
      setError(null);
    }
  };

  const handleConfirm = async () => {
    if (!result) return;
    setConfirming(true);
    try {
      await onConfirm(result);
      onOpenChange(false);
      setResult(null);
    } finally {
      setConfirming(false);
    }
  };

  // 배치 5: 회수 경로 핸들러
  const handleRequestCorrection = async () => {
    if (!result || !onRequestCorrection) return;
    setConfirming(true);
    try {
      await onRequestCorrection(result);
      onOpenChange(false);
      setResult(null);
    } finally {
      setConfirming(false);
    }
  };

  const handleReopenConversion = async () => {
    if (!result || !onReopenConversion) return;
    setConfirming(true);
    try {
      await onReopenConversion(result);
      onOpenChange(false);
      setResult(null);
    } finally {
      setConfirming(false);
    }
  };

  const severity = result?.report.severity ?? "ok";
  const blocked = severity === "blocked";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            발주 영향 분석 (What-if)
            {headerHint && (
              <span className="text-xs font-normal text-slate-500">— {headerHint}</span>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            승인 전 예산·재고에 미치는 영향을 시뮬레이션합니다. 최종 승인을 눌러야만 상태가 전이됩니다.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin mb-2" />
            <span className="text-xs">예산·재고 시뮬레이션 수행 중…</span>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
            <div className="flex items-center gap-2 font-medium mb-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              분석 실패
            </div>
            <p>{error}</p>
          </div>
        )}

        {result && !loading && (
          <div className="space-y-4">
            {/* Severity badge */}
            <div
              className={cn(
                "rounded-md border px-4 py-2.5 text-xs flex items-center gap-2",
                severity === "blocked"
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : severity === "review"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
              )}
            >
              {severity === "ok" ? (
                <ShieldCheck className="h-3.5 w-3.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              <span className="font-medium flex-1">
                {result.simulation.summary.headline}
              </span>
              {/* 배치 6: 분석 소스 배지 — gemini=AI, local=결정론적 fallback */}
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded border font-mono",
                  result.source === "gemini"
                    ? "border-violet-400/40 bg-violet-500/10 text-violet-300"
                    : "border-slate-400/40 bg-slate-500/10 text-slate-300",
                )}
                title={
                  result.source === "gemini"
                    ? "Gemini 2.5-flash 자연어 리스크 평가"
                    : "로컬 결정론적 엔진 (API 키 미설정 또는 호출 실패)"
                }
              >
                {result.source === "gemini" ? "AI 분석" : "로컬 엔진"}
              </span>
            </div>

            {/* 예산 Before/After Bar Chart */}
            {result.simulation.budget && (
              <div className="rounded-md border border-slate-200 bg-white p-4">
                <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">
                  예산 영향 (Before / After)
                </h4>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={buildChartData(result.simulation)}
                      margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        stroke="#94a3b8"
                        tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`}
                      />
                      <Tooltip
                        formatter={(v: number) => `₩${v.toLocaleString("ko-KR")}`}
                        contentStyle={{ fontSize: 11 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="가용예산" name="가용 예산" radius={[4, 4, 0, 0]}>
                        {buildChartData(result.simulation).map((entry, idx) => (
                          <Cell
                            key={idx}
                            fill={entry.name === "After" ? "#f59e0b" : "#10b981"}
                          />
                        ))}
                      </Bar>
                      <Bar
                        dataKey="소진금액"
                        name="소진/약정"
                        fill="#94a3b8"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-[11px]">
                  <div className="rounded bg-slate-50 px-2 py-1.5">
                    <span className="text-slate-500">가용 변화</span>
                    <p className="text-slate-900 font-medium tabular-nums">
                      {formatKRW(result.simulation.budget.availableDelta)}
                    </p>
                  </div>
                  <div className="rounded bg-slate-50 px-2 py-1.5">
                    <span className="text-slate-500">소진율</span>
                    <p className="text-slate-900 font-medium tabular-nums">
                      {result.simulation.budget.before.utilizationPercent}% →{" "}
                      {result.simulation.budget.after.utilizationPercent}%
                    </p>
                  </div>
                  <div className="rounded bg-slate-50 px-2 py-1.5">
                    <span className="text-slate-500">고갈 앞당김</span>
                    <p className="text-slate-900 font-medium tabular-nums">
                      {result.simulation.budget.depletionAdvancedDays}일
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* AI 리포트 */}
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-2">
              <h4 className="text-xs font-medium uppercase tracking-wider text-slate-500">
                AI 리스크 리포트
              </h4>
              <div className="text-xs text-slate-700 leading-relaxed">
                <p className="mb-1.5">
                  <span className="font-medium text-slate-900">예산:</span>{" "}
                  {result.report.budgetImpactReport}
                </p>
                <p className="mb-1.5">
                  <span className="font-medium text-slate-900">재고:</span>{" "}
                  {result.report.inventoryImpactReport}
                </p>
                <p className="mt-2 pt-2 border-t border-slate-200">
                  <span className="font-medium text-slate-900">권고:</span>{" "}
                  {result.report.recommendation}
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 flex-wrap sm:flex-nowrap">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={confirming}
          >
            취소
          </Button>

          {/* 배치 5: blocked 회수 경로 — 실제 핸들러가 주입된 경우에만 노출 */}
          {blocked && onRequestCorrection && (
            <Button
              type="button"
              variant="outline"
              onClick={handleRequestCorrection}
              disabled={!result || loading || confirming}
              className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
            >
              교정 요청
            </Button>
          )}
          {blocked && onReopenConversion && (
            <Button
              type="button"
              variant="outline"
              onClick={handleReopenConversion}
              disabled={!result || loading || confirming}
              className="border-slate-500/40 text-slate-300 hover:bg-slate-500/10"
            >
              PO 전환 재개
            </Button>
          )}

          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!result || loading || confirming || blocked}
            className={cn(
              blocked
                ? "bg-slate-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 text-white",
            )}
          >
            {confirming ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                처리 중…
              </>
            ) : blocked ? (
              "차단됨"
            ) : (
              "최종 승인"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════════

function buildChartData(sim: ImpactAnalysisSimulation) {
  const b = sim.budget;
  if (!b) return [];
  return [
    {
      name: "Before",
      가용예산: b.before.available,
      소진금액: b.before.spent + b.before.committed,
    },
    {
      name: "After",
      가용예산: b.after.available,
      소진금액: b.after.spent + b.after.committed,
    },
  ];
}

function formatKRW(value: number): string {
  const sign = value < 0 ? "-" : value > 0 ? "+" : "";
  return `${sign}₩${Math.abs(value).toLocaleString("ko-KR")}`;
}
