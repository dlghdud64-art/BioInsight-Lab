"use client";

/**
 * RC0MidpointReviewWorkbench — Batch 21
 *
 * "왜 아직 internal_only인지 + 무엇을 더 보면 expand 가능한지" 단일 화면.
 *
 * center = midpoint verdict + projection + non-compliance + blocker pattern + dwell + action plan
 * rail   = evidence + compliance + blocker distribution + actor concentration + projection assumptions
 * dock   = navigation + export + planning (irreversible 없음)
 */

import React, { useState, useCallback, useMemo } from "react";
import type {
  MidpointVerdict,
  NonComplianceCaseReview,
  SoftBlockerPatternSummary,
  DwellRiskSummary,
  GraduationProjection,
  MidpointActionPlan,
  MidpointReviewSurface,
  MidpointDockAction,
  MidpointHandoffToken,
  RC0MidpointReviewExport,
  RootCauseCategory,
  DwellRiskLevel,
} from "@/lib/ai/rc0-midpoint-review-engine";
import {
  getVerdictLabel,
  getGraduationPathLabel,
} from "@/lib/ai/governance-grammar-registry";

// ── Verdict display ──

const VERDICT_COLOR: Record<MidpointVerdict, string> = {
  stable: "text-green-400",
  stable_but_insufficient_time: "text-amber-400",
  attention_required: "text-orange-400",
  risk_increasing: "text-red-400",
};

const VERDICT_BG: Record<MidpointVerdict, string> = {
  stable: "bg-green-900/30 border-green-700/40",
  stable_but_insufficient_time: "bg-amber-900/30 border-amber-700/40",
  attention_required: "bg-orange-900/30 border-orange-700/40",
  risk_increasing: "bg-red-900/30 border-red-700/40",
};

const VERDICT_DISPLAY: Record<MidpointVerdict, string> = {
  stable: "안정",
  stable_but_insufficient_time: "안정 (시간 부족)",
  attention_required: "주의 필요",
  risk_increasing: "위험 상승",
};

const DWELL_COLOR: Record<DwellRiskLevel, string> = {
  normal: "text-green-400",
  watch: "text-amber-400",
  at_risk: "text-orange-400",
  critical: "text-red-400",
};

const ROOT_CAUSE_LABEL: Record<RootCauseCategory, string> = {
  policy: "정책",
  stale_context: "Stale 컨텍스트",
  handoff: "Handoff",
  compliance_gap: "컴플라이언스 격차",
  operator_error: "운영자 오류",
  data_quality: "데이터 품질",
  unknown: "미식별",
};

// ── Props ──

interface RC0MidpointReviewWorkbenchProps {
  surface: MidpointReviewSurface;
  handoffToken: MidpointHandoffToken;
  exportPack: RC0MidpointReviewExport;
  nonComplianceCases: NonComplianceCaseReview[];
  onDockAction?: (actionKey: string, token: MidpointHandoffToken) => void;
}

// ── Main Component ──

