"use client";

/**
 * §mobile-residual-5 공통 — 모바일 바텀 시트 셸 + 메뉴 시트 (호영님 핸드오프 2026-09-07).
 *
 * 모바일 메뉴 시트 통일 규칙: scrim rgba(15,23,42,.45) + 흰 시트(radius 20 상단) +
 *   핸들 바 40×4 + 헤더(제목 + ✕). scrim 탭 · 핸들 아래 스와이프 · Esc 로 닫힘.
 *
 * plain div 구현(포털 0 · Radix 0) — §11.297b ActionMenu 와 같은 이유(호영님 환경 Radix
 *   silent fail 차단) + 시트 내부 인라인 컨트롤의 스태킹 컨텍스트 문제 원천 제거.
 *   z-[80] = ui/sheet·dialog 와 동일 계층(하단 탭바 z-50 위).
 *
 * MobileActionSheet = 셸 + 항목 리스트(아이콘 칩 38px · 제목 13.5px/700 · 설명 11px · ›).
 *   항목 히트 영역 ≥56px. 항목 탭 = onClick 실행 후 닫힘.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MobileSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** 시트 본문 추가 클래스 */
  className?: string;
  ariaLabel?: string;
}

const SWIPE_CLOSE_PX = 60;

export function MobileSheet({ open, onClose, title, children, className, ariaLabel }: MobileSheetProps) {
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);

  // Esc 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // body 스크롤 잠금
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, [open]);

  useEffect(() => {
    if (!open) setDragY(0);
  }, [open]);

  if (!open) return null;

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0]?.clientY ?? null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current == null) return;
    const dy = (e.touches[0]?.clientY ?? startY.current) - startY.current;
    setDragY(Math.max(0, dy));
  };
  const onTouchEnd = () => {
    const shouldClose = dragY > SWIPE_CLOSE_PX;
    startY.current = null;
    setDragY(0);
    if (shouldClose) onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title}
      className="fixed inset-0 z-[80] md:hidden"
    >
      {/* scrim */}
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-[rgba(15,23,42,.45)]"
        onClick={onClose}
      />
      {/* sheet */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-white rounded-t-[20px] shadow-[0_-10px_40px_rgba(15,23,42,.2)] max-h-[85vh] flex flex-col safe-area-bottom",
          dragY === 0 && "transition-transform duration-150",
          className,
        )}
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined }}
      >
        {/* 핸들 바 — 스와이프 닫기 영역 */}
        <div
          className="flex justify-center pt-2.5 pb-1 touch-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <span className="h-1 w-10 rounded-full bg-[#e2e8f0]" aria-hidden />
        </div>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-1 pb-2.5">
          <span className="text-[14px] font-extrabold text-slate-900">{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={`${title} 닫기`}
            className="inline-flex items-center justify-center h-9 w-9 -mr-2 rounded-lg text-slate-400 hover:bg-slate-100 active:scale-95 touch-manipulation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">{children}</div>
      </div>
    </div>
  );
}

export interface MobileActionSheetItem {
  label: string;
  description?: string;
  icon: ReactNode;
  onClick: () => void;
  /** 강조 항목 — 아이콘 칩 블루(#eff6ff / #1d4ed8) */
  accent?: boolean;
  disabled?: boolean;
}

export interface MobileActionSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  items: MobileActionSheetItem[];
}

export function MobileActionSheet({ open, onClose, title, items }: MobileActionSheetProps) {
  return (
    <MobileSheet open={open} onClose={onClose} title={title}>
      <div role="menu" className="flex flex-col">
        {items.map((item, idx) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.onClick();
            }}
            className={cn(
              "flex items-center gap-3.5 w-full min-h-[56px] px-1 py-2.5 text-left touch-manipulation active:bg-slate-50 disabled:opacity-50",
              idx < items.length - 1 && "border-b border-[#f1f5f9]",
            )}
          >
            <span
              className={cn(
                "flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] [&>svg]:h-[17px] [&>svg]:w-[17px]",
                item.accent ? "bg-[#eff6ff] text-[#1d4ed8]" : "bg-[#f8fafc] text-slate-600",
              )}
            >
              {item.icon}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13.5px] font-bold text-slate-900">{item.label}</span>
              {item.description && (
                <span className="block text-[11px] text-slate-400 mt-px truncate">{item.description}</span>
              )}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
          </button>
        ))}
      </div>
    </MobileSheet>
  );
}
