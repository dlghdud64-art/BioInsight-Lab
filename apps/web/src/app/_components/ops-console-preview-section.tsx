"use client";

import {
  ArrowRight, CheckCircle2, Sparkles, AlertTriangle,
  ListChecks, CircleCheck, Clock, Truck, ChevronRight,
} from "lucide-react";

/*
 * ── Product Proof — 발주 전환 큐 실제 구현 기반 축약 ──────────────
 *  원칙: 현재 구현 화면의 naming/state/button을 그대로 사용
 *  실제 앱에 없는 구조, 상태, 액션을 추가하지 않음
 *  decorative composition이 아니라 현재 제품의 compressed proof
 *
 *  Visual layer model:
 *   Hero field (#041A3E cobalt) ← ends above
 *   Proof band (#0A0F18 blue-black slate) ← independent layer start
 *     └ Mockup frame (1px border + top highlight, overlap into hero)
 *       └ Internal UI (cool charcoal #131A24 base)
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

/* ── Semantic badge palette — restrained, legible on charcoal ── */
const BADGE = {
  emerald: "text-emerald-300 border-emerald-500/30",
  blue: "text-blue-300 border-blue-500/30",
  amber: "text-amber-300 border-amber-500/30",
} as const;

/* Color tokens for internal UI */
const C = {
  /* Mockup internal surfaces */
  base: "#131A24",         /* cool charcoal — NOT pure black */
  elevated: "#18212E",     /* card/row lifted surface */
  sunken: "#0E141D",       /* KPI strip, recessed areas */
  divider: "#1E2A3A",      /* borders inside mockup */
  dividerSubtle: "#1A2535", /* lighter separator */

  /* Text hierarchy — stronger contrast than before */
  text1: "#E8ECF2",        /* primary — near-white with blue tint */
  text2: "#B0BDD0",        /* secondary */
  text3: "#6B7D95",        /* tertiary / muted */
  text4: "#4A5C72",        /* quaternary / metadata */

  /* Accent — restrained workbench blue, NOT hero azure */
  accent: "#4B8ADB",       /* softer than #2563EB, workbench-appropriate */
  accentMuted: "#3A6FB5",  /* even softer for secondary actions */
} as const;

