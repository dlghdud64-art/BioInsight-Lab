"use client";

/**
 * GraduationWorkbench — Batch 20
 *
 * pilot 완료 판정 → graduation 경로 결정 → GA / expand / rollback UI.
 *
 * center = verdict + path + metrics + criteria snapshot
 * rail   = evidence + criteria detail + remediation
 * dock   = mark completed / expand / approve GA / rollback / cancel / export
 */

import React, { useState, useCallback } from "react";
import type {
  PilotCompletionEvaluation,
  PilotCompletionVerdict,
  GraduationDecision,
  GraduationPath,
  PilotMetrics,
  GraduationSurface,
  RestartAssessment,
} from "@/lib/ai/pilot-graduation-engine";
import { buildGraduationSurface } from "@/lib/ai/pilot-graduation-engine";
import {
  VERDICT_LABEL_GRAMMAR,
  GRADUATION_PATH_GRAMMAR,
  getVerdictLabel,
  getGraduationPathLabel,
} from "@/lib/ai/governance-grammar-registry";

// ── Verdict display mapping (label from registry, color local) ──
const VERDICT_COLOR: Record<PilotCompletionVerdict, string> = {
  completed_successfully: "text-green-700 bg-green-50 border-green-200",
  completed_conditionally: "text-amber-700 bg-amber-50 border-amber-200",
  rollback_required: "text-red-700 bg-red-50 border-red-200",
  cancelled: "text-gray-700 bg-gray-50 border-gray-200",
  insufficient_evidence: "text-blue-700 bg-blue-50 border-blue-200",
};

const PATH_COLOR: Record<GraduationPath, string> = {
  remain_internal_only: "text-gray-700",
  expand_pilot: "text-blue-700",
  ready_for_ga: "text-green-700",
  rollback_and_reassess: "text-red-700",
};

interface Props {
  completion: PilotCompletionEvaluation;
  graduation: GraduationDecision;
  metrics: PilotMetrics;
  restartAssessment: RestartAssessment | null;
  onAction: (actionKey: string) => void;
}

