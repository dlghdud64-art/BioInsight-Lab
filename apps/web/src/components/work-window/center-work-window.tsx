"use client";

import { useEffect, useCallback } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
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
    return undefined;
  }, [open, handleKeyDown]);

  // 성공 후 자동 닫기
  useEffect(() => {
    if (phase === "success" && autoCloseDelay > 0) {
      const timer = setTimeout(onClose, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [phase, autoCloseDelay, onClose]);

  // 모바일 바텀시트 swipe-to-dismiss: 임계치 이상 아래로 끌면 닫힘
  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (phase === "executing") return;
      if (info.offset.y > 120 || info.velocity.y > 600) {
        onClose();
      }
    },
    [onClose, phase],
  );

  return (
    <AnimatePresence>
      {open ? (
        /* Backdrop: 모바일은 bottom 정렬, 데스크탑은 center 정렬 */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center lg:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget && phase !== "executing") {
              onClose();
            }
          }}
        >
          {/* Window container — 모바일: 바닥에서 올라오는 full-screen sheet
              데스크탑: 중앙 정렬 모달 */}
          <motion.div
            initial={{ y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            drag={phase !== "executing" ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.3 }}
            onDragEnd={handleDragEnd}
            className={[
              // ── Mobile (<lg): full-screen bottom sheet ────────────
              "relative w-full max-h-[92vh] h-[92vh] rounded-t-2xl",
              "bg-pn border-t border-x border-bd shadow-2xl",
              "overflow-hidden flex flex-col",
              // ── Desktop (≥lg): centered modal (기존 grammar 유지) ──
              "lg:h-auto lg:max-w-2xl lg:max-h-[85vh]",
              "lg:rounded-xl lg:border",
              "lg:shadow-2xl",
            ].join(" ")}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            {/* 모바일 드래그 핸들 — 데스크탑에서는 숨김 */}
            <div className="flex justify-center pt-2 pb-1 lg:hidden">
              <div className="h-1.5 w-10 rounded-full bg-slate-300" aria-hidden="true" />
            </div>
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
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
