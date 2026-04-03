"use client";

import {
  ArrowRight, CheckCircle2, Sparkles, AlertTriangle,
  ListChecks, CircleCheck, Clock, Truck, ChevronRight,
} from "lucide-react";

/*
 * ── Product Proof — Hero-attached Floating Product Object ─────────
 *
 *  Visual layer model:
 *   Hero field (#041A3E cobalt)
 *     └ headline → CTA → [hero ends]
 *   Proof band (#0C1220 neutral dark slate) ← receives overflow
 *     └ Mockup frame (negative margin pulls it UP into hero zone)
 *       └ Internal UI (cool charcoal #141C28 base)
 *
 *  핵심:
 *  - mockup은 hero CTA 바로 아래에 보여야 함 (section content가 아님)
 *  - hero 경계를 80~120px 걸쳐서 floating product object로 인식
 *  - 내부는 cool charcoal, hero의 cobalt blue와 확실히 다른 톤
 *  - border/frame/shadow로 배경과 분리
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

/* Semantic badges — clean border-only on charcoal */
const BADGE = {
  emerald: "text-emerald-300 border-emerald-500/30",
  blue: "text-blue-300 border-blue-500/30",
  amber: "text-amber-300 border-amber-500/30",
} as const;

/* Internal color tokens — cool charcoal palette */
const C = {
  base: "#141C28",
  elevated: "#1A2436",
  sunken: "#0F1620",
  divider: "#222E40",
  dividerSubtle: "#1C2838",
  text1: "#EAF0F6",
  text2: "#B4C2D4",
  text3: "#728DA8",
  text4: "#506580",
  accent: "#4B8ADB",
} as const;

export function OpsConsolePreviewSection() {
  return (
    /*
     * ═══ Proof band — neutral slate-charcoal, far from hero cobalt ═══
     * Hero (#041A3E cobalt) → Proof band (#0E1118 near-black neutral slate)
     * Mockup overlaps 140px into hero → hero의 제품 주인공
     */
    <section
      className="relative"
      style={{ backgroundColor: "#0E1118" }}
    >
      <div
        className="relative mx-auto px-3 md:px-4 pb-10 md:pb-14"
        style={{ maxWidth: 1180 }}
      >
        {/*
         * ── Product Mockup Frame ──
         * -140px overlap into hero — mockup starts right after CTA
         * Width ~1180px = hero content의 ~135%, 큰 제품 오브젝트
         */}
        <div
          className="relative"
          style={{
            marginTop: "-140px",
            borderRadius: 22,
            backgroundColor: C.base,
            border: `1px solid rgba(255,255,255,0.08)`,
            boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 8px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(160,200,255,0.06)",
            overflow: "hidden",
          }}
        >
          {/* Top highlight — strong luminous edge, hero와의 분리 선언 */}
          <div
            className="absolute top-0 left-0 right-0 z-10"
            style={{
              height: 2,
              background: "linear-gradient(90deg, transparent 2%, rgba(140,190,255,0.35) 20%, rgba(180,215,255,0.55) 50%, rgba(140,190,255,0.35) 80%, transparent 98%)",
            }}
          />

          {/* ── KPI Strip — recessed top bar ── */}
          <div
            className="px-5 md:px-6 py-3 flex flex-wrap items-center gap-3 md:gap-5"
            style={{ backgroundColor: C.sunken, borderBottom: `1px solid ${C.dividerSubtle}` }}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.text4 }}>전환 큐 현황</span>
            <div className="flex items-center gap-1.5">
              <ListChecks className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-[12px] font-semibold text-blue-300">선택안 확정 필요 4건</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CircleCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[12px] font-semibold text-emerald-300">발주 전환 가능 3건</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[12px] font-semibold text-amber-300">추가 검토 필요 1건</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" style={{ color: C.text4 }} />
              <span className="text-[12px]" style={{ color: C.text4 }}>보류 1건</span>
            </div>
          </div>

          {/* ── Body: Queue + Rail ── */}
          <div className="flex flex-col md:flex-row">

            {/* Left: Queue rows */}
            <div className="flex-1 md:border-r" style={{ borderColor: C.divider }}>
              {/* Tab bar */}
              <div className="px-5 py-2.5" style={{ borderBottom: `1px solid ${C.dividerSubtle}` }}>
                <div className="flex items-center gap-3">
                  {["전체 8", "선택안 검토 4", "발주 가능 3", "보류 1"].map((tab, i) => (
                    <span key={tab}
                      className="text-[11px] font-medium px-2.5 py-1 rounded cursor-default"
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
                    className="px-5 py-3.5 cursor-default"
                    style={{ backgroundColor: item.selected ? C.elevated : "transparent" }}
                  >
                    {/* Status badges */}
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${BADGE[item.statusColor]}`}>{item.statusLabel}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded border ${BADGE.emerald}`}>{item.approvalLabel}</span>
                      {item.blockerType && (
                        <span className="text-[10px] px-2 py-0.5 rounded border border-amber-500/30 text-amber-300 flex items-center gap-0.5">
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
                          <p className="text-[11px] text-amber-400/70 leading-snug mb-1.5">
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
                          <span className="text-[11px] font-medium" style={{ color: C.text1 }}>{item.price}</span>
                          <span className="text-[10px]" style={{ color: C.text4 }}>추천: {item.recommended}</span>
                        </div>
                      </div>

                      {/* Row CTA */}
                      <button className="text-[11px] font-semibold px-3.5 py-1.5 rounded-md flex items-center gap-1 whitespace-nowrap flex-shrink-0 mt-1"
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

            {/* Right: Rail — AI 3옵션 */}
            <div className="md:w-[320px] flex-shrink-0 hidden md:block">
              <div className="px-5 py-3" style={{ borderBottom: `1px solid ${C.dividerSubtle}` }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${BADGE.emerald}`}>발주 전환 가능</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded border ${BADGE.emerald}`}>외부 승인 완료</span>
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
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: opt.selected ? C.divider : C.dividerSubtle,
                            color: opt.selected ? C.text2 : C.text3,
                          }}>{opt.level}</span>
                        <span className="text-[12px] font-medium"
                          style={{ color: opt.selected ? C.text1 : C.text3 }}>{opt.supplier}</span>
                        {opt.selected && <CheckCircle2 className="h-3.5 w-3.5" style={{ color: C.text3 }} />}
                      </div>
                      <span className="text-[12px] font-semibold"
                        style={{ color: opt.selected ? C.text1 : C.text3 }}>{opt.price}</span>
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
                <button className="w-full text-[12px] font-semibold px-4 py-2.5 rounded-lg flex items-center justify-center gap-1.5"
                  style={{ backgroundColor: C.accent, color: "#FFFFFF" }}>
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
