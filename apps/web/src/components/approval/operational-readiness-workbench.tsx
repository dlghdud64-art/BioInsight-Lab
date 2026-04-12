"use client";

/**
 * Operational Readiness Workbench — Batch 17
 *
 * 최종 운영 게이트: go / conditional_go / no_go verdict를
 * center=decision, rail=context, dock=action 패턴으로 표시.
 *
 * 기존 workbench grammar와 동일한 톤 유지.
 */

import React from "react";
import type {
  OperationalReadinessSurface,
  OperationalReadinessAction,
  OperationalVerdict,
  GateCategoryId,
  GateIssue,
  ActivationScopeRecommendation,
} from "@/lib/ai/operational-readiness-gate-engine";
import { GATE_CATEGORY_LABELS } from "@/lib/ai/operational-readiness-gate-engine";
import type { UnifiedSeverity } from "@/lib/ai/governance-grammar-registry";

// ══════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════

const VERDICT_DISPLAY: Record<OperationalVerdict, { label: string; color: string; bg: string; description: string }> = {
  go: { label: "Go", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", description: "전체 검증 통과 — 파일럿 활성화 가능" },
  conditional_go: { label: "Conditional Go", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", description: "조건부 통과 — 제한적 활성화 가능" },
  no_go: { label: "No-Go", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", description: "미통과 — blocker 해소 필요" },
};

const SEVERITY_COLOR: Record<UnifiedSeverity, string> = {
  info: "text-sky-400",
  warning: "text-amber-400",
  critical: "text-red-400",
};

const SCOPE_DISPLAY: Record<string, { label: string; color: string }> = {
  internal_only: { label: "내부 전용", color: "text-slate-400" },
  pilot_limited: { label: "제한 파일럿", color: "text-amber-400" },
  pilot_expanded: { label: "확장 파일럿", color: "text-emerald-400" },
  hold: { label: "보류", color: "text-red-400" },
};

// ══════════════════════════════════════════════════════
// Workbench Props
// ══════════════════════════════════════════════════════

export interface OperationalReadinessWorkbenchProps {
  surface: OperationalReadinessSurface;
  currentUserRole: string;
  onAction?: (actionKey: string) => void;
  className?: string;
}

// ══════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════

function VerdictHeader({ verdict, score }: { verdict: OperationalVerdict; score: number }) {
  const display = VERDICT_DISPLAY[verdict];
  return (
    <div className={`rounded-lg border p-4 ${display.bg}`}>
      <div className="flex items-center justify-between">
        <div>
          <span className={`text-lg font-semibold ${display.color}`}>{display.label}</span>
          <p className="mt-1 text-sm text-slate-400">{display.description}</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-slate-700">{score}</span>
          <span className="text-sm text-slate-500">/100</span>
        </div>
      </div>
    </div>
  );
}

function CategoryRow({ cat }: {
  cat: { categoryId: GateCategoryId; categoryLabel: string; passed: boolean; score: number; blockerCount: number; conditionalCount: number };
}) {
  const statusIcon = cat.passed ? "✓" : "✗";
  const statusColor = cat.passed ? "text-emerald-400" : "text-red-400";
  const scoreColor = cat.score >= 80 ? "text-emerald-400" : cat.score >= 50 ? "text-amber-400" : "text-red-400";

  return (
    <div className="flex items-center justify-between border-b border-slate-700/50 py-2 last:border-0">
      <div className="flex items-center gap-2">
        <span className={`text-sm font-mono ${statusColor}`}>{statusIcon}</span>
        <span className="text-sm text-slate-600">{cat.categoryLabel}</span>
      </div>
      <div className="flex items-center gap-3">
        {cat.blockerCount > 0 && (
          <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-xs text-red-400">
            {cat.blockerCount} blocker
          </span>
        )}
        {cat.conditionalCount > 0 && (
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-400">
            {cat.conditionalCount} 조건부
          </span>
        )}
        <span className={`text-sm font-mono ${scoreColor}`}>{cat.score}</span>
      </div>
    </div>
  );
}

function IssueList({ title, issues, color }: { title: string; issues: GateIssue[]; color: string }) {
  if (issues.length === 0) return null;
  return (
    <div className="mt-3">
      <h4 className={`text-xs font-medium uppercase tracking-wide ${color}`}>{title}</h4>
      <div className="mt-1 space-y-1">
        {issues.map((issue) => (
          <div key={issue.issueId} className="rounded bg-slate-800/50 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-mono ${SEVERITY_COLOR[issue.severity]}`}>[{issue.severityLabel}]</span>
              <span className="text-sm text-slate-600">{issue.summary}</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">{issue.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScopeRecommendation({ rec }: { rec: ActivationScopeRecommendation }) {
  const display = SCOPE_DISPLAY[rec.scope] ?? { label: rec.scope, color: "text-slate-400" };
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-3">
      <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">활성화 범위 권고</h4>
      <div className="mt-2 flex items-center gap-2">
        <span className={`text-sm font-semibold ${display.color}`}>{display.label}</span>
      </div>
      <p className="mt-1 text-xs text-slate-400">{rec.reason}</p>
      {rec.scope !== "hold" && (
        <div className="mt-2 flex gap-4 text-xs text-slate-500">
          <span>PO 제한: {rec.suggestedPoLimit}건</span>
          <span>도메인: {rec.suggestedDomains.length}개</span>
          <span>기간: {rec.suggestedDurationDays}일</span>
        </div>
      )}
    </div>
  );
}

function RailSignalRow({ signal }: { signal: { signalId: string; name: string; passed: boolean; score: number; severity: UnifiedSeverity } }) {
  const icon = signal.passed ? "●" : "○";
  const color = signal.passed ? "text-emerald-400" : SEVERITY_COLOR[signal.severity];
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-1.5">
        <span className={`text-xs ${color}`}>{icon}</span>
        <span className="text-xs text-slate-400">{signal.name}</span>
      </div>
      <span className={`text-xs font-mono ${color}`}>{signal.score}</span>
    </div>
  );
}

function DockAction({
  action,
  currentUserRole,
  onAction,
  verdictIsNoGo,
}: {
  action: OperationalReadinessAction;
  currentUserRole: string;
  onAction?: (key: string) => void;
  verdictIsNoGo: boolean;
}) {
  const [confirming, setConfirming] = React.useState(false);
  const roleAllowed = action.requiredRoles.length === 0 || action.requiredRoles.includes(currentUserRole);
  const canAct = action.enabled && roleAllowed;

  // go/conditional_go 승인은 irreversible에 준하는 취급
  const isApprovalAction = action.actionKey === "approve_go" || action.actionKey === "approve_conditional_go";
  const highlightClass = isApprovalAction && canAct
    ? verdictIsNoGo
      ? ""
      : action.actionKey === "approve_go"
        ? "bg-emerald-600 hover:bg-emerald-500 text-white"
        : "bg-amber-600 hover:bg-amber-500 text-white"
    : "";

  const handleClick = () => {
    if (!canAct) return;
    if (action.requiresConfirmation && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    onAction?.(action.actionKey);
  };

  const handleCancel = () => setConfirming(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleClick}
          className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500"
        >
          확인
        </button>
        <button
          onClick={handleCancel}
          className="rounded bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-600"
        >
          취소
        </button>
        <span className="text-xs text-slate-500">{action.label} — 이 작업을 실행하시겠습니까?</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={!canAct}
      className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
        canAct
          ? highlightClass || "bg-slate-700 text-slate-600 hover:bg-slate-600"
          : "cursor-not-allowed bg-slate-800 text-slate-600"
      }`}
      title={action.disabledReason ?? (!roleAllowed ? `권한 필요: ${action.requiredRoles.join(", ")}` : undefined)}
    >
      {action.label}
    </button>
  );
}

// ══════════════════════════════════════════════════════
// Main Workbench
// ══════════════════════════════════════════════════════

export function OperationalReadinessWorkbench({
  surface,
  currentUserRole,
  onAction,
  className = "",
}: OperationalReadinessWorkbenchProps) {
  const [railOpen, setRailOpen] = React.useState(false);
  const { center, rail, dock } = surface;
  const verdictIsNoGo = center.verdict === "no_go";

  return (
    <div className={`flex flex-col pb-20 md:pb-0 md:grid md:grid-cols-[1fr_320px] gap-4 h-full ${className}`}>
      {/* ── Center ── */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4 md:space-y-4">
        <VerdictHeader verdict={center.verdict} score={center.overallScore} />

        {/* Category breakdown */}
        <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">카테고리 평가</h3>
          <div className="mt-2">
            {center.categoryBreakdown.map((cat) => (
              <CategoryRow key={cat.categoryId} cat={cat} />
            ))}
          </div>
        </div>

        {/* Blocking issues */}
        <IssueList title={`Blocker (${center.blockingIssues.length})`} issues={center.blockingIssues} color="text-red-400" />

        {/* Conditional issues */}
        <IssueList title={`조건부 이슈 (${center.conditionalIssues.length})`} issues={center.conditionalIssues} color="text-amber-400" />

        {/* Scope recommendation */}
        <ScopeRecommendation rec={center.scopeRecommendation} />

        {/* Release candidate summary */}
        <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-3">
          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">릴리즈 후보 요약</h4>
          <div className="mt-2 flex gap-6 text-xs text-slate-400">
            <span>수용 판정: <strong className="text-slate-600">{center.releaseCandidateSummary.acceptanceVerdict}</strong></span>
            <span>런타임 점수: <strong className="text-slate-600">{center.releaseCandidateSummary.runtimeScore}</strong></span>
            <span>롤백 신뢰도: <strong className="text-slate-600">{center.releaseCandidateSummary.rollbackConfidence}</strong></span>
          </div>
        </div>
      </div>

      {/* ── Rail ── */}
      <div className="mt-3 md:mt-0">
        <button
          className="flex items-center justify-between w-full py-2 text-xs text-slate-500 md:hidden"
          onClick={() => railOpen ? setRailOpen(false) : setRailOpen(true)}
        >
          참고 정보 {railOpen ? "▲" : "▼"}
        </button>
        {railOpen && (
          <div className="space-y-4">
        {/* Runtime signals */}
        <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-3">
          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">런타임 신호</h4>
          <div className="mt-1">
            {rail.runtimeSignals.map((s) => (
              <RailSignalRow key={s.signalId} signal={s} />
            ))}
          </div>
        </div>

        {/* Compliance summary */}
        <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-3">
          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">컴플라이언스</h4>
          <div className="mt-1 space-y-1 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>전체 스냅샷</span>
              <span className="text-slate-600">{rail.complianceSummary.total}건</span>
            </div>
            <div className="flex justify-between">
              <span>미준수</span>
              <span className={rail.complianceSummary.nonCompliant > 0 ? "text-red-400" : "text-slate-600"}>
                {rail.complianceSummary.nonCompliant}건
              </span>
            </div>
          </div>
        </div>

        {/* Pilot scope */}
        {rail.pilotScope && (
          <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-3">
            <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">파일럿 범위</h4>
            <div className="mt-1 space-y-1 text-xs text-slate-400">
              <div className="flex justify-between"><span>스테이지</span><span className="text-slate-600">{rail.pilotScope.stages}개</span></div>
              <div className="flex justify-between"><span>도메인</span><span className="text-slate-600">{rail.pilotScope.domains}개</span></div>
              <div className="flex justify-between"><span>PO 제한</span><span className="text-slate-600">{rail.pilotScope.poLimit === 0 ? "무제한" : `${rail.pilotScope.poLimit}건`}</span></div>
              <div className="flex justify-between"><span>기간</span><span className="text-slate-600">{rail.pilotScope.durationDays}일</span></div>
            </div>
          </div>
        )}

        {/* Rollback readiness */}
        <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-3">
          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">롤백 준비도</h4>
          <div className="mt-1 space-y-1 text-xs text-slate-400">
            <div className="flex justify-between"><span>권고</span><span className="text-slate-600">{rail.rollbackReadiness.recommendation}</span></div>
            <div className="flex justify-between"><span>트리거</span><span className="text-slate-600">{rail.rollbackReadiness.triggerCount}건</span></div>
            <div className="flex justify-between"><span>신뢰도</span><span className="text-slate-600">{rail.rollbackReadiness.confidence}</span></div>
          </div>
        </div>

        {/* Acceptance summary */}
        <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-3">
          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">제품 수용</h4>
          <div className="mt-1 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>판정</span>
              <span className={
                rail.acceptanceSummary.verdict === "accepted" ? "text-emerald-400"
                  : rail.acceptanceSummary.verdict === "conditional" ? "text-amber-400"
                  : "text-red-400"
              }>
                {rail.acceptanceSummary.verdict}
              </span>
            </div>
            <div className="flex justify-between mt-1">
              <span>시나리오</span>
              <span className="text-slate-600">{rail.acceptanceSummary.passed}/{rail.acceptanceSummary.total} 통과</span>
            </div>
          </div>
        </div>
        </div>
        )}
      </div>

      {/* ── Dock ── */}
      <div className="fixed bottom-0 left-0 right-0 md:static z-30 md:z-auto md:col-span-2 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/30 px-4 py-3 flex-wrap md:flex-nowrap">
        {dock.actions.map((action) => (
          <DockAction
            key={action.actionKey}
            action={action}
            currentUserRole={currentUserRole}
            onAction={onAction}
            verdictIsNoGo={verdictIsNoGo}
          />
        ))}
      </div>
    </div>
  );
}
