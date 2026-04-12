"use client";

/**
 * Pilot Activation Workbench — governance chain 파일럿 운영 UI
 *
 * center = checklist (카테고리별 체크리스트 진행)
 * rail = readiness score, included stages, rollback trigger 요약, monitoring config
 * dock = activate, rollback, cancel, complete, export
 *
 * 모든 label은 grammar registry에서 resolve.
 * CORE RULES:
 * - activate는 ready_to_activate 상태에서만 가능
 * - irreversible action(activate, rollback, complete)은 confirmation dialog 필수
 * - 체크리스트 항목 조작은 draft/checklist_in_progress에서만 가능
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type {
  PilotActivationSurface,
  PilotPlan,
  PilotStatus,
  ActivationChecklistItem,
} from "@/lib/ai/pilot-activation-engine";
import type {
  PilotMonitoringSurface,
  RollbackRecommendation,
  PilotMonitoringAction,
  PilotDashboardHandoff,
  PilotAuditHandoff,
  AuditReviewMode,
} from "@/lib/ai/pilot-monitoring-engine";

// ══════════════════════════════════════════════════════
// PilotActivationWorkbench
// ══════════════════════════════════════════════════════

export interface PilotActivationWorkbenchProps {
  surface: PilotActivationSurface;
  /** Current operator role — controls visibility of irreversible actions */
  operatorRole: string;
  /** Allowed roles for activation/rollback */
  authorizedRoles: string[];
  // Handlers
  onCheckItem?: (itemId: string) => void;
  onUncheckItem?: (itemId: string) => void;
  onActivate?: () => void;
  onComplete?: () => void;
  onRollback?: () => void;
  onCancel?: () => void;
  onExport?: () => void;
  className?: string;
}

const STATUS_DISPLAY: Record<PilotStatus, { label: string; color: string }> = {
  draft: { label: "초안", color: "text-slate-400" },
  checklist_in_progress: { label: "체크리스트 진행 중", color: "text-blue-400" },
  ready_to_activate: { label: "활성화 준비 완료", color: "text-emerald-400" },
  active: { label: "파일럿 운영 중", color: "text-amber-400" },
  completed: { label: "파일럿 완료", color: "text-emerald-400" },
  rolled_back: { label: "롤백 완료", color: "text-red-400" },
  cancelled: { label: "취소됨", color: "text-slate-500" },
};

