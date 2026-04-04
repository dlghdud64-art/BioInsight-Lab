"use client";

import {
  ArrowRight, CheckCircle2, Sparkles, AlertTriangle,
  ListChecks, CircleCheck, Clock, Truck, ChevronRight,
} from "lucide-react";

/*
 * ── Product Proof — App Window Screenshot on Dark Hero ────────────
 *
 *  핵심: "카드"가 아니라 "앱 윈도우 스크린샷"처럼 보여야 함
 *   - macOS-style window chrome (title bar + traffic lights)
 *   - 뒤에 subtle glow로 "화면이 켜져 있다" 느낌
 *   - 페이지 콘텐츠가 아닌 독립된 제품 오브젝트
 * ────────────────────────────────────────────────────────────────────
 */

const QUEUE_ITEMS = [
  {
    id: "pe-001",
    title: "PCR 튜브 (0.2mL) 회신 완료",
    summary: "PCR Tubes 0.2mL, Flat Cap, 1000ea/pk",
    statusLabel: "발주 전환 가능",
    statusColor: "emerald" as const,
    approvalLabel: "외부 승인 완료",
    blockerType: null as string | null,
    blockerReason: null as string | null,
    aiLabel: "AI 추천 완료",
    aiColor: "emerald" as const,
    replies: "3/3",
    price: "₩185,000",
    recommended: "BioKorea",
    ctaLabel: "발주 전환 준비",
    ctaPrimary: true,
    daysAgo: 5,
    selected: true,
  },
  {
    id: "pe-002",
    title: "Premium FBS 회신 완료",
    summary: "FBS, Heat Inactivated, 500mL",
    statusLabel: "선택안 검토 필요",
    statusColor: "blue" as const,
    approvalLabel: "외부 승인 완료",
    blockerType: "가격 차이",
    blockerReason: "최저가와 선호 공급사 간 가격/납기 충돌",
    aiLabel: "AI 검토 필요",
    aiColor: "amber" as const,
    replies: "3/3",
    price: "₩580,000",
    recommended: "GibcoKR",
    ctaLabel: "선택안 검토",
    ctaPrimary: false,
    daysAgo: 8,
    selected: false,
  },
  {
    id: "pe-006",
    title: "Trypsin-EDTA (0.25%) 대체품 추천",
    summary: "Trypsin-EDTA 0.25%, 100mL × 6",
    statusLabel: "선택안 검토 필요",
    statusColor: "blue" as const,
    approvalLabel: "외부 승인 완료",
    blockerType: null,
    blockerReason: null,
    aiLabel: "AI 검토 필요",
    aiColor: "amber" as const,
    replies: "3/3",
    price: "₩145,000",
    recommended: "Welgene",
    ctaLabel: "선택안 검토",
    ctaPrimary: false,
    daysAgo: 4,
    selected: false,
  },
];

const RAIL_OPTIONS = [
  { level: "추천", supplier: "BioKorea", price: "₩185,000", lead: "3일", tags: ["최저가", "납기 최단", "기존 거래처"], selected: true },
  { level: "대체", supplier: "LabSource", price: "₩198,000", lead: "5일", tags: ["MOQ 5팩 이상", "단가 7% 높음"], selected: false },
  { level: "보수", supplier: "SciSupply", price: "₩210,000", lead: "2일", tags: ["납기 2일", "긴급 시 유리"], selected: false },
];

const BADGE = {
  emerald: { bg: "rgba(16,185,129,0.12)", text: "#6EE7B7", border: "rgba(16,185,129,0.25)" },
  blue:    { bg: "rgba(59,130,246,0.12)", text: "#93C5FD", border: "rgba(59,130,246,0.25)" },
  amber:   { bg: "rgba(245,158,11,0.12)", text: "#FCD34D", border: "rgba(245,158,11,0.25)" },
} as const;

const C = {
  base: "#141E33",
  elevated: "#1E2B44",
  sunken: "#0F1829",
  divider: "#253650",
  dividerSubtle: "#1C2C44",
  text1: "#F8FAFC",
  text2: "#D4DEE8",
  text3: "#8FA4BC",
  text4: "#6A829C",
  accent: "#3B82F6",
} as const;

/*
 * ── Mockup content: hero에서 inline으로 사용 ──
 */
