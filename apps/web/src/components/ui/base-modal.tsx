"use client";

/**
 * BaseModal — 엔터프라이즈 통합 모달 기반 컴포넌트
 *
 * 모든 모달이 공유하는 뼈대. 일관된 애니메이션, 사이즈 규격,
 * Header/Body/Footer 구조를 강제하여 UI 파편화를 방지한다.
 *
 * 특징:
 * - framer-motion 기반 backdrop blur + scale/slide-up 트랜지션
 * - sm/md/lg/xl/full 5단계 사이즈 규격
 * - ESC 키 / 배경 클릭으로 닫기
 * - 포커스 트랩 (접근성)
 * - body scroll lock
 */

import { useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModalSize } from "@/lib/store/modal-store";

// ══════════════════════════════════════════════
// Size config
// ══════════════════════════════════════════════

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
  full: "max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] w-full h-full",
};

// ══════════════════════════════════════════════
// Animation variants
// ══════════════════════════════════════════════

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: "easeIn" } },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 16 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 8,
    transition: { duration: 0.15, ease: "easeIn" },
  },
};

// ══════════════════════════════════════════════
// Props
// ══════════════════════════════════════════════

interface BaseModalProps {
  /** 열림 상태 */
  open: boolean;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 사이즈 규격 */
  size?: ModalSize;
  /** 제목 */
  title?: string;
  /** 부제목 */
  subtitle?: string;
  /** 헤더 좌측 아이콘/배지 */
  headerIcon?: React.ReactNode;
  /** Footer 영역 (액션 버튼 등) */
  footer?: React.ReactNode;
  /** 배경 클릭으로 닫기 허용 (기본: true) */
  closeOnBackdropClick?: boolean;
  /** ESC로 닫기 허용 (기본: true) */
  closeOnEsc?: boolean;
  /** X 닫기 버튼 표시 (기본: true) */
  showCloseButton?: boolean;
  /** 모달 컨텐츠 */
  children: React.ReactNode;
  /** 추가 className */
  className?: string;
  /** exit 완료 후 콜백 */
  onExitComplete?: () => void;
}

// ══════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════

export function BaseModal({
  open,
  onClose,
  size = "md",
  title,
  subtitle,
  headerIcon,
  footer,
  closeOnBackdropClick = true,
  closeOnEsc = true,
  showCloseButton = true,
  children,
  className,
  onExitComplete,
}: BaseModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // ── ESC 키 핸들러 ──
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (closeOnEsc && e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [closeOnEsc, onClose],
  );

  // ── Body scroll lock + ESC listener ──
  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleKeyDown);

      return () => {
        document.body.style.overflow = originalOverflow;
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [open, handleKeyDown]);

  // ── Focus trap: 열릴 때 모달에 포커스 ──
  useEffect(() => {
    if (open && modalRef.current) {
      const timer = setTimeout(() => modalRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            variants={backdropVariants}
            onClick={closeOnBackdropClick ? onClose : undefined}
            aria-hidden="true"
          />

          {/* Modal panel */}
          <motion.div
            ref={modalRef}
            variants={modalVariants}
            className={cn(
              "relative w-full bg-white rounded-2xl shadow-2xl shadow-slate-900/10 border border-slate-200/80 flex flex-col overflow-hidden",
              SIZE_CLASSES[size],
              size === "full" ? "" : "max-h-[calc(100vh-4rem)]",
              className,
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? "modal-title" : undefined}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ── */}
            {(title || showCloseButton) && (
              <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-slate-100 flex-shrink-0">
                <div className="flex items-start gap-3 min-w-0">
                  {headerIcon && (
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      {headerIcon}
                    </div>
                  )}
                  <div className="min-w-0">
                    {title && (
                      <h2
                        id="modal-title"
                        className="text-lg font-bold text-slate-900 leading-tight"
                      >
                        {title}
                      </h2>
                    )}
                    {subtitle && (
                      <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">
                        {subtitle}
                      </p>
                    )}
                  </div>
                </div>
                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    aria-label="닫기"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                )}
              </div>
            )}

            {/* ── Body ── */}
            <div
              className={cn(
                "flex-1 overflow-y-auto",
                size === "full" ? "p-6" : "px-6 py-5",
              )}
            >
              {children}
            </div>

            {/* ── Footer ── */}
            {footer && (
              <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ══════════════════════════════════════════════
// Sub-components for structured content
// ══════════════════════════════════════════════

/** 모달 내부 섹션 구분 */
export function ModalSection({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {title && (
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

/** 모달 내부 정보 행 */
export function ModalInfoRow({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between text-sm", className)}>
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900 font-medium">{value}</span>
    </div>
  );
}
