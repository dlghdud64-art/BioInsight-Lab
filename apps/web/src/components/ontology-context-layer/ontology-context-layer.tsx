"use client";

/**
 * OntologyContextLayer — Contextual next-step command layer overlay.
 *
 * NOT a chatbot. NOT a dashboard shortcut. NOT an AI recommendation card.
 *
 * This is a deterministic next-step switchboard:
 * - Center: 다음 required action + 영향 record + blocker + CTA
 * - Rail: 현재 stage + linked lineage + snapshot validity + why this action
 * - Dock: 계속하기 / 교정 이동 / 다른 작업 보기 / 닫기
 *
 * Governance grammar: center=decision, rail=context, dock=action
 */

import { useCallback, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  X,
  ChevronRight,
  ArrowRight,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  LayoutDashboard,
  ExternalLink,
  Lock,
  Compass,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOntologyContextLayerStore } from "@/lib/store/ontology-context-layer-store";
import type {
  ResolvedAction,
  ActionPriority,
  RailLineageItem,
  CenterContextItem,
} from "@/lib/ontology/contextual-action/ontology-next-action-resolver";

// ══════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════

export function OntologyContextLayer() {
  const { isOpen, resolved, close } = useOntologyContextLayerStore();
  const router = useRouter();
  const pathname = usePathname();

  // ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, close]);

  const handleActionClick = useCallback(
    (action: ResolvedAction) => {
      if (action.blocked) return;

      // Close overlay first
      close();

      // Navigate or open work window
      if (action.targetRoute) {
        router.push(action.targetRoute);
      }
      // targetWorkWindow는 page-level에서 처리 (store에 기록 후 page가 읽음)
      // 현재 page에서 work window를 열어야 하는 경우,
      // 이벤트를 발행하여 page가 반응하게 함
      if (action.targetWorkWindow && !action.targetRoute) {
        // Custom event로 page에 통지
        window.dispatchEvent(
          new CustomEvent("ontology-action-dispatch", {
            detail: {
              actionKey: action.actionKey,
              targetWorkWindow: action.targetWorkWindow,
            },
          }),
        );
      }
    },
    [close, router],
  );

  if (!isOpen || !resolved) return null;

  const { nextRequiredAction, availableFollowUpActions, blockedActions, whyThisAction, currentStageLabel, mode, railContext, centerContext, whyReasons } = resolved;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px]"
        onClick={close}
        aria-hidden="true"
      />

      {/* Overlay panel */}
      <div
        className="fixed z-[71] flex flex-col overflow-hidden rounded-2xl border border-slate-200"
        style={{
          top: "4.5rem",
          right: "1rem",
          width: "min(92vw, 460px)",
          maxHeight: "calc(100vh - 6rem)",
          backgroundColor: "#FFFFFF",
          boxShadow: "0 24px 64px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="다음 작업 레이어"
      >
        {/* ═══ Header ═══ */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <Compass className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">다음 작업</h2>
              <p className="text-[10px] text-slate-500">{currentStageLabel}</p>
            </div>
          </div>
          <button
            onClick={close}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ═══ Body — scrollable ═══ */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* ── Center: Primary action ── */}
          <div className="px-5 py-4">
            <PrimaryActionCard
              action={nextRequiredAction}
              onExecute={handleActionClick}
            />
          </div>

          {/* ── Center context summary ── */}
          {centerContext && centerContext.length > 0 && (
            <div className="px-5 pb-3">
              <div className="flex flex-wrap gap-1.5">
                {centerContext.map((item, i) => (
                  <ContextBadge key={i} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* ── Why reasons block ── */}
          {whyReasons && whyReasons.length > 0 && (
            <div className="px-5 pb-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-medium text-slate-500 mb-1.5">왜 지금 이 작업인가</p>
                <div className="space-y-1">
                  {whyReasons.map((reason, i) => (
                    <p key={i} className="text-xs text-slate-600 leading-relaxed flex items-start gap-1.5">
                      <span className="text-blue-500/60 mt-0.5 shrink-0">·</span>
                      {reason}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Rail: Lineage context ── */}
          {railContext && railContext.length > 0 && (
            <div className="px-5 pb-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                <p className="text-[11px] font-medium text-slate-500 mb-2">컨텍스트 lineage</p>
                <div className="space-y-1.5">
                  {railContext.map((item) => (
                    <RailLineageRow key={item.key} item={item} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Blocked actions (if any) ── */}
          {blockedActions.length > 0 && (
            <div className="px-5 pb-3">
              <p className="text-[11px] font-medium text-slate-500 mb-2 flex items-center gap-1">
                <Lock className="h-3 w-3" />
                차단된 작업
              </p>
              <div className="space-y-2">
                {blockedActions.map((action) => (
                  <BlockedActionCard key={action.actionKey} action={action} />
                ))}
              </div>
            </div>
          )}

          {/* ── Follow-up actions ── */}
          {availableFollowUpActions.length > 0 && (
            <div className="px-5 pb-4">
              <p className="text-[11px] font-medium text-slate-500 mb-2">다른 작업</p>
              <div className="space-y-1.5">
                {availableFollowUpActions.map((action) => (
                  <FollowUpActionRow
                    key={action.actionKey}
                    action={action}
                    onExecute={handleActionClick}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══ Dock: Sticky bottom actions ═══ */}
        <div className="shrink-0 px-5 py-3 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-slate-500 hover:text-slate-700 h-8 px-3"
            onClick={close}
          >
            닫기
          </Button>
          <div className="flex items-center gap-2">
            {mode === "overview" && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-slate-500 hover:text-slate-700 h-8 px-3"
                onClick={() => {
                  close();
                  router.push("/dashboard");
                }}
              >
                <LayoutDashboard className="h-3.5 w-3.5 mr-1" />
                대시보드
              </Button>
            )}
            <Button
              size="sm"
              className="h-8 px-4 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
              disabled={nextRequiredAction.blocked}
              onClick={() => handleActionClick(nextRequiredAction)}
            >
              {nextRequiredAction.blocked ? "차단됨" : "계속하기"}
              {!nextRequiredAction.blocked && <ArrowRight className="h-3.5 w-3.5 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════

function PrimaryActionCard({
  action,
  onExecute,
}: {
  action: ResolvedAction;
  onExecute: (action: ResolvedAction) => void;
}) {
  const priorityConfig = PRIORITY_STYLES[action.priority];

  return (
    <div className={`rounded-xl border p-4 ${priorityConfig.border} ${priorityConfig.bg}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${priorityConfig.iconBg}`}>
          <priorityConfig.Icon className={`h-4 w-4 ${priorityConfig.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${priorityConfig.badge}`}>
              {priorityConfig.label}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-slate-900 mb-1">{action.label}</h3>
          <p className="text-xs text-slate-500 leading-relaxed">{action.reason}</p>
          {action.targetRoute && (
            <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-400">
              <ExternalLink className="h-3 w-3" />
              <span>{action.targetRoute}</span>
            </div>
          )}
        </div>
      </div>

      {!action.blocked && (
        <button
          onClick={() => onExecute(action)}
          className={`w-full mt-3 h-9 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${priorityConfig.cta}`}
        >
          {action.label}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}

      {action.blocked && action.blockReason && (
        <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-red-500 shrink-0" />
          <span className="text-[11px] text-red-600">{action.blockReason}</span>
        </div>
      )}
    </div>
  );
}

function BlockedActionCard({ action }: { action: ResolvedAction }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <Lock className="h-3.5 w-3.5 text-red-500 shrink-0" />
        <span className="text-xs font-medium text-red-700">{action.label}</span>
      </div>
      {action.blockReason && (
        <p className="text-[11px] text-red-500 mt-1 ml-5">{action.blockReason}</p>
      )}
    </div>
  );
}

function FollowUpActionRow({
  action,
  onExecute,
}: {
  action: ResolvedAction;
  onExecute: (action: ResolvedAction) => void;
}) {
  return (
    <button
      onClick={() => onExecute(action)}
      disabled={action.blocked}
      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
          {action.label}
        </p>
        <p className="text-[10px] text-slate-400 truncate">{action.reason}</p>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 shrink-0 transition-colors" />
    </button>
  );
}

// ══════════════════════════════════════════════
// Priority visual mapping
// ══════════════════════════════════════════════

const PRIORITY_STYLES: Record<
  ActionPriority,
  {
    label: string;
    border: string;
    bg: string;
    iconBg: string;
    iconColor: string;
    badge: string;
    cta: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  primary: {
    label: "다음 단계",
    border: "border-blue-200",
    bg: "bg-blue-50/60",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    badge: "text-blue-600",
    cta: "bg-blue-600 hover:bg-blue-500 text-white",
    Icon: ArrowRight,
  },
  secondary: {
    label: "대안",
    border: "border-slate-200",
    bg: "bg-slate-50",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-500",
    badge: "text-slate-500",
    cta: "bg-slate-600 hover:bg-slate-500 text-white",
    Icon: ChevronRight,
  },
  correction: {
    label: "해결 필요",
    border: "border-amber-200",
    bg: "bg-amber-50/60",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    badge: "text-amber-600",
    cta: "bg-amber-600 hover:bg-amber-500 text-white",
    Icon: AlertTriangle,
  },
  overview: {
    label: "작업 허브",
    border: "border-slate-200",
    bg: "bg-slate-50/60",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
    badge: "text-slate-500",
    cta: "bg-slate-600 hover:bg-slate-500 text-white",
    Icon: LayoutDashboard,
  },
};

// ══════════════════════════════════════════════
// Center context badge & Rail lineage row
// ══════════════════════════════════════════════

const TONE_BADGE_STYLES: Record<CenterContextItem["tone"], string> = {
  neutral: "bg-slate-100 text-slate-600",
  positive: "bg-blue-50 text-blue-700",
  warning: "bg-amber-50 text-amber-700",
  blocked: "bg-red-50 text-red-700",
};

function ContextBadge({ item }: { item: CenterContextItem }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-medium ${TONE_BADGE_STYLES[item.tone]}`}>
      {item.tone === "positive" && <CheckCircle2 className="h-3 w-3 mr-1 shrink-0" />}
      {item.tone === "warning" && <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />}
      {item.tone === "blocked" && <ShieldAlert className="h-3 w-3 mr-1 shrink-0" />}
      {item.label}
    </span>
  );
}

const TONE_VALUE_STYLES: Record<RailLineageItem["tone"], string> = {
  neutral: "text-slate-600",
  positive: "text-blue-600",
  warning: "text-amber-600",
  blocked: "text-red-600",
};

function RailLineageRow({ item }: { item: RailLineageItem }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-slate-500 shrink-0">{item.label}</span>
      <span className={`text-[11px] font-medium text-right truncate ${TONE_VALUE_STYLES[item.tone]}`}>
        {item.value}
      </span>
    </div>
  );
}