export function OpsConsoleMockupContent() {
  return (
    <div className="flex flex-col md:flex-row" style={{ backgroundColor: C.base }}>

              {/* Left: Queue */}
              <div className="flex-1 md:border-r" style={{ borderColor: C.divider }}>
                <div className="px-3 md:px-4 py-2 overflow-x-auto" style={{ borderBottom: `1px solid ${C.dividerSubtle}` }}>
                  <div className="flex items-center gap-1 min-w-max">
                    {["전체 8", "선택안 검토 4", "발주 가능 3", "보류 1"].map((tab, i) => (
                      <span key={tab}
                        className="text-[9px] md:text-[10px] font-medium px-1.5 md:px-2 py-1 rounded-md cursor-default whitespace-nowrap"
                        style={{
                          color: i === 0 ? C.text1 : C.text4,
                          backgroundColor: i === 0 ? C.elevated : "transparent",
                        }}
                      >{tab}</span>
                    ))}
                  </div>
                </div>

                <div className="divide-y" style={{ borderColor: C.dividerSubtle }}>
                  {QUEUE_ITEMS.map((item) => (
                    <div key={item.id}
                      className="px-3 md:px-4 py-2.5 md:py-3 cursor-default"
                      style={{ backgroundColor: item.selected ? C.elevated : C.base }}
                    >
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-[8px] md:text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: BADGE[item.statusColor].bg, color: BADGE[item.statusColor].text, border: `1px solid ${BADGE[item.statusColor].border}` }}
                        >{item.statusLabel}</span>
                        {item.blockerType && (
                          <span className="text-[8px] md:text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                            style={{ backgroundColor: BADGE.amber.bg, color: BADGE.amber.text, border: `1px solid ${BADGE.amber.border}` }}
                          ><AlertTriangle className="h-2 w-2" />{item.blockerType}</span>
                        )}
                      </div>

                      <div className="flex items-start justify-between gap-2 md:gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] md:text-[12px] font-bold leading-snug truncate"
                            style={{ color: item.selected ? "#FFFFFF" : C.text1 }}
                          >{item.title}</p>
                          <p className="text-[9px] md:text-[10px] mt-0.5" style={{ color: C.text3 }}>
                            회신 {item.replies} · {item.price}
                          </p>
                        </div>

                        <button className="text-[9px] md:text-[10px] font-semibold px-2 md:px-3 py-1 md:py-1.5 rounded-lg flex items-center gap-0.5 md:gap-1 whitespace-nowrap flex-shrink-0 mt-0.5"
                          style={{
                            backgroundColor: item.ctaPrimary ? C.accent : "transparent",
                            color: item.ctaPrimary ? "#FFFFFF" : C.text2,
                            border: item.ctaPrimary ? "none" : `1px solid ${C.divider}`,
                          }}>
                          {item.ctaLabel}<ChevronRight className="h-2 w-2 md:h-2.5 md:w-2.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="px-4 py-2 text-center" style={{ backgroundColor: C.sunken }}>
                    <span className="text-[10px]" style={{ color: C.text4 }}>+ 5건 더 보기</span>
                  </div>
                </div>
              </div>

              {/* Right: Rail */}
              <div className="md:w-[290px] flex-shrink-0 hidden md:block" style={{ backgroundColor: "#182438" }}>
                <div className="px-4 py-2.5" style={{ borderBottom: `1px solid ${C.dividerSubtle}` }}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: BADGE.emerald.bg, color: BADGE.emerald.text, border: `1px solid ${BADGE.emerald.border}` }}
                    >발주 전환 가능</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: BADGE.emerald.bg, color: BADGE.emerald.text, border: `1px solid ${BADGE.emerald.border}` }}
                    >외부 승인 완료</span>
                  </div>
                  <p className="text-[11px] font-semibold truncate" style={{ color: C.text1 }}>PCR 튜브 (0.2mL) 회신 완료</p>
                  <p className="text-[10px] truncate" style={{ color: C.text4 }}>PCR Tubes 0.2mL, Flat Cap, 1000ea/pk</p>
                </div>

                <div className="px-3 pt-2 pb-0.5">
                  <div className="flex items-center gap-1 mb-1.5">
                    <Sparkles className="h-3 w-3" style={{ color: C.text3 }} />
                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: C.text4 }}>AI 선택안</span>
                  </div>
                </div>

                <div className="divide-y" style={{ borderColor: C.dividerSubtle }}>
                  {RAIL_OPTIONS.map((opt) => (
                    <div key={opt.supplier}
                      className="px-3 py-2.5"
                      style={{ backgroundColor: opt.selected ? C.elevated : "transparent" }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                            style={{
                              backgroundColor: opt.selected ? "rgba(59,130,246,0.15)" : C.dividerSubtle,
                              color: opt.selected ? "#93C5FD" : C.text4,
                            }}>{opt.level}</span>
                          <span className="text-[11px] font-semibold"
                            style={{ color: opt.selected ? "#FFFFFF" : C.text3 }}>{opt.supplier}</span>
                          {opt.selected && <CheckCircle2 className="h-3 w-3 text-blue-400" />}
                        </div>
                        <span className="text-[11px] font-bold"
                          style={{ color: opt.selected ? "#FFFFFF" : C.text3 }}>{opt.price}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: C.sunken, color: C.text3, border: `1px solid ${C.dividerSubtle}` }}>납기 {opt.lead}</span>
                        {opt.tags.slice(0, 2).map((t) => (
                          <span key={t} className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: C.sunken, color: C.text3, border: `1px solid ${C.dividerSubtle}` }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-3 py-2.5" style={{ borderTop: `1px solid ${C.dividerSubtle}` }}>
                  <button className="w-full text-[11px] font-semibold px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 text-white"
                    style={{ backgroundColor: C.accent }}>
                    발주 전환 시작 <ArrowRight className="h-3 w-3" />
                  </button>
                  <p className="text-[9px] text-center mt-1.5" style={{ color: C.text4 }}>
                    선택안 확정 → PO 생성 → 공급사 발송
                  </p>
                </div>
              </div>
            </div>
  );
}

/* Legacy export — page.tsx에서 아직 import할 수 있도록 유지 */
export function OpsConsolePreviewSection() {
  return null;
}