export function PilotActivationWorkbench({
  surface, operatorRole, authorizedRoles,
  onCheckItem, onUncheckItem, onActivate, onComplete, onRollback, onCancel, onExport,
  className,
}: PilotActivationWorkbenchProps) {
  const [confirmAction, setConfirmAction] = React.useState<"activate" | "rollback" | "complete" | "cancel" | null>(null);
  const [railOpen, setRailOpen] = React.useState(false);
  const plan = surface.center.plan;
  const progress = surface.center.checklistProgress;
  const isAuthorized = authorizedRoles.includes(operatorRole);
  const statusDisplay = STATUS_DISPLAY[plan.status];

  const handleConfirm = () => {
    if (confirmAction === "activate") onActivate?.();
    else if (confirmAction === "rollback") onRollback?.();
    else if (confirmAction === "complete") onComplete?.();
    else if (confirmAction === "cancel") onCancel?.();
    setConfirmAction(null);
  };

  return (
    <div className={cn("flex flex-col pb-20 md:pb-0 md:flex-row gap-4 h-full", className)}>
      {/* ── Center: Checklist ── */}
      <div className="flex-1 min-w-0 overflow-y-auto p-3 md:p-4 space-y-4">
        {/* Status header */}
        <div className="flex items-center justify-between px-4 py-2.5 rounded bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-3">
            <span className={cn("text-sm font-medium", statusDisplay.color)}>{statusDisplay.label}</span>
            <span className="text-[10px] text-slate-500 font-mono">{plan.planId}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span>준비도 {surface.rail.readinessScore}%</span>
            <span>·</span>
            <span>{plan.durationDays}일 계획</span>
            <span>·</span>
            <span>PO {plan.poCountLimit}건 제한</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 py-2 rounded bg-slate-900/50 border border-slate-800">
          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1.5">
            <span>체크리스트 진행</span>
            <span className="tabular-nums">{progress.requiredChecked}/{progress.requiredTotal} 필수 · {progress.checked}/{progress.total} 전체</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress.progressPercent}%` }} />
          </div>
        </div>

        {/* Category breakdown */}
        {surface.center.categoryBreakdown.map(cat => (
          <div key={cat.category} className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-2">
            <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{cat.category}</h4>
            <div className="space-y-1">
              {cat.items.map(item => (
                <ChecklistItemRow
                  key={item.itemId}
                  item={item}
                  editable={plan.status === "draft" || plan.status === "checklist_in_progress"}
                  onCheck={() => onCheckItem?.(item.itemId)}
                  onUncheck={() => onUncheckItem?.(item.itemId)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Confirmation dialog */}
        {confirmAction && (
          <ConfirmationDialog
            action={confirmAction}
            onConfirm={handleConfirm}
            onDismiss={() => setConfirmAction(null)}
          />
        )}
      </div>

      {/* ── Rail: Context ── */}
      <div className="mt-3 md:mt-0 md:w-64 lg:w-72 shrink-0">
        <button
          className="flex items-center justify-between w-full py-2 text-xs text-slate-500 md:hidden"
          onClick={() => setRailOpen(!railOpen)}
        >
          설정 정보 {railOpen ? "▲" : "▼"}
        </button>
        {railOpen && (
          <div className="space-y-3">
        {/* Included stages */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3">
          <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">포함 단계</h4>
          <div className="flex flex-wrap gap-1">
            {surface.rail.includedStageLabels.map(label => (
              <span key={label} className="text-[9px] bg-slate-800 text-slate-600 rounded px-1.5 py-0.5">{label}</span>
            ))}
          </div>
        </div>

        {/* Rollback triggers */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3">
          <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">롤백 트리거</h4>
          <div className="space-y-1">
            {surface.rail.rollbackTriggerSummary.map((trigger, i) => (
              <p key={i} className="text-[10px] text-slate-400">{trigger}</p>
            ))}
          </div>
        </div>

        {/* Monitoring config */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3">
          <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">모니터링 설정</h4>
          <div className="space-y-1 text-[10px] text-slate-400">
            <p>스냅샷 주기: {surface.rail.monitoringConfig.complianceSnapshotIntervalMin}분</p>
            <p>비준수 임계: {surface.rail.monitoringConfig.alertThresholds.nonCompliantRatePercent}%</p>
            <p>차단 임계: {surface.rail.monitoringConfig.alertThresholds.blockerCountMax}건</p>
            <p>보고 주기: {surface.rail.monitoringConfig.reportingIntervalHours}시간</p>
          </div>
        </div>

        {/* Authorization status */}
        {!isAuthorized && (
          <div className="rounded border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-[10px] text-amber-400">현재 역할({operatorRole})은 파일럿 활성화/롤백 권한이 없습니다.</p>
          </div>
        )}
        </div>
        )}
      </div>

      {/* ── Dock: Actions ── */}
      <div className="fixed bottom-0 left-0 right-0 md:static z-30 md:z-auto border-t border-slate-800 bg-slate-950 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500">
            {plan.status === "ready_to_activate" ? "모든 필수 항목 확인 완료 — 파일럿 시작 가능" :
             plan.status === "active" ? "파일럿 운영 중 — 모니터링 진행" :
             plan.status === "completed" || plan.status === "rolled_back" || plan.status === "cancelled" ? "파일럿 종료됨" :
             `필수 항목 ${progress.requiredTotal - progress.requiredChecked}건 남음`}
          </span>
          <div className="flex items-center gap-2 shrink-0 ml-4 flex-wrap md:flex-nowrap">
            {onExport && (
              <button onClick={onExport} className="min-h-[40px] flex-1 md:flex-none rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors active:scale-95">내보내기</button>
            )}
            {surface.dock.actions.find(a => a.actionKey === "cancel_pilot")?.enabled && isAuthorized && (
              <button onClick={() => setConfirmAction("cancel")} className="min-h-[40px] flex-1 md:flex-none rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors active:scale-95">취소</button>
            )}
            {surface.dock.actions.find(a => a.actionKey === "rollback_pilot")?.enabled && isAuthorized && (
              <button onClick={() => setConfirmAction("rollback")} className="min-h-[40px] flex-1 md:flex-none rounded border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors active:scale-95">롤백</button>
            )}
            {surface.dock.actions.find(a => a.actionKey === "complete_pilot")?.enabled && isAuthorized && (
              <button onClick={() => setConfirmAction("complete")} className="min-h-[40px] flex-1 md:flex-none rounded border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors active:scale-95">완료</button>
            )}
            {surface.dock.actions.find(a => a.actionKey === "activate_pilot")?.enabled && isAuthorized && (
              <button onClick={() => setConfirmAction("activate")} className="min-h-[40px] flex-1 md:flex-none rounded bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-medium text-white transition-colors active:scale-95">파일럿 시작</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// ChecklistItemRow
// ══════════════════════════════════════════════════════

function ChecklistItemRow({ item, editable, onCheck, onUncheck }: {
  item: ActivationChecklistItem;
  editable: boolean;
  onCheck: () => void;
  onUncheck: () => void;
}) {
  return (
    <div className="flex items-center gap-2 group">
      <button
        onClick={item.checked ? onUncheck : onCheck}
        disabled={!editable}
        className={cn(
          "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
          item.checked ? "bg-blue-600 border-blue-600" : "border-slate-600 hover:border-slate-500",
          !editable && "opacity-50 cursor-not-allowed",
        )}
      >
        {item.checked && <span className="text-white text-[8px]">✓</span>}
      </button>
      <span className={cn("text-xs", item.checked ? "text-slate-400 line-through" : "text-slate-700")}>
        {item.description}
      </span>
      {item.required && !item.checked && (
        <span className="text-[8px] text-amber-400 bg-amber-500/10 rounded px-1 py-0.5 shrink-0">필수</span>
      )}
      {item.checkedBy && (
        <span className="text-[8px] text-slate-600 shrink-0">{item.checkedBy}</span>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// ConfirmationDialog — irreversible action safeguard
// ══════════════════════════════════════════════════════

const CONFIRM_MESSAGES: Record<string, { title: string; description: string; severity: "warning" | "danger" }> = {
  activate: { title: "파일럿 시작", description: "파일럿을 시작하면 governance chain이 선택된 PO에 대해 활성화됩니다. 계속하시겠습니까?", severity: "warning" },
  rollback: { title: "파일럿 롤백", description: "파일럿을 롤백하면 진행 중인 모든 PO가 기존 워크플로우로 전환됩니다. 이 작업은 되돌릴 수 없습니다.", severity: "danger" },
  complete: { title: "파일럿 완료", description: "파일럿을 완료 처리합니다. 완료 후에는 취소나 롤백이 불가능합니다.", severity: "warning" },
  cancel: { title: "파일럿 취소", description: "파일럿 계획을 취소합니다. 취소된 계획은 다시 활성화할 수 없습니다.", severity: "danger" },
};

function ConfirmationDialog({ action, onConfirm, onDismiss }: {
  action: string;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const msg = CONFIRM_MESSAGES[action];
  if (!msg) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-96 rounded-lg border border-slate-700 bg-slate-900 p-6 space-y-4 shadow-xl">
        <h3 className={cn("text-sm font-medium", msg.severity === "danger" ? "text-red-400" : "text-amber-400")}>{msg.title}</h3>
        <p className="text-xs text-slate-600 leading-relaxed">{msg.description}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onDismiss} className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs text-slate-600 transition-colors">취소</button>
          <button onClick={onConfirm} className={cn(
            "rounded px-4 py-1.5 text-xs font-medium text-white transition-colors",
            msg.severity === "danger" ? "bg-red-600 hover:bg-red-500" : "bg-blue-600 hover:bg-blue-500",
          )}>확인</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// PilotMonitoringWorkbench — 운영 감시 + handoff + rollback 판단
// ══════════════════════════════════════════════════════

const ROLLBACK_BADGE: Record<RollbackRecommendation, { label: string; color: string; bg: string }> = {
  none: { label: "정상", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  watch: { label: "주시 필요", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  rollback_recommended: { label: "롤백 권고", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  rollback_required: { label: "롤백 필수", color: "text-red-300", bg: "bg-red-500/20 border-red-500/30" },
};

export interface PilotMonitoringWorkbenchProps {
  surface: PilotMonitoringSurface;
  plan: PilotPlan;
  operatorRole: string;
  // Handlers
  onActivate?: () => void;
  onComplete?: () => void;
  onRollback?: () => void;
  onCancel?: () => void;
  onOpenDashboard?: (handoff: PilotDashboardHandoff) => void;
  onOpenAuditReview?: (handoff: PilotAuditHandoff) => void;
  className?: string;
}

export function PilotMonitoringWorkbench({
  surface, plan, operatorRole,
  onActivate, onComplete, onRollback, onCancel, onOpenDashboard, onOpenAuditReview,
  className,
}: PilotMonitoringWorkbenchProps) {
  const [confirmAction, setConfirmAction] = React.useState<"activate" | "rollback" | "complete" | "cancel" | null>(null);
  const health = surface.center.healthSummary;
  const split = surface.center.splitView;
  const statusDisplay = STATUS_DISPLAY[plan.status];
  const rollbackBadge = ROLLBACK_BADGE[health.rollbackStatus.recommendation];

  const handleConfirm = () => {
    if (confirmAction === "activate") onActivate?.();
    else if (confirmAction === "rollback") onRollback?.();
    else if (confirmAction === "complete") onComplete?.();
    else if (confirmAction === "cancel") onCancel?.();
    setConfirmAction(null);
  };

  const isAuthorizedFor = (action: PilotMonitoringAction): boolean => {
    const dockAction = surface.dock.actions.find(a => a.actionKey === action);
    if (!dockAction?.enabled) return false;
    if (dockAction.requiredRoles.length === 0) return true;
    return dockAction.requiredRoles.includes(operatorRole);
  };

  return (
    <div className={cn("flex gap-4 h-full", className)}>
      {/* ── Center: Health + Checklist ── */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Status + Rollback header */}
        <div className="flex items-center justify-between px-4 py-2.5 rounded bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-3">
            <span className={cn("text-sm font-medium", statusDisplay.color)}>{statusDisplay.label}</span>
            <span className={cn("text-[10px] rounded px-1.5 py-0.5 border", rollbackBadge.bg, rollbackBadge.color)}>{rollbackBadge.label}</span>
          </div>
          {health.signalFreshness.stale && (
            <span className="text-[10px] text-amber-400">신호 {Math.round(health.signalFreshness.ageMs / 60000)}분 전</span>
          )}
        </div>

        {/* Split view: 4 health indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <HealthIndicator label="셋업" healthy={split.setupComplete} detail={`${health.checklistHealth.progressPercent}%`} />
          <HealthIndicator label="운영" healthy={split.operationalHealthy} detail={`${health.operationalHealth.overallScore}점`} />
          <HealthIndicator label="준수" healthy={split.complianceHealthy} detail={`${health.complianceHealth.complianceRate}%`} />
          <HealthIndicator label="롤백" healthy={split.rollbackSafe} detail={rollbackBadge.label} />
        </div>

        {/* Runtime signals */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-2">
          <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Runtime Signal</h4>
          <div className="space-y-1">
            {health.operationalHealth.signals.map(s => (
              <div key={s.signalId} className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-2">
                  <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", s.passed ? "bg-emerald-400" : s.severity === "critical" ? "bg-red-400" : "bg-amber-400")} />
                  <span className="text-slate-600">{s.name}</span>
                </div>
                <span className="tabular-nums text-slate-500">{s.score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Critical issues */}
        {health.operationalHealth.criticalIssues.length > 0 && (
          <div className="rounded border border-red-500/20 bg-red-500/5 p-3 space-y-1">
            <h4 className="text-[10px] font-medium text-red-400">Critical Issues</h4>
            {health.operationalHealth.criticalIssues.map((issue, i) => (
              <p key={i} className="text-[10px] text-red-300">{issue}</p>
            ))}
          </div>
        )}

        {/* Recent critical events */}
        {health.recentCriticalEvents.length > 0 && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-1">
            <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500">최근 이벤트</h4>
            {health.recentCriticalEvents.slice(0, 5).map((evt, i) => (
              <div key={i} className="flex items-center justify-between text-[10px]">
                <span className="text-slate-600">{evt.detail}</span>
                <span className="text-slate-600 shrink-0 ml-2">{evt.domain}</span>
              </div>
            ))}
          </div>
        )}

        {/* Rollback triggers hit */}
        {health.rollbackStatus.triggerCount > 0 && (
          <div className={cn("rounded border p-3 space-y-1", health.rollbackStatus.recommendation === "rollback_required" ? "border-red-500/30 bg-red-500/10" : "border-amber-500/20 bg-amber-500/5")}>
            <h4 className={cn("text-[10px] font-medium", health.rollbackStatus.recommendation === "rollback_required" ? "text-red-400" : "text-amber-400")}>
              롤백 트리거 {health.rollbackStatus.triggerCount}건 발동
            </h4>
          </div>
        )}

        {confirmAction && (
          <ConfirmationDialog
            action={confirmAction}
            onConfirm={handleConfirm}
            onDismiss={() => setConfirmAction(null)}
          />
        )}
      </div>

      {/* ── Rail: Context + Shortcuts ── */}
      <div className="w-64 shrink-0 space-y-3">
        {/* Compliance summary */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3">
          <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1">준수 현황</h4>
          <p className="text-[10px] text-slate-400">{surface.rail.complianceSummary}</p>
        </div>

        {/* Stale warning */}
        {surface.rail.staleWarning && (
          <div className="rounded border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-[10px] text-amber-400">{surface.rail.staleWarning}</p>
          </div>
        )}

        {/* Shortcuts */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3 space-y-1.5">
          <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1">바로가기</h4>
          {surface.rail.shortcuts.filter(s => s.enabled).map(shortcut => (
            <button
              key={shortcut.target}
              onClick={() => {
                if (shortcut.target === "dashboard" && onOpenDashboard) {
                  // Handoff는 parent에서 구성
                  onOpenDashboard(undefined as any);
                } else if (shortcut.target.startsWith("audit") && onOpenAuditReview) {
                  onOpenAuditReview(undefined as any);
                }
              }}
              className="w-full text-left text-[10px] text-blue-400 hover:text-blue-300 transition-colors py-0.5"
            >
              {shortcut.label}
            </button>
          ))}
        </div>

        {/* Signal freshness */}
        <div className="rounded border border-slate-800 bg-slate-900/50 p-3">
          <h4 className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1">신호 수집</h4>
          <p className="text-[10px] text-slate-400">{new Date(surface.rail.lastCalculatedAt).toLocaleString("ko-KR")}</p>
        </div>
      </div>

      {/* ── Dock: Actions ── */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className={cn("text-[10px]", health.rollbackStatus.recommendation !== "none" ? "text-amber-400" : "text-slate-500")}>
            {health.rollbackStatus.recommendation === "rollback_required" ? "롤백 필수 — 즉시 조치 필요" :
             health.rollbackStatus.recommendation === "rollback_recommended" ? "롤백 권고 — 검토 필요" :
             health.rollbackStatus.recommendation === "watch" ? "주시 필요 — 트리거 감시 중" :
             plan.status === "active" ? "파일럿 정상 운영 중" : ""}
          </span>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {isAuthorizedFor("open_dashboard") && (
              <button onClick={() => onOpenDashboard?.(undefined as any)} className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors">대시보드</button>
            )}
            {isAuthorizedFor("open_audit_review") && (
              <button onClick={() => onOpenAuditReview?.(undefined as any)} className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors">감사</button>
            )}
            {isAuthorizedFor("cancel_pilot") && (
              <button onClick={() => setConfirmAction("cancel")} className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors">취소</button>
            )}
            {isAuthorizedFor("rollback_pilot") && (
              <button onClick={() => setConfirmAction("rollback")} className={cn("rounded border px-3 py-1.5 text-xs font-medium transition-colors",
                health.rollbackStatus.recommendation === "rollback_required" ? "border-red-500/30 bg-red-600 hover:bg-red-500 text-white" : "border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-300"
              )}>롤백</button>
            )}
            {isAuthorizedFor("complete_pilot") && (
              <button onClick={() => setConfirmAction("complete")} className="rounded border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors">완료</button>
            )}
            {isAuthorizedFor("activate_pilot") && (
              <button onClick={() => setConfirmAction("activate")} className="rounded bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-medium text-white transition-colors">파일럿 시작</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// HealthIndicator — split view 4칸 표시용
// ══════════════════════════════════════════════════════

function HealthIndicator({ label, healthy, detail }: { label: string; healthy: boolean; detail: string }) {
  return (
    <div className={cn("rounded border p-2 text-center", healthy ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5")}>
      <p className="text-[9px] text-slate-500 mb-0.5">{label}</p>
      <p className={cn("text-xs font-medium tabular-nums", healthy ? "text-emerald-400" : "text-red-400")}>{detail}</p>
    </div>
  );
}
