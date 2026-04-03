"use client";

import {
  ArrowRight, CheckCircle2, Sparkles, AlertTriangle,
  ListChecks, CircleCheck, Clock, Truck, ChevronRight,
} from "lucide-react";

/*
 * ── Product Proof — Lifted Dark Mockup on Cobalt Hero ─────────────
 *
 *  Color hierarchy (명도 상향):
 *   Hero field    = cobalt (#0A2248) — 이전보다 밝아짐
 *   Proof band    = lifted dark (#141B28) — 어캄캄하지 않은 slate
 *   Mockup frame  = dark panel (#1C2536) — hero보다 확실히 밝은 slate
 *   Internal UI   = lifted slate (#222D40 base) — 읽기 쉬운 명도
 *
 *  원칙: 갑자기 white가 아니라 dark theme 유지하되 전체 명도를 올려
 *  hero 배경과의 차이를 자연스럽게 확보
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

/* Badge — lifted dark semantic (밝아진 dark theme용) */
const BADGE = {
  emerald: { bg: "rgba(16,185,129,0.12)", text: "#6EE7B7", border: "rgba(16,185,129,0.25)" },
  blue:    { bg: "rgba(59,130,246,0.12)", text: "#93C5FD", border: "rgba(59,130,246,0.25)" },
  amber:   { bg: "rgba(245,158,11,0.12)", text: "#FCD34D", border: "rgba(245,158,11,0.25)" },
} as const;

/* Lifted dark color tokens — 전체 명도 상향 */
const C = {
  /* mockup 내부 surfaces */
  base: "#1C2536",       /* 기존 #141C28 → 올림 */
  elevated: "#243044",   /* selected row / active state */
  sunken: "#161E2C",     /* recessed: top bar, footer */
  divider: "#2A3750",    /* 기존 #222E40 → 올림 */
  dividerSubtle: "#243040",

  /* 텍스트 — 대비 확보 */
  text1: "#F1F5F9",      /* 거의 white */
  text2: "#CBD5E1",      /* slate-300 */
  text3: "#8296B0",      /* 올린 slate */
  text4: "#5E7490",      /* muted */

  /* accent */
  accent: "#3B82F6",     /* standard blue-500 */
  accentSoft: "#2563EB",
} as const;

