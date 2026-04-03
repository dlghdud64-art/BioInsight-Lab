"use client";

import {
  ArrowRight, CheckCircle2, Sparkles, AlertTriangle,
  ListChecks, CircleCheck, Clock, Truck, ChevronRight,
} from "lucide-react";

/*
 * ── Product Proof — Light Mockup on Dark Hero ─────────────────────
 *
 *  Color hierarchy:
 *   Hero field    = deep cobalt (#041A3E)
 *   Proof band    = near-black neutral (#0E1118)
 *   Mockup frame  = WHITE light surface — pops against dark hero
 *   Internal UI   = light app screenshot (white/gray)
 *
 *  핵심: dark hero 위에 밝은 제품 스크린샷이 떠 있어야
 *  "이 제품이 실제로 이렇게 생겼다"가 바로 들어옴
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
  {
    level: "추천",
    supplier: "BioKorea",
    price: "₩185,000",
    lead: "3일",
    tags: ["최저가", "납기 최단", "기존 거래처"],
    selected: true,
  },
  {
    level: "대체",
    supplier: "LabSource",
    price: "₩198,000",
    lead: "5일",
    tags: ["MOQ 5팩 이상", "단가 7% 높음"],
    selected: false,
  },
  {
    level: "보수",
    supplier: "SciSupply",
    price: "₩210,000",
    lead: "2일",
    tags: ["납기 2일", "긴급 시 유리"],
    selected: false,
  },
];

/* ── Light-theme semantic badge palette ── */
const BADGE = {
  emerald: { bg: "#ECFDF5", text: "#059669", border: "#A7F3D0" },
  blue:    { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" },
  amber:   { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A" },
} as const;

export function OpsConsolePreviewSection() {
  return (
    <section
      className="relative"
      style={{ backgroundColor: "#0E1118" }}
    >
      <div
        className="relative mx-auto px-3 md:px-4 pb-10 md:pb-14"
        style={{ maxWidth: 1180 }}
      >
        {/* ── Product Mockup — LIGHT frame floating on dark hero ── */}
        <div
          className="relative"
          style={{
            marginTop: "-140px",
            borderRadius: 20,
            backgroundColor: "#FFFFFF",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 25px 80px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.15)",
            overflow: "hidden",
          }}
        >
          {/* ── Top bar — app chrome (dark header like real app) ── */}
          <div
            className="px-5 md:px-6 py-2.5 flex items-center justify-between"
            style={{ backgroundColor: "#0F172A", borderBottom: "1px solid #1E293B" }}
          >
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-white tracking-tight">LabAxis</span>
              <span className="text-[10px] text-slate-400 font-medium">발주 대기 · 배치프로세싱</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <ListChecks className="h-3 w-3 text-blue-400" />
                <span className="text-[10px] font-semibold text-blue-400">확정 필요 4</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CircleCheck className="h-3 w-3 text-emerald-400" />
                <span className="text-[10px] font-semibold text-emerald-400">전환 가능 3</span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 text-amber-400" />
                <span className="text-[10px] font-semibold text-amber-400">검토 1</span>
              </div>
            </div>
          </div>

          {/* ── Body: Queue (left) + Rail (right) ── */}
          <div className="flex flex-col md:flex-row" style={{ backgroundColor: "#FFFFFF" }}>

            {/* Left: Queue list — light surface */}
            <div className="flex-1 md:border-r border-slate-200">
              {/* Tab bar */}
              <div className="px-5 py-2" style={{ borderBottom: "1px solid #F1F5F9" }}>
                <div className="flex items-center gap-1">
                  {["전체 8", "선택안 검토 4", "발주 가능 3", "보류 1"].map((tab, i) => (
                    <span key={tab}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-md cursor-default"
                      style={{
                        color: i === 0 ? "#1E293B" : "#94A3B8",
                        backgroundColor: i === 0 ? "#F1F5F9" : "transparent",
                      }}
                    >{tab}</span>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {QUEUE_ITEMS.map((item) => (
                  <div key={item.id}
                    className="px-5 py-3.5 cursor-default"
                    style={{ backgroundColor: item.selected ? "#F8FAFC" : "#FFFFFF" }}
                  >
                    {/* Status badges — light semantic */}
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: BADGE[item.statusColor].bg,
                          color: BADGE[item.statusColor].text,
                          border: `1px solid ${BADGE[item.statusColor].border}`,
                        }}
                      >{item.statusLabel}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: BADGE.emerald.bg,
                          color: BADGE.emerald.text,
                          border: `1px solid ${BADGE.emerald.border}`,
                        }}
                      >{item.approvalLabel}</span>
                      {item.blockerType && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-0.5"
                          style={{
                            backgroundColor: BADGE.amber.bg,
                            color: BADGE.amber.text,
                            border: `1px solid ${BADGE.amber.border}`,
                          }}
                        >
                          <AlertTriangle className="h-2.5 w-2.5" />{item.blockerType}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 ml-auto">{item.daysAgo}일 전</span>
                    </div>

                    {/* Title + meta */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold leading-snug truncate"
                          style={{ color: item.selected ? "#0F172A" : "#334155" }}
                        >{item.title}</p>
                        <p className="text-[11px] text-slate-400 truncate mb-2">{item.summary}</p>

                        {item.blockerReason && (
                          <p className="text-[11px] text-amber-600 leading-snug mb-1.5">
                            막힘: {item.blockerReason}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className={`text-[11px] flex items-center gap-0.5 ${item.aiColor === "emerald" ? "text-emerald-600" : "text-amber-600"}`}>
                            <Sparkles className="h-3 w-3" />{item.aiLabel}
                          </span>
                          <span className="text-[11px] text-emerald-600 flex items-center gap-0.5">
                            <Truck className="h-3 w-3" />회신 {item.replies}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-800">{item.price}</span>
                          <span className="text-[10px] text-slate-400">추천: {item.recommended}</span>
                        </div>
                      </div>

                      {/* Row CTA */}
                      <button className="text-[11px] font-semibold px-3.5 py-1.5 rounded-lg flex items-center gap-1 whitespace-nowrap flex-shrink-0 mt-1"
                        style={{
                          backgroundColor: item.ctaPrimary ? "#2563EB" : "transparent",
                          color: item.ctaPrimary ? "#FFFFFF" : "#475569",
                          border: item.ctaPrimary ? "none" : "1px solid #E2E8F0",
                        }}>
                        {item.ctaLabel}<ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="px-5 py-2.5 text-center" style={{ backgroundColor: "#F8FAFC" }}>
                  <span className="text-[11px] text-slate-400">+ 5건 더 보기</span>
                </div>
              </div>
            </div>

            {/* Right: Rail — AI 선택안 on light surface */}
            <div className="md:w-[320px] flex-shrink-0 hidden md:block" style={{ backgroundColor: "#FAFBFC" }}>
              {/* Selected item header */}
              <div className="px-5 py-3" style={{ borderBottom: "1px solid #F1F5F9" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: BADGE.emerald.bg, color: BADGE.emerald.text, border: `1px solid ${BADGE.emerald.border}` }}
                  >발주 전환 가능</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: BADGE.emerald.bg, color: BADGE.emerald.text, border: `1px solid ${BADGE.emerald.border}` }}
                  >외부 승인 완료</span>
                </div>
                <p className="text-[12px] font-semibold text-slate-800 truncate">PCR 튜브 (0.2mL) 회신 완료</p>
                <p className="text-[11px] text-slate-400 truncate">PCR Tubes 0.2mL, Flat Cap, 1000ea/pk</p>
              </div>

              {/* AI section label */}
              <div className="px-4 pt-2.5 pb-1">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">AI 선택안</span>
                </div>
              </div>

              {/* Options */}
              <div className="divide-y divide-slate-100">
                {RAIL_OPTIONS.map((opt) => (
                  <div key={opt.supplier}
                    className="px-4 py-3"
                    style={{ backgroundColor: opt.selected ? "#FFFFFF" : "#FAFBFC" }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                          style={{
                            backgroundColor: opt.selected ? "#EFF6FF" : "#F1F5F9",
                            color: opt.selected ? "#2563EB" : "#94A3B8",
                          }}>{opt.level}</span>
                        <span className="text-[12px] font-medium"
                          style={{ color: opt.selected ? "#1E293B" : "#94A3B8" }}>{opt.supplier}</span>
                        {opt.selected && <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />}
                      </div>
                      <span className="text-[12px] font-semibold"
                        style={{ color: opt.selected ? "#1E293B" : "#94A3B8" }}>{opt.price}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#F1F5F9", color: "#64748B", border: "1px solid #E2E8F0" }}>납기 {opt.lead}</span>
                      {opt.tags.slice(0, 2).map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#F1F5F9", color: "#64748B", border: "1px solid #E2E8F0" }}>{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Rail CTA */}
              <div className="px-4 py-3.5" style={{ borderTop: "1px solid #F1F5F9" }}>
                <button className="w-full text-[12px] font-semibold px-4 py-2.5 rounded-lg flex items-center justify-center gap-1.5 text-white"
                  style={{ backgroundColor: "#2563EB" }}>
                  발주 전환 시작 <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <p className="text-[10px] text-center mt-2 text-slate-400">
                  선택안 확정 → PO 생성 → 공급사 발송
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