export default function GraduationWorkbench({
  completion,
  graduation,
  metrics,
  restartAssessment,
  onAction,
}: Props) {
  const [confirmingAction, setConfirmingAction] = useState<string | null>(null);

  const surface = buildGraduationSurface(completion, graduation, metrics, restartAssessment);

  const handleAction = useCallback((actionKey: string, requiresConfirmation: boolean) => {
    if (requiresConfirmation) {
      setConfirmingAction(actionKey);
    } else {
      onAction(actionKey);
    }
  }, [onAction]);

  const confirmAction = useCallback(() => {
    if (confirmingAction) {
      onAction(confirmingAction);
      setConfirmingAction(null);
    }
  }, [confirmingAction, onAction]);

  const verdictLabel = getVerdictLabel(surface.center.completionVerdict);
  const verdictColor = VERDICT_COLOR[surface.center.completionVerdict];
  const pathLabel = getGraduationPathLabel(surface.center.graduationPath);
  const pathColor = PATH_COLOR[surface.center.graduationPath];

  const [railOpen, setRailOpen] = React.useState(false);

  return (
    <div className="flex flex-col pb-20 md:pb-0 h-full">
      {/* ── Center + Rail ── */}
      <div className="flex flex-col md:flex-row md:flex-1 md:min-h-0">
        {/* Center */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4">
          {/* Verdict Header */}
          <div className={`border rounded-lg p-4 ${verdictColor}`}>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium opacity-75">파일럿 판정</span>
                <h2 className="text-xl font-bold">{verdictLabel}</h2>
              </div>
              <div className="text-right">
                <span className="text-sm opacity-75">졸업 경로</span>
                <p className={`text-lg font-semibold ${pathColor}`}>{pathLabel}</p>
                <span className="text-xs opacity-60">신뢰도: {surface.center.confidence}</span>
              </div>
            </div>
          </div>

          {/* Criteria Snapshot */}
          <div className="border rounded-lg p-3">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">완료 기준 현황</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-gray-50 rounded p-2">
                <span className="text-gray-500">필수 충족</span>
                <p className="font-semibold">
                  {surface.center.criteriaSnapshot.requiredMet} / {surface.center.criteriaSnapshot.requiredTotal}
                </p>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <span className="text-gray-500">권장 충족</span>
                <p className="font-semibold">
                  {surface.center.criteriaSnapshot.recommendedMet} / {surface.center.criteriaSnapshot.recommendedTotal}
                </p>
              </div>
            </div>
          </div>

          {/* Metrics Summary */}
          <div className="border rounded-lg p-3">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">핵심 지표</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
              <div className="bg-gray-50 rounded p-2">
                <span className="text-gray-500">PO 처리</span>
                <p className="font-semibold">{surface.center.metricsSummary.poProcessed} / {surface.center.metricsSummary.poLimit}</p>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <span className="text-gray-500">체인 완료율</span>
                <p className="font-semibold">{surface.center.metricsSummary.chainCompletionRate}</p>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <span className="text-gray-500">컴플라이언스</span>
                <p className="font-semibold">{surface.center.metricsSummary.complianceRate}</p>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <span className="text-gray-500">블로커율</span>
                <p className="font-semibold">{surface.center.metricsSummary.blockerIncidenceRate}</p>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <span className="text-gray-500">런타임 평균</span>
                <p className="font-semibold">{surface.center.metricsSummary.runtimeSignalAvg}</p>
              </div>
            </div>
          </div>

          {/* Supporting / Risk Factors */}
          {surface.center.supportingFactors.length > 0 && (
            <div className="border border-green-200 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-green-700 mb-1">긍정 요소</h3>
              <ul className="text-sm text-green-600 space-y-0.5">
                {surface.center.supportingFactors.map((f, i) => (
                  <li key={i}>• {f}</li>
                ))}
              </ul>
            </div>
          )}

          {surface.center.riskFactors.length > 0 && (
            <div className="border border-red-200 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-red-700 mb-1">리스크 요소</h3>
              <ul className="text-sm text-red-600 space-y-0.5">
                {surface.center.riskFactors.map((f, i) => (
                  <li key={i}>• {f}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Conditions */}
          {surface.center.conditions.length > 0 && (
            <div className="border border-amber-200 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-amber-700 mb-1">조건 / 후속 조치</h3>
              <ul className="text-sm text-amber-600 space-y-0.5">
                {surface.center.conditions.map((c, i) => (
                  <li key={i}>• {c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Blocking reasons */}
          {surface.center.blockingReasons.length > 0 && (
            <div className="border border-red-300 bg-red-50 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-red-800 mb-1">차단 사유</h3>
              <ul className="text-sm text-red-700 space-y-0.5">
                {surface.center.blockingReasons.map((r, i) => (
                  <li key={i}>• {r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Rail */}
        <div className="mt-3 md:mt-0 md:w-64 lg:w-72 shrink-0">
          <button
            className="flex items-center justify-between w-full py-2 text-xs text-slate-500 md:hidden"
            onClick={() => setRailOpen(!railOpen)}
          >
            참고 정보 {railOpen ? "▲" : "▼"}
          </button>
          {railOpen && (
            <div className="md:block overflow-y-auto p-3 space-y-3 bg-gray-50">
          {/* Evidence Summary */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Evidence</h4>
            <ul className="text-xs text-gray-600 space-y-0.5">
              {surface.rail.evidenceSummary.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>

          {/* Criteria Detail */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">완료 기준 상세</h4>
            <div className="space-y-1">
              {surface.rail.criteriaDetails.map(c => (
                <div
                  key={c.id}
                  className={`text-xs p-1.5 rounded ${c.met ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
                >
                  <div className="flex justify-between">
                    <span className="font-medium">{c.name}</span>
                    <span>{c.met ? "충족" : "미충족"}</span>
                  </div>
                  <div className="text-[10px] opacity-75">
                    {c.actual} / {c.threshold} ({c.severity === "required" ? "필수" : "권장"})
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Operational Detail */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">운영 상세</h4>
            <div className="text-xs text-gray-600 space-y-0.5">
              <div>Stale: {surface.rail.metricsDetail.staleBlockingFrequency}건</div>
              <div>Reopen: {surface.rail.metricsDetail.reopenCount}건</div>
              <div>Retry: {surface.rail.metricsDetail.retryCount}건</div>
              <div>Rollback trigger: {surface.rail.metricsDetail.rollbackTriggerHitCount}건</div>
              <div>Irreversible 실패: {surface.rail.metricsDetail.irreversibleActionFailureCount}건</div>
              <div>Active actor: {surface.rail.metricsDetail.activeActorCount}명</div>
              <div>Decision log: {surface.rail.metricsDetail.decisionLogVolume}건</div>
            </div>
          </div>

          {/* Remediation (if rollback path) */}
          {surface.rail.remediationItems && surface.rail.remediationItems.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Remediation</h4>
              <div className="space-y-1">
                {surface.rail.remediationItems.map(r => (
                  <div key={r.itemId} className="text-xs p-1.5 bg-white rounded border">
                    <div className="flex justify-between">
                      <span>{r.description}</span>
                      <span className={
                        r.status === "completed" ? "text-green-600" :
                        r.status === "in_progress" ? "text-blue-600" :
                        r.status === "waived" ? "text-gray-400" :
                        "text-amber-600"
                      }>
                        {r.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
            </div>
          )}
        </div>
      </div>

      {/* ── Dock ── */}
      <div className="fixed bottom-0 left-0 right-0 md:static z-30 md:z-auto border-t bg-white px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          {surface.dock.actions.map(action => (
            <button
              key={action.actionKey}
              onClick={() => handleAction(action.actionKey, action.requiresConfirmation)}
              disabled={!action.enabled}
              className={`min-h-[40px] flex-1 md:flex-none px-3 py-1.5 rounded text-sm font-medium transition-colors active:scale-95 ${
                !action.enabled
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : action.actionKey === "approve_ga"
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : action.actionKey === "rollback_and_reassess"
                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                      : action.actionKey === "cancel_pilot"
                        ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        : "bg-blue-100 text-blue-700 hover:bg-blue-200"
              }`}
              title={action.disabledReason ?? undefined}
            >
              {action.label}
            </button>
          ))}
        </div>

        {/* Confirmation Dialog */}
        {confirmingAction && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800 font-medium">
              이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?
            </p>
            <p className="text-xs text-amber-600 mt-1">
              작업: {surface.dock.actions.find(a => a.actionKey === confirmingAction)?.label}
            </p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={confirmAction}
                className="px-3 py-1 bg-amber-600 text-white rounded text-sm hover:bg-amber-700"
              >
                확인
              </button>
              <button
                onClick={() => setConfirmingAction(null)}
                className="px-3 py-1 bg-white border text-gray-600 rounded text-sm hover:bg-gray-50"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
