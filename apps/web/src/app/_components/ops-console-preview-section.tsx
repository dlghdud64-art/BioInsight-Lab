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
 * ────────────────────────────────────────────────────────────────────
 */

// 실제 purchases page CONVERSION_STATUS_MAP / NEXT_ACTION_MAP에서 그대로 가져온 데이터
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
    ctaLabel: "발주 전환 준비",  // NEXT_ACTION_MAP.prepare_po.ctaLabel
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
    ctaLabel: "선택안 검토",  // NEXT_ACTION_MAP.review_selection.ctaLabel
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

// 선택된 항목(pe-001)의 AI 3옵션 — 실제 구현 그대로
const RAIL_OPTIONS = [
  {
    level: "추천",  // recommendationLevel: primary → "추천"
    supplier: "BioKorea",
    price: "₩185,000",
    lead: "3일",
    tags: ["최저가", "납기 최단", "기존 거래처"],
    selected: true,
  },
  {
    level: "대체",  // recommendationLevel: alternate → "대체"
    supplier: "LabSource",
    price: "₩198,000",
    lead: "5일",
    tags: ["MOQ 5팩 이상", "단가 7% 높음"],
    selected: false,
  },
  {
    level: "보수",  // recommendationLevel: conservative → "보수"
    supplier: "SciSupply",
    price: "₩210,000",
    lead: "2일",
    tags: ["납기 2일", "긴급 시 유리"],
    selected: false,
  },
];

const BADGE = {
  emerald: "bg-emerald-600/10 text-emerald-400 border-emerald-600/25",
  blue: "bg-blue-600/10 text-blue-400 border-blue-600/25",
  amber: "bg-amber-600/10 text-amber-400 border-amber-600/25",
} as const;

