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

import { useEffect, useState } from "react";
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
  /** §inventory-reorder-surface-unify P1 — 진입 맥락. 'reorder'면 헤더 eyebrow를 "재발주 검토"로
   *  (데스크탑 InventoryContextPanel mode 분기와 동형). 기본 'detail' = 회귀 0(운영 브리핑 보존).
   *  공유 컴포넌트이므로 inventory 외 4 surface는 기본값으로 거동 불변. */
  mode?: "detail" | "reorder";
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
  mode = "detail",
}: MobileOperationalBriefSheetProps) {
  // §11.264a — 4 chip 을 탭으로 전환 (호영님 spec 견적 모바일 #3-1 긴급).
  //   기존 §11.183: chip onClick = scrollToBrief (anchor link) → 모든 4 section
  //   항상 함께 표시. 호영님 신규 spec: chip = 탭 → 활성 tab content 만 표시.
  //   §11.183 chip scroll 정의 → §11.264a tab switch 으로 supersede.
  //   default activeTab = "summary" (호영님 spec "상태 요약 기본 표시" 정합).
  const [activeTab, setActiveTab] = useState<string>("summary");

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
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">{mode === "reorder" ? "재발주 검토" : "운영 브리핑"}</span>
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

        {/* §11.264a — 4 chip 탭 (호영님 spec 견적 모바일 #3-1 긴급).
            chip onClick = setActiveTab. 활성 chip: text-blue-700 + border-b-2 + border-blue-600.
            비활성 chip: text-slate-600 + border-b-2 + border-transparent (hover bg-slate-100).
            aria-pressed 으로 탭 a11y 정합. */}
        <div className="px-4 border-b border-slate-100 flex items-center gap-0" role="tablist">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              onClick={() => setActiveTab(c.id)}
              aria-pressed={activeTab === c.id}
              aria-selected={activeTab === c.id}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === c.id
                  ? "text-blue-700 border-blue-600"
                  : "text-slate-600 border-transparent hover:bg-slate-100"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* §11.264a — 활성 탭 content 만 표시 (4 section render 분기).
            anchor IDs (mb-brief-*) 보존 (a11y / deep linking 용). */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {activeTab === "summary" && summary != null && (
            <section id="mb-brief-summary" className="scroll-mt-4">
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">상황 요약</div>
              {summary}
            </section>
          )}
          {activeTab === "facts" && facts != null && (
            <section id="mb-brief-facts" className="scroll-mt-4">
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">핵심 근거</div>
              {facts}
            </section>
          )}
          {activeTab === "risks" && risks != null && (
            <section id="mb-brief-risks" className="scroll-mt-4">
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1.5">리스크</div>
              {risks}
            </section>
          )}
          {activeTab === "next" && next != null && (
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
