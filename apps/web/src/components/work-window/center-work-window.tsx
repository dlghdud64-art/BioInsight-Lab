"use client";

import { useEffect, useCallback } from "react";
import { X, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WORK_WINDOW_LAYOUT } from "@/lib/layout-system/work-window-system";

// ===========================================================================
// Types
// ===========================================================================

export type WorkWindowPhase =
  | "idle"
  | "loading"
  | "ready"
  | "executing"
  | "success"
  | "error"
  | "conflict";

export interface WorkWindowProps {
  /** 열기/닫기 */
  open: boolean;
  /** 닫기 콜백 */
  onClose: () => void;
  /** 제목 */
  title: string;
  /** 부제목 (entity 요약) */
  subtitle?: string;
  /** 현재 phase */
  phase?: WorkWindowPhase;
  /** 성공 메시지 */
  successMessage?: string;
  /** 에러 메시지 */
  errorMessage?: string;
  /** 자동 닫기 딜레이 (ms), 0이면 자동 닫기 안 함 */
  autoCloseDelay?: number;
  /** 자식 요소 (taskBody) */
  children: React.ReactNode;
  /** primary CTA */
  primaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
  /** secondary CTA */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** context header 영역 */
  contextHeader?: React.ReactNode;
  /** linked summary 영역 */
  linkedSummary?: React.ReactNode;
}

// ===========================================================================
// Component
// ===========================================================================

/**
 * CenterWorkWindow — 중앙 집중 작업 surface.
 *
 * interaction-surfaces.ts 규칙 준수:
 * - density: focused
 * - overlay: true (backdrop으로 부모 가림)
 * - allowedComplexity: focused_workflow
 * - returnBehavior: close_to_parent
 * - parentRefresh: optimistic_then_confirm
 *
 * work-window-system.ts 8-slot 구조:
 * titleBar, contextHeader, taskBody, linkedSummary,
 * primaryAction, secondaryAction, closeReturn, refreshHint
 */
export function CenterWorkWindow({
  open,
  onClose,
  title,
  subtitle,
  phase = "ready",
  successMessage = "완료되었습니다",
  errorMessage,
  autoCloseDelay = 1500,
  children,
  primaryAction,
  secondaryAction,
  contextHeader,
  linkedSummary,
}: WorkWindowProps) {
  // ESC로 닫기
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "executing") {
        onClose();
      }
    },
    [onClose, phase]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
      };
    }
  }, [open, handleKeyDown]);

  // 성공 후 자동 닫기
  useEffect(() => {
    if (phase === "success" && autoCloseDelay > 0) {
      const timer = setTimeout(onClose, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [phase, autoCloseDelay, onClose]);

  if (!open) return null;

  return (
    /* Backdrop */
    <div
      className={WORK_WINDOW_LAYOUT.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget && phase !== "executing") {
          onClose();
        }
      }}
    >
      {/* Window container */}
      <div
        className={WORK_WINDOW_LAYOUT.container}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Slot 1: Title Bar */}
        <div className={WORK_WINDOW_LAYOUT.titleBar}>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 truncate">{title}</h2>
            {subtitle && (
              <p className="text-xs text-slate-400 truncate mt-0.5">{subtitle}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700 shrink-0"
            onClick={onClose}
            disabled={phase === "executing"}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Slot 2: Context Header */}
        {contextHeader && (
          <div className={WORK_WINDOW_LAYOUT.contextHeader}>
            {contextHeader}
          </div>
        )}

        {/* Slot 3: Task Body */}
        <div className={WORK_WINDOW_LAYOUT.taskBody}>
          {phase === "loading" ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              <span className="ml-2 text-sm text-slate-400">로딩 중...</span>
            </div>
          ) : (
            children
          )}
        </div>

        {/* Slot 4: Linked Summary */}
        {linkedSummary && (
          <div className={WORK_WINDOW_LAYOUT.linkedSummary}>
            {linkedSummary}
          </div>
        )}

        {/* Slot 5+6+7: Action Footer (primary + secondary + close) */}
        {(primaryAction || secondaryAction) && phase !== "success" && (
          <div className={WORK_WINDOW_LAYOUT.actionFooter}>
            {secondaryAction && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-slate-400 hover:text-slate-700"
                onClick={secondaryAction.onClick}
                disabled={phase === "executing"}
              >
                {secondaryAction.label}
              </Button>
            )}
            {primaryAction && (
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled || phase === "executing"}
              >
                {primaryAction.loading || phase === "executing" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    처리 중…
                  </>
                ) : (
                  primaryAction.label
                )}
              </Button>
            )}
          </div>
        )}

        {/* Success Overlay */}
        {phase === "success" && (
          <div className={WORK_WINDOW_LAYOUT.successOverlay}>
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              <p className="text-sm font-medium text-slate-900">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {phase === "error" && errorMessage && (
          <div className="px-5 py-2 bg-red-600/10 border-t border-red-600/20 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
            <p className="text-xs text-red-400">{errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
