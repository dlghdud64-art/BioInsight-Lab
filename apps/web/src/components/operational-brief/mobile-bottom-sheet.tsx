"use client";

/**
 * §11.152 #operational-brief-rail-mobile-bottom-sheet
 *
 * 5 surface (Purchase Conversion / Work Queue / RFQ-Quote / Inbox / Inventory) 가
 * 모바일에서 desktop rail 대신 bottom sheet 변종으로 사용하는 shared component.
 *
 * §11.142 lock 보존:
 * - 운영 브리핑 + selected object label
 * - 4 preset chips (anchor jump)
 * - 4 sections: 상황 요약 / 핵심 근거 / 리스크 / 다음 조치
 * - Primary CTA 1개
 * - chatbot input 0
 *
 * Usage:
 *   <MobileOperationalBriefSheet
 *     open={!!selectedItem}
 *     onClose={() => setSelectedItem(null)}
 *     objectLabel="선택한 견적"
 *     chips={[{id: "summary", label: "상태 요약"}, ...]}
 *     summary={...}
 *     facts={...}
 *     risks={...}
 *     primaryCta={{label, onClick}}
 *   />
 */

import { useEffect } from "react";
import { X, ArrowRight } from "lucide-react";

export interface MobileBriefChip {
  id: "summary" | "facts" | "risks" | "next" | string;
  label: string;
}

export interface MobileBriefPrimaryCta {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface MobileOperationalBriefSheetProps {
  open: boolean;
  onClose: () => void;
  objectLabel: string;
  chips?: MobileBriefChip[];
  summary?: React.ReactNode;
  facts?: React.ReactNode;
  risks?: React.ReactNode;
  next?: React.ReactNode;
  primaryCta?: MobileBriefPrimaryCta;
}

const DEFAULT_CHIPS: MobileBriefChip[] = [
  { id: "summary", label: "상태 요약" },
  { id: "facts",   label: "핵심 근거" },
  { id: "risks",   label: "리스크" },
  { id: "next",    label: "다음 조치" },
];

export function MobileOperationalBriefSheet({
  open,
  onClose,
  objectLabel,
  chips = DEFAULT_CHIPS,
  summary,
  facts,
  risks,
  next,
  primaryCta,
}: MobileOperationalBriefSheetProps) {
  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, [open]);

  if (!open) return null;

  const scrollToBrief = (id: string) => {
    const el = document.getElementById(`mb-brief-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="운영 브리핑"
      className="fixed inset-0 z-50 md:hidden"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col">
        {/* Drag handle */}
        <div className="flex justify-center pt-2">
          <span className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        {/* Brief header */}
        <div className="px-4 pt-2 pb-2 flex items-center justify-between border-b border-slate-200">
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">운영 브리핑</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-wide">{objectLabel}</span>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-900 p-0.5"
              aria-label="브리핑 닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 4 chips */}
        <div className="px-4 py-2 border-b border-slate-100 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => scrollToBrief(c.id)}
              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Scrollable 4-section body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {summary != null && (
            <section id="mb-brief-summary" className="scroll-mt-4">
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">상황 요약</div>
              {summary}
            </section>
          )}
          {facts != null && (
            <section id="mb-brief-facts" className="scroll-mt-4">
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">핵심 근거</div>
              {facts}
            </section>
          )}
          {risks != null && (
            <section id="mb-brief-risks" className="scroll-mt-4">
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">리스크</div>
              {risks}
            </section>
          )}
          {next != null && (
            <section id="mb-brief-next" className="scroll-mt-4">
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">다음 조치</div>
              {next}
            </section>
          )}
        </div>

        {/* Primary CTA — sticky bottom */}
        {primaryCta && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
            <button
              type="button"
              disabled={primaryCta.disabled}
              onClick={primaryCta.onClick}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
            >
              {primaryCta.label}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