export function OpsConsolePreviewSection() {
  return (
    /* ═══ Proof band — independent layer, darker blue-black slate ═══ */
    <section
      className="relative"
      style={{
        backgroundColor: "#0A0F18",
        /* No borderTop — the mockup overlap creates the visual seam */
      }}
    >
      {/* Subtle gradient at top to mark new layer start */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent 10%, rgba(100,150,210,0.15) 50%, transparent 90%)" }}
      />

      <div className="max-w-[1100px] mx-auto px-4 md:px-6 pb-10 md:pb-16">

        {/* ── Mockup frame — overlaps hero-proof boundary ── */}
        <div
          className="relative rounded-xl overflow-hidden"
          style={{
            marginTop: "-100px",  /* overlap hero by 100px */
            backgroundColor: C.base,
            border: `1px solid ${C.divider}`,
            boxShadow: "0 12px 48px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.3)",
          }}
        >
          {/* Top highlight — thin luminous edge to separate from hero */}
          <div
            className="absolute top-0 left-0 right-0 h-px z-10"
            style={{
              background: "linear-gradient(90deg, transparent 5%, rgba(140,180,230,0.25) 30%, rgba(140,180,230,0.35) 50%, rgba(140,180,230,0.25) 70%, transparent 95%)",
            }}
          />

          {/* Section title — inside mockup frame */}
          <div className="px-5 pt-5 pb-3 md:pt-6 md:pb-4 text-center">
            <h2 className="text-sm md:text-base font-bold tracking-tight" style={{ color: C.text1 }}>
              발주 전환 큐 — 선택안 확정에서 발주 준비까지
            </h2>
          </div>

          {/* ── KPI Strip — recessed surface ── */}
          <div
            className="px-5 py-2.5 flex flex-wrap items-center gap-4"
            style={{ backgroundColor: C.sunken, borderTop: `1px solid ${C.dividerSubtle}`, borderBottom: `1px solid ${C.dividerSubtle}` }}
          >
            <span className="text-[9px] font-bold uppercase tracking-wider mr-1" style={{ color: C.text4 }}>전환 큐 현황</span>
            <div className="flex items-center gap-1.5">
              <ListChecks className="h-3 w-3 text-blue-400" />
              <span className="text-[11px] font-semibold text-blue-300">선택안 확정 필요 4건</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CircleCheck className="h-3 w-3 text-emerald-400" />
              <span className="text-[11px] font-semibold text-emerald-300">발주 전환 가능 3건</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-amber-400" />
              <span className="text-[11px] font-semibold text-amber-300">추가 검토 필요 1건</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" style={{ color: C.text4 }} />
              <span className="text-[11px]" style={{ color: C.text4 }}>보류 1건</span>
            </div>
          </div>

          {/* ── Body: Queue + Rail ── */}
          <div className="flex flex-col md:flex-row">

            {/* Left: Queue rows */}
            <div className="flex-1 md:border-r" style={{ borderColor: C.divider }}>
              <div className="px-4 py-2" style={{ borderBottom: `1px solid ${C.dividerSubtle}` }}>
                <div className="flex items-center gap-3">
                  {["전체 8", "선택안 검토 4", "발주 가능 3", "보류 1"].map((tab, i) => (
                    <span key={tab}
                      className="text-[10px] font-medium px-2 py-1 rounded cursor-default"
                      style={{
                        color: i === 0 ? C.text1 : C.text3,
                        backgroundColor: i === 0 ? C.elevated : "transparent",
                      }}
                    >{tab}</span>
                  ))}
                </div>
              </div>

              <div className="divide-y" style={{ borderColor: C.dividerSubtle }}>
                {QUEUE_ITEMS.map((item) => (
                  <div key={item.id}
                    className="px-4 py-3 cursor-default"
                    style={{ backgroundColor: item.selected ? C.elevated : "transparent" }}
                  >
                    {/* Status badges */}
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${BADGE[item.statusColor]}`}
                        style={{ backgroundColor: "transparent" }}
                      >{item.statusLabel}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border ${BADGE.emerald}`}
                        style={{ backgroundColor: "transparent" }}
                      >{item.approvalLabel}</span>
                      {item.blockerType && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-300 flex items-center gap-0.5"
                          style={{ backgroundColor: "transparent" }}
                        >
                          <AlertTriangle className="h-2 w-2" />{item.blockerType}
                        </span>
                      )}
                      <span className="text-[9px] ml-auto" style={{ color: C.text4 }}>{item.daysAgo}일 전</span>
                    </div>

                    {/* Title + meta */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold leading-snug truncate"
                          style={{ color: item.selected ? C.text1 : C.text2 }}
                        >{item.title}</p>
                        <p className="text-[10px] truncate mb-1.5" style={{ color: C.text4 }}>{item.summary}</p>

                        {item.blockerReason && (
                          <p className="text-[10px] text-amber-400/70 leading-snug mb-1">
                            막힘: {item.blockerReason}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] flex items-center gap-0.5 ${item.aiColor === "emerald" ? "text-emerald-300" : "text-amber-300"}`}>
                            <Sparkles className="h-2.5 w-2.5" />{item.aiLabel}
                          </span>
                          <span className="text-[10px] text-emerald-300 flex items-center gap-0.5">
                            <Truck className="h-2.5 w-2.5" />회신 {item.replies}
                          </span>
                          <span className="text-[10px] font-medium" style={{ color: C.text1 }}>{item.price}</span>
                          <span className="text-[9px]" style={{ color: C.text4 }}>추천: {item.recommended}</span>
                        </div>
                      </div>

                      {/* Row CTA — restrained workbench blue */}
                      <button className="text-[10px] font-semibold px-3 py-1.5 rounded-md flex items-center gap-1 whitespace-nowrap flex-shrink-0 mt-1"
                        style={{
                          backgroundColor: item.ctaPrimary ? C.accent : "transparent",
                          color: item.ctaPrimary ? "#FFFFFF" : C.text2,
                          border: item.ctaPrimary ? "none" : `1px solid ${C.divider}`,
                        }}>
                        {item.ctaLabel}<ChevronRight className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="px-4 py-2 text-center" style={{ backgroundColor: C.sunken }}>
                  <span className="text-[10px]" style={{ color: C.text4 }}>+ 5건 더 보기</span>
                </div>
              </div>
            </div>

            {/* Right: Rail — AI 3옵션 */}
            <div className="md:w-[300px] flex-shrink-0 hidden md:block">
              <div className="px-4 py-2.5" style={{ borderBottom: `1px solid ${C.dividerSubtle}` }}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${BADGE.emerald}`}>발주 전환 가능</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border ${BADGE.emerald}`}>외부 승인 완료</span>
                </div>
                <p className="text-[11px] font-semibold truncate" style={{ color: C.text1 }}>PCR 튜브 (0.2mL) 회신 완료</p>
                <p className="text-[10px] truncate" style={{ color: C.text4 }}>PCR Tubes 0.2mL, Flat Cap, 1000ea/pk</p>
              </div>

              <div className="px-3 pt-2 pb-1">
                <div className="flex items-center gap-1 mb-2">
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
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: opt.selected ? C.divider : C.dividerSubtle,
                            color: opt.selected ? C.text2 : C.text3,
                          }}>{opt.level}</span>
                        <span className="text-[11px] font-medium"
                          style={{ color: opt.selected ? C.text1 : C.text3 }}>{opt.supplier}</span>
                        {opt.selected && <CheckCircle2 className="h-3 w-3" style={{ color: C.text3 }} />}
                      </div>
                      <span className="text-[11px] font-semibold"
                        style={{ color: opt.selected ? C.text1 : C.text3 }}>{opt.price}</span>
                    </div>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: C.sunken, color: C.text3, border: `1px solid ${C.dividerSubtle}` }}>납기 {opt.lead}</span>
                      {opt.tags.slice(0, 2).map((t) => (
                        <span key={t} className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: C.sunken, color: C.text3, border: `1px solid ${C.dividerSubtle}` }}>{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Rail CTA — restrained accent */}
              <div className="px-3 py-3" style={{ borderTop: `1px solid ${C.dividerSubtle}` }}>
                <button className="w-full text-[11px] font-semibold px-4 py-2 rounded-md flex items-center justify-center gap-1.5"
                  style={{ backgroundColor: C.accent, color: "#FFFFFF" }}>
                  발주 전환 시작 <ArrowRight className="h-3 w-3" />
                </button>
                <p className="text-[9px] text-center mt-1.5" style={{ color: C.text4 }}>
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
