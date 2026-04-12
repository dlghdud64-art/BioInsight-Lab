"use client";

/**
 * RC0 Pilot Launch Workbench — Batch 19
 *
 * 파일럿 실행 준비 최종 확인 화면.
 * center=readiness, rail=details, dock=launch actions.
 */

import React from "react";
import type {
  LaunchSurface,
  LaunchAction,
} from "@/lib/ai/rc0-pilot-launch-engine";

// ══════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════

const READINESS_DISPLAY = {
  true: { label: "Launch Ready", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", desc: "모든 조건 충족 — 파일럿 시작 가능" },
  false: { label: "Not Ready", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", desc: "미충족 조건 해소 필요" },
} as const;

const DRILL_RESULT_COLOR: Record<string, string> = {
  pass: "text-emerald-400",
  fail: "text-red-400",
  partial: "text-amber-400",
  "미실시": "text-slate-500",
};

// ══════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════

function ReadinessHeader({ ready, blockingReasons }: { ready: boolean; blockingReasons: string[] }) {
  const display = READINESS_DISPLAY[String(ready) as "true" | "false"];
  return (
    <div className={`rounded-lg border p-4 ${display.bg}`}>
      <div className="flex items-center justify-between">
        <div>
          <span className={`text-lg font-semibold ${display.color}`}>{display.label}</span>
          <p className="mt-1 text-sm text-slate-400">{display.desc}</p>
        </div>
      </div>
      {blockingReasons.length > 0 && (
        <div className="mt-3 space-y-1">
          {blockingReasons.map((r, i) => (
            <div key={i} className="rounded bg-red-500/5 px-2 py-1 text-xs text-red-400">
              {r}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-3">
      <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</h4>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`text-xs ${ok ? "text-emerald-400" : "text-red-400"}`}>{ok ? "●" : "○"}</span>;
}

function DockAction({
  action,
  currentUserRole,
  onAction,
}: {
  action: LaunchAction;
  currentUserRole: string;
  onAction?: (key: string) => void;
}) {
  const [confirming, setConfirming] = React.useState(false);
  const roleAllowed = action.requiredRoles.length === 0 || action.requiredRoles.includes(currentUserRole);
  const canAct = action.enabled && roleAllowed;

  const isLaunch = action.actionKey === "launch_pilot";

  const handleClick = () => {
    if (!canAct) return;
    if (action.requiresConfirmation && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    onAction?.(action.actionKey);
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <button onClick={handleClick} className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500">확인</button>
        <button onClick={() => setConfirming(false)} className="rounded bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-600">취소</button>
        <span className="text-xs text-slate-500">{action.label} — 이 작업을 실행하시겠습니까?</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={!canAct}
      className={`min-h-[40px] flex-1 md:flex-none rounded px-3 py-1.5 text-xs font-medium transition-colors active:scale-95 ${
        canAct
          ? isLaunch
            ? "bg-emerald-600 text-white hover:bg-emerald-500"
            : "bg-slate-700 text-slate-600 hover:bg-slate-600"
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

export interface RC0PilotLaunchWorkbenchProps {
  surface: LaunchSurface;
  currentUserRole: string;
  onAction?: (actionKey: string) => void;
  className?: string;
}

export function RC0PilotLaunchWorkbench({
  surface,
  currentUserRole,
  onAction,
  className = "",
}: RC0PilotLaunchWorkbenchProps) {
  const [railOpen, setRailOpen] = React.useState(false);
  const { center, rail, dock } = surface;

  return (
    <div className={`flex flex-col pb-20 md:pb-0 md:grid md:grid-cols-[1fr_320px] gap-4 h-full ${className}`}>
      {/* ── Center ── */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4">
        <ReadinessHeader ready={center.ready} blockingReasons={center.blockingReasons} />

        {/* Scope summary */}
        <SectionCard title="RC0 범위">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-400">
            <div><span className="text-slate-500">Stage</span><div className="text-slate-600">{center.scopeSummary.stages}개</div></div>
            <div><span className="text-slate-500">Domain</span><div className="text-slate-600">{center.scopeSummary.domains}개</div></div>
            <div><span className="text-slate-500">PO 제한</span><div className="text-slate-600">{center.scopeSummary.poLimit}건</div></div>
            <div><span className="text-slate-500">기간</span><div className="text-slate-600">{center.scopeSummary.durationDays}일</div></div>
            <div><span className="text-slate-500">시작</span><div className="text-slate-600">{center.scopeSummary.startDate.slice(0, 10)}</div></div>
            <div><span className="text-slate-500">종료</span><div className="text-slate-600">{center.scopeSummary.endDate.slice(0, 10)}</div></div>
          </div>
        </SectionCard>

        {/* 5-section readiness checklist */}
        <SectionCard title="런치 조건 체크리스트">
          <div className="space-y-2">
            <div className="flex items-center gap-2"><StatusDot ok={center.scopeSummary.stages > 0} /><span className="text-xs text-slate-600">RC0 범위 확정</span></div>
            <div className="flex items-center gap-2"><StatusDot ok={center.scenarioSummary.verified === center.scenarioSummary.total} /><span className="text-xs text-slate-600">시나리오 검증 완료 ({center.scenarioSummary.verified}/{center.scenarioSummary.total})</span></div>
            <div className="flex items-center gap-2"><StatusDot ok={center.signoffSummary.completed === center.signoffSummary.total} /><span className="text-xs text-slate-600">서명 완료 ({center.signoffSummary.completed}/{center.signoffSummary.total})</span></div>
            <div className="flex items-center gap-2"><StatusDot ok={center.monitoringSummary.points > 0} /><span className="text-xs text-slate-600">모니터링 구성 ({center.monitoringSummary.points}개 포인트)</span></div>
            <div className="flex items-center gap-2"><StatusDot ok={center.drillSummary.conducted && center.drillSummary.result === "pass"} /><span className="text-xs text-slate-600">롤백 리허설 {center.drillSummary.result} ({center.drillSummary.passedSteps}/{center.drillSummary.totalSteps})</span></div>
          </div>
        </SectionCard>

        {/* Pending signoffs */}
        {center.signoffSummary.pending.length > 0 && (
          <SectionCard title="미서명 역할">
            <div className="space-y-1">
              {center.signoffSummary.pending.map((p) => (
                <div key={p} className="rounded bg-amber-500/5 px-2 py-1 text-xs text-amber-400">{p}</div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>

      {/* ── Rail ── */}
      <div className="mt-3 md:mt-0">
        <button
          className="flex items-center justify-between w-full py-2 text-xs text-slate-500 md:hidden"
          onClick={() => setRailOpen(!railOpen)}
        >
          참고 정보 {railOpen ? "▲" : "▼"}
        </button>
        {railOpen && (
          <div className="space-y-4">
        {/* Scenarios */}
        <SectionCard title="시나리오">
          <div className="space-y-1">
            {rail.scenarios.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-1.5">
                  <StatusDot ok={s.verified} />
                  <span className="text-xs text-slate-400">{s.name}</span>
                </div>
                <span className="text-xs text-slate-500">{s.seedRange}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Signoff entries */}
        <SectionCard title="서명 현황">
          <div className="space-y-1">
            {rail.signoffEntries.map((e) => (
              <div key={e.role} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-1.5">
                  <StatusDot ok={e.signedOff} />
                  <span className="text-xs text-slate-400">{e.label}</span>
                </div>
                <span className="text-xs text-slate-500">{e.assignee}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Monitoring highlights */}
        <SectionCard title="Day-0 모니터링">
          <div className="space-y-1">
            {rail.monitoringPoints.slice(0, 6).map((p) => (
              <div key={p.id} className="flex items-center justify-between py-0.5">
                <span className="text-xs text-slate-400">{p.name}</span>
                <span className="text-xs text-red-400/70">{p.critical}</span>
              </div>
            ))}
            {rail.monitoringPoints.length > 6 && (
              <span className="text-xs text-slate-600">+{rail.monitoringPoints.length - 6}개 더</span>
            )}
          </div>
        </SectionCard>

        {/* Drill steps */}
        {rail.drillSteps && (
          <SectionCard title="롤백 리허설">
            <div className="space-y-1">
              {rail.drillSteps.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-0.5">
                  <span className="text-xs text-slate-400 truncate max-w-[200px]">{s.description}</span>
                  <span className={`text-xs font-mono ${DRILL_RESULT_COLOR[s.result] ?? "text-slate-500"}`}>{s.result}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
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
          />
        ))}
      </div>
    </div>
  );
}