export function OpsConsolePreviewSection() {
  return (
    <section className="py-10 md:py-16" style={{ backgroundColor: "#060E1C", borderTop: "1px solid #0A1628" }}>
      <div className="max-w-[1100px] mx-auto px-4 md:px-6">

        {/* 제목 1줄만 */}
        <div className="mb-5 md:mb-6 text-center">
          <h2 className="text-base md:text-lg font-bold text-white tracking-tight">
            발주 전환 큐 — 선택안 확정에서 발주 준비까지
          </h2>
        </div>

        {/* Console panel — hero와 분리되는 lifted surface */}
        <div className="rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)]" style={{ backgroundColor: "#0B1929", border: "1px solid #1A2D48" }}>

          {/* ── KPI Strip — 실제 구현 KPI 그대로 ── */}
          <div className="px-5 py-3 flex flex-wrap items-center gap-4" style={{ backgroundColor: "#071222", borderBottom: "1px solid #0F1F35" }}>
            <span className="text-[9px] font-bold uppercase tracking-wider mr-1" style={{ color: "#4A5E78" }}>전환 큐 현황</span>
            <div className="flex items-center gap-1.5">
              <ListChecks className="h-3 w-3 text-blue-500" />
              <span className="text-[11px] font-semibold text-blue-400">선택안 확정 필요 4건</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CircleCheck className="h-3 w-3 text-emerald-500" />
              <span className="text-[11px] font-semibold text-emerald-400">발주 전환 가능 3건</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              <span className="text-[11px] font-semibold text-amber-400">추가 검토 필요 1건</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-slate-500" />
              <span className="text-[11px] text-slate-500">보류 1건</span>
            </div>
          </div>

          {/* ── Body: Queue + Rail ── */}
          <div className="flex flex-col md:flex-row">

            {/* Left: Queue rows */}
            <div className="flex-1 md:border-r" style={{ borderColor: "#162A42" }}>
              <div className="px-4 py-2" style={{ borderBottom: "1px solid #0F1F35" }}>
                <div className="flex items-center gap-3">
                  {["전체 8", "선택안 검토 4", "발주 가능 3", "보류 1"].map((tab, i) => (
                    <span key={tab}
                      className={`text-[10px] font-medium px-2 py-1 rounded cursor-default ${i === 0 ? "text-slate-200" : "text-slate-500"}`}
                      style={i === 0 ? { backgroundColor: "#142840" } : undefined}
                    >{tab}</span>
                  ))}
                </div>
              </div>

              <div className="divide-y" style={{ borderColor: "#0F1F35" }}>
                {QUEUE_ITEMS.map((item) => (
                  <div key={item.id}
                    className="px-4 py-3 cursor-default"
                    style={{ backgroundColor: item.selected ? "rgba(37,99,235,0.04)" : "transparent" }}
                  >
                    {/* Status badges — 실제 구현과 동일한 badge text */}
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${BADGE[item.statusColor]}`}>{item.statusLabel}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border ${BADGE.emerald}`}>{item.approvalLabel}</span>
                      {item.blockerType && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded border bg-amber-600/10 text-amber-400 border-amber-600/20 flex items-center gap-0.5">
                          <AlertTriangle className="h-2 w-2" />{item.blockerType}
                        </span>
                      )}
                      <span className="text-[9px] text-slate-600 ml-auto">{item.daysAgo}일 전</span>
                    </div>

                    {/* Title + meta */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className={`text-[12px] font-semibold leading-snug truncate ${item.selected ? "text-white" : "text-slate-300"}`}>{item.title}</p>
                        <p className="text-[10px] text-slate-500 truncate mb-1.5">{item.summary}</p>

                        {item.blockerReason && (
                          <p className="text-[10px] text-amber-400/70 leading-snug mb-1">
                            막힘: {item.blockerReason}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] flex items-center gap-0.5 ${item.aiColor === "emerald" ? "text-emerald-400" : "text-amber-400"}`}>
                            <Sparkles className="h-2.5 w-2.5" />{item.aiLabel}
                          </span>
                          <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                            <Truck className="h-2.5 w-2.5" />회신 {item.replies}
                          </span>
                          <span className="text-[10px] text-slate-200 font-medium">{item.price}</span>
                          <span className="text-[9px] text-slate-500">추천: {item.recommended}</span>
                        </div>
                      </div>

                      {/* Row CTA — 실제 구현 ctaLabel 그대로 */}
                      <button className={`text-[10px] font-semibold px-3 py-1.5 rounded-md flex items-center gap-1 whitespace-nowrap flex-shrink-0 mt-1 ${
                        item.ctaPrimary ? "text-white" : "text-slate-300"
                      }`} style={{
                        backgroundColor: item.ctaPrimary ? "#2563EB" : "transparent",
                        border: item.ctaPrimary ? "none" : "1px solid #1E3A5C",
                        boxShadow: item.ctaPrimary ? "0 0 12px rgba(37,99,235,0.2)" : "none",
                      }}>
                        {item.ctaLabel}<ChevronRight className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="px-4 py-2 text-center" style={{ backgroundColor: "rgba(7,18,34,0.5)" }}>
                  <span className="text-[10px] text-slate-600">+ 5건 더 보기</span>
                </div>
              </div>
            </div>

            {/* Right: Rail — AI 3옵션, 실제 구현 구조 그대로 */}
            <div className="md:w-[300px] flex-shrink-0 hidden md:block">
              <div className="px-4 py-2.5" style={{ borderBottom: "1px solid #0F1F35" }}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${BADGE.emerald}`}>발주 전환 가능</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border ${BADGE.emerald}`}>외부 승인 완료</span>
                </div>
                <p className="text-[11px] font-semibold text-white truncate">PCR 튜브 (0.2mL) 회신 완료</p>
                <p className="text-[10px] text-slate-500 truncate">PCR Tubes 0.2mL, Flat Cap, 1000ea/pk</p>
              </div>

              <div className="px-3 pt-2 pb-1">
                <div className="flex items-center gap-1 mb-2">
                  <Sparkles className="h-3 w-3" style={{ color: "#60A5FA" }} />
                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#4A5E78" }}>AI 선택안</span>
                </div>
              </div>

              <div className="divide-y" style={{ borderColor: "#0F1F35" }}>
                {RAIL_OPTIONS.map((opt) => (
                  <div key={opt.supplier}
                    className="px-3 py-2.5"
                    style={{ backgroundColor: opt.selected ? "rgba(37,99,235,0.06)" : "transparent" }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: opt.selected ? "#1E3A5C" : "#142840",
                            color: opt.selected ? "#60A5FA" : "#5A6A7E",
                          }}>{opt.level}</span>
                        <span className={`text-[11px] font-medium ${opt.selected ? "text-white" : ""}`}
                          style={{ color: opt.selected ? undefined : "#8A99AF" }}>{opt.supplier}</span>
                        {opt.selected && <CheckCircle2 className="h-3 w-3" style={{ color: "#60A5FA" }} />}
                      </div>
                      <span className={`text-[11px] font-semibold ${opt.selected ? "text-white" : ""}`}
                        style={{ color: opt.selected ? undefined : "#6A7A8E" }}>{opt.price}</span>
                    </div>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: "#0D1E35", color: "#5A6A7E", border: "1px solid #1A2D48" }}>납기 {opt.lead}</span>
                      {opt.tags.slice(0, 2).map((t) => (
                        <span key={t} className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: "#0D1E35", color: "#5A6A7E", border: "1px solid #1A2D48" }}>{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Rail CTA — railCtaLabel 그대로 */}
              <div className="px-3 py-3" style={{ borderTop: "1px solid #0F1F35" }}>
                <button className="w-full text-[11px] font-semibold px-4 py-2 rounded-md flex items-center justify-center gap-1.5"
                  style={{ backgroundColor: "#2563EB", color: "#FFFFFF", boxShadow: "0 0 16px rgba(37,99,235,0.25)" }}>
                  발주 전환 시작 <ArrowRight className="h-3 w-3" />
                </button>
                <p className="text-[9px] text-center mt-1.5" style={{ color: "#4A5E78" }}>
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