export function OpsConsolePreviewSection() {
  return (
    <section
      className="relative"
      style={{ backgroundColor: "#141B28" }}
    >
      <div
        className="relative mx-auto px-3 md:px-4 pb-10 md:pb-14"
        style={{ maxWidth: 1180 }}
      >
        {/* ── Product Mockup Frame ── */}
        <div
          className="relative"
          style={{
            marginTop: "-120px",
            borderRadius: 20,
            backgroundColor: C.base,
            border: `1px solid ${C.divider}`,
            boxShadow: "0 24px 80px rgba(0,0,0,0.45), 0 8px 24px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.06)",
            overflow: "hidden",
          }}
        >
          {/* Top highlight */}
          <div
            className="absolute top-0 left-0 right-0 z-10"
            style={{
              height: 1,
              background: "linear-gradient(90deg, transparent 5%, rgba(160,200,255,0.2) 25%, rgba(180,215,255,0.35) 50%, rgba(160,200,255,0.2) 75%, transparent 95%)",
            }}
          />

          {/* ── App chrome top bar ── */}
          <div
            className="px-5 md:px-6 py-2.5 flex items-center justify-between"
            style={{ backgroundColor: C.sunken, borderBottom: `1px solid ${C.dividerSubtle}` }}
          >
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold tracking-tight" style={{ color: C.text1 }}>LabAxis</span>
              <span className="text-[10px] font-medium" style={{ color: C.text4 }}>발주 대기 · 배치프로세싱</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <ListChecks className="h-3 w-3 text-blue-400" />
                <span className="text-[10px] font-semibold text-blue-300">확정 필요 4</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CircleCheck className="h-3 w-3 text-emerald-400" />
                <span className="text-[10px] font-semibold text-emerald-300">전환 가능 3</span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 text-amber-400" />
                <span className="text-[10px] font-semibold text-amber-300">검토 1</span>
              </div>
            </div>
          </div>

          {/* ── Body: Queue + Rail ── */}
          <div className="flex flex-col md:flex-row">

            {/* Left: Queue */}
            <div className="flex-1 md:border-r" style={{ borderColor: C.divider }}>
              {/* Tab bar */}
              <div className="px-5 py-2.5" style={{ borderBottom: `1px solid ${C.dividerSubtle}` }}>
                <div className="flex items-center gap-1">
                  {["전체 8", "선택안 검토 4", "발주 가능 3", "보류 1"].map((tab, i) => (
                    <span key={tab}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-md cursor-default"
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
                    className="px-5 py-3.5 cursor-default"
                    style={{ backgroundColor: item.selected ? C.elevated : C.base }}
                  >
                    {/* Badges */}
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
                      <span className="text-[10px] ml-auto" style={{ color: C.text4 }}>{item.daysAgo}일 전</span>
                    </div>

                    {/* Title + meta */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold leading-snug truncate"
                          style={{ color: item.selected ? C.text1 : C.text2 }}
                        >{item.title}</p>
                        <p className="text-[11px] truncate mb-2" style={{ color: C.text4 }}>{item.summary}</p>

                        {item.blockerReason && (
                          <p className="text-[11px] leading-snug mb-1.5" style={{ color: BADGE.amber.text }}>
                            막힘: {item.blockerReason}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className={`text-[11px] flex items-center gap-0.5 ${item.aiColor === "emerald" ? "text-emerald-300" : "text-amber-300"}`}>
                            <Sparkles className="h-3 w-3" />{item.aiLabel}
                          </span>
                          <span className="text-[11px] text-emerald-300 flex items-center gap-0.5">
                            <Truck className="h-3 w-3" />회신 {item.replies}
                          </span>
                          <span className="text-[11px] font-semibold" style={{ color: C.text1 }}>{item.price}</span>
                          <span className="text-[10px]" style={{ color: C.text4 }}>추천: {item.recommended}</span>
                        </div>
                      </div>

                      {/* Row CTA */}
                      <button className="text-[11px] font-semibold px-3.5 py-1.5 rounded-lg flex items-center gap-1 whitespace-nowrap flex-shrink-0 mt-1"
                        style={{
                          backgroundColor: item.ctaPrimary ? C.accent : "transparent",
                          color: item.ctaPrimary ? "#FFFFFF" : C.text2,
                          border: item.ctaPrimary ? "none" : `1px solid ${C.divider}`,
                        }}>
                        {item.ctaLabel}<ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="px-5 py-2.5 text-center" style={{ backgroundColor: C.sunken }}>
                  <span className="text-[11px]" style={{ color: C.text4 }}>+ 5건 더 보기</span>
                </div>
              </div>
            </div>

            {/* Right: Rail */}
            <div className="md:w-[320px] flex-shrink-0 hidden md:block" style={{ backgroundColor: "#1E2840" }}>
              <div className="px-5 py-3" style={{ borderBottom: `1px solid ${C.dividerSubtle}` }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: BADGE.emerald.bg, color: BADGE.emerald.text, border: `1px solid ${BADGE.emerald.border}` }}
                  >발주 전환 가능</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: BADGE.emerald.bg, color: BADGE.emerald.text, border: `1px solid ${BADGE.emerald.border}` }}
                  >외부 승인 완료</span>
                </div>
                <p className="text-[12px] font-semibold truncate" style={{ color: C.text1 }}>PCR 튜브 (0.2mL) 회신 완료</p>
                <p className="text-[11px] truncate" style={{ color: C.text4 }}>PCR Tubes 0.2mL, Flat Cap, 1000ea/pk</p>
              </div>

              <div className="px-4 pt-2.5 pb-1">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="h-3.5 w-3.5" style={{ color: C.text3 }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.text4 }}>AI 선택안</span>
                </div>
              </div>

              <div className="divide-y" style={{ borderColor: C.dividerSubtle }}>
                {RAIL_OPTIONS.map((opt) => (
                  <div key={opt.supplier}
                    className="px-4 py-3"
                    style={{ backgroundColor: opt.selected ? C.elevated : "transparent" }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                          style={{
                            backgroundColor: opt.selected ? "rgba(59,130,246,0.15)" : C.dividerSubtle,
                            color: opt.selected ? "#93C5FD" : C.text4,
                          }}>{opt.level}</span>
                        <span className="text-[12px] font-medium"
                          style={{ color: opt.selected ? C.text1 : C.text4 }}>{opt.supplier}</span>
                        {opt.selected && <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />}
                      </div>
                      <span className="text-[12px] font-semibold"
                        style={{ color: opt.selected ? C.text1 : C.text4 }}>{opt.price}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: C.sunken, color: C.text3, border: `1px solid ${C.dividerSubtle}` }}>납기 {opt.lead}</span>
                      {opt.tags.slice(0, 2).map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: C.sunken, color: C.text3, border: `1px solid ${C.dividerSubtle}` }}>{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Rail CTA */}
              <div className="px-4 py-3.5" style={{ borderTop: `1px solid ${C.dividerSubtle}` }}>
                <button className="w-full text-[12px] font-semibold px-4 py-2.5 rounded-lg flex items-center justify-center gap-1.5 text-white"
                  style={{ backgroundColor: C.accent }}>
                  발주 전환 시작 <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <p className="text-[10px] text-center mt-2" style={{ color: C.text4 }}>
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