export default function RC0MidpointReviewWorkbench({
  surface,
  handoffToken,
  exportPack,
  nonComplianceCases,
  onDockAction,
}: RC0MidpointReviewWorkbenchProps) {
  const { center, rail, dock } = surface;

  const handleDockAction = useCallback(
    (actionKey: string) => {
      onDockAction?.(actionKey, handoffToken);
    },
    [onDockAction, handoffToken],
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4 min-h-0">
      {/* ═══ Center ═══ */}
      <div className="flex-1 min-w-0 space-y-4 overflow-y-auto">
        {/* Midpoint Verdict Header */}
        <MidpointVerdictHeader verdict={center.midpointVerdict} />

        {/* Projection Comparison */}
        <ProjectionComparison
          currentVerdict={center.currentVerdictLabel}
          currentPath={center.currentPathLabel}
          projectedVerdict={center.projectedVerdictLabel}
          projectedPath={center.projectedPathLabel}
          projectedConfidence={center.projectedConfidence}
          expansionPlausible={center.expansionPlausible}
        />

        {/* Non-compliance Summary */}
        {center.nonComplianceSummary.count > 0 && (
          <NonComplianceSummaryCard
            summary={center.nonComplianceSummary}
            cases={nonComplianceCases}
          />
        )}

        {/* Blocker Pattern Summary */}
        {center.blockerPatternSummary.total > 0 && (
          <BlockerPatternCard summary={center.blockerPatternSummary} />
        )}

        {/* Dwell Risk Table */}
        {center.dwellRiskSummary.total > 0 && (
          <DwellRiskCard summary={center.dwellRiskSummary} />
        )}

        {/* Action Plan */}
        <ActionPlanCard plan={center.actionPlan} />
      </div>

      {/* ═══ Rail ═══ */}
      <div className="w-full lg:w-80 space-y-3 overflow-y-auto">
        {/* Time Window */}
        <RailSection title="시간 경과">
          <div className="text-sm text-slate-600">
            <span>{rail.daysElapsed}일 경과</span>
            <span className="text-slate-500"> / {rail.daysPlanned}일 예정</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            최소 evidence window: {rail.requiredWindow}일
          </div>
        </RailSection>

        {/* Compliance Summary */}
        <RailSection title="컴플라이언스">
          <div className="text-sm text-slate-600 space-y-1">
            <div>준수: {rail.complianceSummary.compliant}건</div>
            <div>조건부: {rail.complianceSummary.conditionallyCompliant}건</div>
            <div>미준수: {rail.complianceSummary.nonCompliant}건</div>
            <div className="text-xs text-slate-400">
              준수율: {rail.complianceSummary.rate}
            </div>
          </div>
        </RailSection>

        {/* Blocker Type Distribution */}
        {Object.keys(rail.blockerTypeDistribution).length > 0 && (
          <RailSection title="블로커 유형 분포">
            <div className="text-sm text-slate-600 space-y-1">
              {Object.entries(rail.blockerTypeDistribution).map(([type, count]) => (
                <div key={type} className="flex justify-between">
                  <span>{type}</span>
                  <span className="text-slate-400">{count}건</span>
                </div>
              ))}
            </div>
          </RailSection>
        )}

        {/* Actor Concentration */}
        {rail.actorConcentrationSummary.length > 0 && (
          <RailSection title="Actor 편중">
            <div className="text-sm text-slate-600 space-y-1">
              {rail.actorConcentrationSummary.map(a => (
                <div key={a.actor} className="flex justify-between">
                  <span>{a.actor}</span>
                  <span className="text-amber-400">{a.share}</span>
                </div>
              ))}
            </div>
          </RailSection>
        )}

        {/* Projection Assumptions */}
        <RailSection title="Projection 가정">
          <ul className="text-xs text-slate-400 space-y-1">
            {rail.projectionAssumptions.map((a, i) => (
              <li key={i}>• {a}</li>
            ))}
          </ul>
        </RailSection>

        {/* Time-resolved vs Persistent Blockers */}
        {(rail.timeResolvedBlockers.length > 0 || rail.persistentBlockers.length > 0) && (
          <RailSection title="Blocker 분류">
            {rail.timeResolvedBlockers.length > 0 && (
              <div className="mb-2">
                <div className="text-xs text-green-400 mb-1">시간 해소 가능:</div>
                {rail.timeResolvedBlockers.map((b, i) => (
                  <div key={i} className="text-xs text-slate-400">• {b}</div>
                ))}
              </div>
            )}
            {rail.persistentBlockers.length > 0 && (
              <div>
                <div className="text-xs text-red-400 mb-1">지속 blocker:</div>
                {rail.persistentBlockers.map((b, i) => (
                  <div key={i} className="text-xs text-slate-400">• {b}</div>
                ))}
              </div>
            )}
          </RailSection>
        )}

        {/* Evidence Links */}
        <RailSection title="Evidence 링크">
          <ul className="text-xs text-blue-400 space-y-1">
            {rail.evidenceLinks.map((link, i) => (
              <li key={i} className="truncate">{link}</li>
            ))}
          </ul>
        </RailSection>
      </div>

      {/* ═══ Dock ═══ */}
      <div className="w-full lg:w-48 space-y-2">
        {dock.actions.map(action => (
          <DockButton
            key={action.actionKey}
            action={action}
            onClick={() => handleDockAction(action.actionKey)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Sub-components ──

function MidpointVerdictHeader({ verdict }: { verdict: MidpointVerdict }) {
  return (
    <div className={`rounded-lg border p-4 ${VERDICT_BG[verdict]}`}>
      <div className="text-xs text-slate-400 mb-1">중간 리뷰 판정</div>
      <div className={`text-xl font-semibold ${VERDICT_COLOR[verdict]}`}>
        {VERDICT_DISPLAY[verdict]}
      </div>
    </div>
  );
}

function ProjectionComparison({
  currentVerdict,
  currentPath,
  projectedVerdict,
  projectedPath,
  projectedConfidence,
  expansionPlausible,
}: {
  currentVerdict: string;
  currentPath: string;
  projectedVerdict: string;
  projectedPath: string;
  projectedConfidence: string;
  expansionPlausible: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-4">
      <div className="text-sm font-medium text-slate-700 mb-3">현재 vs Projection</div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-xs text-slate-400 mb-1">현재</div>
          <div className="text-slate-600">{currentVerdict}</div>
          <div className="text-slate-400 text-xs">{currentPath}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400 mb-1">7일 시점 예상</div>
          <div className="text-slate-700">{projectedVerdict}</div>
          <div className="text-slate-400 text-xs">{projectedPath}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs">
        <span className="text-slate-400">신뢰도: {projectedConfidence}</span>
        {expansionPlausible ? (
          <span className="text-green-400">확장 가능성 있음</span>
        ) : (
          <span className="text-amber-400">확장 조건 미충족</span>
        )}
      </div>
    </div>
  );
}

function NonComplianceSummaryCard({
  summary,
  cases,
}: {
  summary: { count: number; highRepeatRisk: number; topRootCause: RootCauseCategory | null };
  cases: NonComplianceCaseReview[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-red-800/40 bg-red-900/20 p-4">
      <div
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="text-sm font-medium text-red-300">
          미준수 케이스: {summary.count}건
        </div>
        <span className="text-xs text-slate-400">{expanded ? "접기" : "펼치기"}</span>
      </div>
      <div className="mt-2 text-xs text-slate-600 space-y-1">
        <div>반복 위험 높음: {summary.highRepeatRisk}건</div>
        {summary.topRootCause && (
          <div>주요 원인: {ROOT_CAUSE_LABEL[summary.topRootCause]}</div>
        )}
      </div>
      {expanded && cases.length > 0 && (
        <div className="mt-3 space-y-2">
          {cases.map(c => (
            <div key={c.caseId} className="bg-slate-800/60 rounded p-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-700">{c.caseId} / {c.poNumber}</span>
                <span className={c.repeatRisk === "high" ? "text-red-400" : c.repeatRisk === "medium" ? "text-amber-400" : "text-green-400"}>
                  {c.repeatRisk}
                </span>
              </div>
              <div className="text-slate-400 mt-1">
                {c.domain} → {c.stage} | {ROOT_CAUSE_LABEL[c.rootCauseCategory]}
              </div>
              <div className="text-slate-500 mt-1">{c.remediationRecommendation}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BlockerPatternCard({
  summary,
}: {
  summary: { total: number; repeatedPatterns: number; actorConcentrations: number; concentrationScore: number };
}) {
  return (
    <div className="rounded-lg border border-amber-800/40 bg-amber-900/20 p-4">
      <div className="text-sm font-medium text-amber-300">
        Soft Blocker 패턴
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <div>총 blocker: {summary.total}건</div>
        <div>반복 패턴: {summary.repeatedPatterns}건</div>
        <div>Actor 편중: {summary.actorConcentrations}건</div>
        <div>집중도: {summary.concentrationScore.toFixed(2)}</div>
      </div>
    </div>
  );
}

function DwellRiskCard({
  summary,
}: {
  summary: { total: number; normal: number; watch: number; atRisk: number; critical: number };
}) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-4">
      <div className="text-sm font-medium text-slate-700">
        진행중 Case 체류 현황
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2 text-xs text-center">
        <div>
          <div className="text-green-400 font-medium">{summary.normal}</div>
          <div className="text-slate-500">정상</div>
        </div>
        <div>
          <div className="text-amber-400 font-medium">{summary.watch}</div>
          <div className="text-slate-500">주의</div>
        </div>
        <div>
          <div className="text-orange-400 font-medium">{summary.atRisk}</div>
          <div className="text-slate-500">위험</div>
        </div>
        <div>
          <div className="text-red-400 font-medium">{summary.critical}</div>
          <div className="text-slate-500">긴급</div>
        </div>
      </div>
    </div>
  );
}

function ActionPlanCard({ plan }: { plan: MidpointActionPlan }) {
  const hasActions = plan.immediateActions.length > 0
    || plan.beforeDay7Actions.length > 0
    || plan.evidenceCollectionActions.length > 0;

  if (!hasActions) return null;

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-4">
      <div className="text-sm font-medium text-slate-700 mb-3">조치 계획</div>
      {plan.immediateActions.length > 0 && (
        <div className="mb-2">
          <div className="text-xs text-red-400 mb-1">즉시 조치</div>
          {plan.immediateActions.map((a, i) => (
            <div key={i} className="text-xs text-slate-600 ml-2">• {a}</div>
          ))}
        </div>
      )}
      {plan.beforeDay7Actions.length > 0 && (
        <div className="mb-2">
          <div className="text-xs text-amber-400 mb-1">7일 전 완료</div>
          {plan.beforeDay7Actions.map((a, i) => (
            <div key={i} className="text-xs text-slate-600 ml-2">• {a}</div>
          ))}
        </div>
      )}
      {plan.evidenceCollectionActions.length > 0 && (
        <div>
          <div className="text-xs text-blue-400 mb-1">Evidence 수집</div>
          {plan.evidenceCollectionActions.map((a, i) => (
            <div key={i} className="text-xs text-slate-600 ml-2">• {a}</div>
          ))}
        </div>
      )}
      {plan.ownerSuggestion && (
        <div className="mt-2 text-xs text-slate-400 italic">{plan.ownerSuggestion}</div>
      )}
    </div>
  );
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-slate-700/40 bg-slate-800/30 p-3">
      <div className="text-xs font-medium text-slate-400 mb-2">{title}</div>
      {children}
    </div>
  );
}

function DockButton({
  action,
  onClick,
}: {
  action: MidpointDockAction;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!action.enabled}
      className={`w-full text-left text-sm px-3 py-2 rounded border transition-colors ${
        action.enabled
          ? "border-slate-600 bg-slate-700/50 text-slate-700 hover:bg-slate-600/50"
          : "border-slate-800 bg-slate-900/30 text-slate-600 cursor-not-allowed"
      }`}
    >
      {action.label}
    </button>
  );
}
