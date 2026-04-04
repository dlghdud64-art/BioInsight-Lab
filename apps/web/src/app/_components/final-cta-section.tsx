"use client";

import {
  PackageCheck, AlertTriangle, Clock, RotateCcw,
  MapPin, Thermometer, ChevronRight, ArrowRight,
} from "lucide-react";

/*
 * ── Support Proof Section ───────────────────────────────────────
 *  목업 2: 입고 반영과 재고 운영 (operations closure layer)
 *  hero 목업 1(발주 전환 큐)과 역할 분리:
 *    목업 1 = action (결정·확정·발주 준비)
 *    목업 2 = closure (입고·재고 truth·부족·재주문)
 * ────────────────────────────────────────────────────────────────
 */

/* ── Color tokens — proof용, 목업 1보다 약간 밝은 surface ── */
const C = {
  base: "#111D2F",
  elevated: "#1A2940",
  sunken: "#0D1724",
  divider: "#223350",
  dividerSubtle: "#1A2C42",
  text1: "#F8FAFC",
  text2: "#DAE4EE",
  text3: "#95ABBD",
  text4: "#708BA5",
  accent: "#3B82F6",
} as const;

const BADGE = {
  red:    { bg: "rgba(239,68,68,0.14)", text: "#FCA5A5", border: "rgba(239,68,68,0.3)" },
  amber:  { bg: "rgba(245,158,11,0.14)", text: "#FCD34D", border: "rgba(245,158,11,0.3)" },
  blue:   { bg: "rgba(59,130,246,0.14)", text: "#93C5FD", border: "rgba(59,130,246,0.3)" },
  emerald:{ bg: "rgba(16,185,129,0.14)", text: "#6EE7B7", border: "rgba(16,185,129,0.3)" },
} as const;

const INVENTORY_ITEMS = [
  {
    id: "inv-001",
    title: "Gibco FBS (500mL)",
    status: "만료 임박",
    statusColor: "red" as const,
    sub: "남은 12일 · 잔량 2병",
    action: "재주문 검토",
    selected: true,
  },
  {
    id: "inv-002",
    title: "DMEM Medium (500mL)",
    status: "재주문 필요",
    statusColor: "amber" as const,
    sub: "안전재고 미만 · 잔량 1병",
    action: "재주문 검토",
    selected: false,
  },
  {
    id: "inv-003",
    title: "PBS Solution (1L)",
    status: "입고 미처리",
    statusColor: "blue" as const,
    sub: "입고 3건 · Lot 정보 미입력",
    action: "입고 반영",
    selected: false,
  },
];

const RAIL_DETAIL = {
  product: "Gibco FBS (500mL)",
  lot: "LOT-2026-0387",
  expiry: "2026-04-16",
  location: "냉장고 A-03",
  remaining: "2병 (500mL × 2)",
  lastReceived: "2026-03-22",
};

function InventoryOpsMockupContent() {
  return (
    <div className="flex flex-col md:flex-row" style={{ backgroundColor: C.base }}>

      {/* Left: Inventory list */}
      <div className="flex-1 md:border-r" style={{ borderColor: C.divider }}>
        {/* KPI strip — 모바일 2x2, 데스크톱 4col */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
          {[
            { label: "부족/품절", value: "5", color: "#EF4444" },
            { label: "만료 임박", value: "2", color: "#F59E0B" },
            { label: "재주문 필요", value: "4", color: "#3B82F6" },
            { label: "입고 대기", value: "1", color: "#10B981" },
          ].map((kpi) => (
            <div key={kpi.label} className="px-2 md:px-3 py-1.5 md:py-2" style={{ backgroundColor: C.base }}>
              <p className="text-[7px] md:text-[9px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: C.text4 }}>{kpi.label}</p>
              <p className="text-[11px] md:text-[14px] font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs — 모바일 스크롤 가능 */}
        <div className="px-3 md:px-4 py-2 overflow-x-auto" style={{ borderBottom: `1px solid ${C.dividerSubtle}`, borderTop: `1px solid ${C.dividerSubtle}` }}>
          <div className="flex items-center gap-1 min-w-max">
            {["전체 24", "조치 필요 7", "만료 임박 2", "정상 15"].map((tab, i) => (
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

        {/* Rows */}
        <div className="divide-y" style={{ borderColor: C.dividerSubtle }}>
          {INVENTORY_ITEMS.map((item) => (
            <div key={item.id}
              className="px-3 md:px-4 py-2.5 md:py-3 cursor-default"
              style={{ backgroundColor: item.selected ? C.elevated : C.base }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[8px] md:text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: BADGE[item.statusColor].bg, color: BADGE[item.statusColor].text, border: `1px solid ${BADGE[item.statusColor].border}` }}
                >{item.status}</span>
              </div>

              <div className="flex items-center justify-between gap-2 md:gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] md:text-[12px] font-bold leading-snug truncate"
                    style={{ color: item.selected ? "#FFFFFF" : C.text1 }}
                  >{item.title}</p>
                  <p className="text-[9px] md:text-[10px] mt-0.5" style={{ color: C.text3 }}>{item.sub}</p>
                </div>

                <button className="text-[9px] md:text-[10px] font-semibold px-2 md:px-3 py-1 md:py-1.5 rounded-lg flex items-center gap-0.5 md:gap-1 whitespace-nowrap flex-shrink-0"
                  style={{
                    backgroundColor: item.selected ? C.accent : "transparent",
                    color: item.selected ? "#FFFFFF" : C.text2,
                    border: item.selected ? "none" : `1px solid ${C.divider}`,
                  }}>
                  {item.action}<ChevronRight className="h-2 w-2 md:h-2.5 md:w-2.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Detail rail */}
      <div className="md:w-[280px] flex-shrink-0 hidden md:block" style={{ backgroundColor: "#1A2840" }}>
        {/* Selected item header */}
        <div className="px-4 py-2.5" style={{ borderBottom: `1px solid ${C.dividerSubtle}` }}>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: BADGE.red.bg, color: BADGE.red.text, border: `1px solid ${BADGE.red.border}` }}
          >만료 임박</span>
          <p className="text-[11px] font-semibold mt-1 truncate" style={{ color: C.text1 }}>{RAIL_DETAIL.product}</p>
        </div>

        {/* Detail fields */}
        <div className="px-4 py-3 space-y-2.5">
          {[
            { icon: PackageCheck, label: "Lot", value: RAIL_DETAIL.lot },
            { icon: Clock, label: "유효기간", value: RAIL_DETAIL.expiry, highlight: true },
            { icon: MapPin, label: "보관 위치", value: RAIL_DETAIL.location },
            { icon: Thermometer, label: "잔량", value: RAIL_DETAIL.remaining },
          ].map((field) => (
            <div key={field.label} className="flex items-start gap-2">
              <field.icon className="h-3 w-3 mt-0.5 flex-shrink-0" style={{ color: C.text4 }} strokeWidth={1.8} />
              <div className="min-w-0">
                <p className="text-[9px] font-medium" style={{ color: C.text4 }}>{field.label}</p>
                <p className="text-[11px] font-semibold" style={{ color: field.highlight ? "#FCA5A5" : "#FFFFFF" }}>{field.value}</p>
              </div>
            </div>
          ))}
          <div className="flex items-start gap-2">
            <RotateCcw className="h-3 w-3 mt-0.5 flex-shrink-0" style={{ color: C.text4 }} strokeWidth={1.8} />
            <div className="min-w-0">
              <p className="text-[9px] font-medium" style={{ color: C.text4 }}>최근 입고</p>
              <p className="text-[11px] font-semibold" style={{ color: "#FFFFFF" }}>{RAIL_DETAIL.lastReceived}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-3 py-2.5 space-y-1.5" style={{ borderTop: `1px solid ${C.dividerSubtle}` }}>
          <button className="w-full text-[11px] font-semibold px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 text-white"
            style={{ backgroundColor: C.accent }}>
            재주문 검토 <ArrowRight className="h-3 w-3" />
          </button>
          <div className="flex gap-1.5">
            <button className="flex-1 text-[10px] font-medium px-2 py-1.5 rounded-lg text-center"
              style={{ color: C.text2, border: `1px solid ${C.divider}` }}>
              입고 반영
            </button>
            <button className="flex-1 text-[10px] font-medium px-2 py-1.5 rounded-lg text-center"
              style={{ color: C.text2, border: `1px solid ${C.divider}` }}>
              Lot 수정
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


export function FinalCTASection() {
  return (
    <section className="relative" style={{
      background: "linear-gradient(to bottom, #0F1C30 0%, #132440 40%, #162844 70%, #0C1628 100%)",
    }}>
      {/* Top separation — hero와 이어지는 미세한 경계 */}
      <div className="absolute inset-x-0 top-0 h-px" style={{
        background: "linear-gradient(90deg, transparent 25%, rgba(148,163,184,0.10) 50%, transparent 75%)",
      }} />

      <div className="relative mx-auto max-w-[1200px] px-5 md:px-8 pt-14 md:pt-20 pb-20 md:pb-32">

        {/* 좌측 텍스트 + 우측 목업 — 간격 좁히고 한 장면으로 */}
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-center">

          {/* Left: Copy — 압축, mockup 설명자 역할 */}
          <div className="lg:w-[300px] flex-shrink-0 text-center lg:text-left">
            <h2 className="text-xl md:text-[26px] font-bold tracking-tight mb-3 leading-tight" style={{ color: "#F8FAFC" }}>
              입고 이후 재고 운영까지<br className="hidden lg:block" /> 끊기지 않습니다
            </h2>
            <p className="text-[13px] md:text-sm font-medium mb-6 leading-relaxed" style={{ color: "#CBD5E1" }}>
              입고 반영, Lot·유효기간 관리, 부족 판단과 재주문까지 이어집니다.
            </p>

            {/* Supporting points — compact */}
            <div className="flex flex-col gap-2.5">
              {[
                { icon: PackageCheck, text: "입고 즉시 재고 반영" },
                { icon: Clock, text: "Lot / 유효기간 추적" },
                { icon: AlertTriangle, text: "부족·재주문 판단" },
              ].map((pt) => (
                <div key={pt.text} className="flex items-center gap-2 justify-center lg:justify-start">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "rgba(59,130,246,0.10)" }}>
                    <pt.icon className="h-3 w-3" style={{ color: "#60A5FA" }} strokeWidth={1.8} />
                  </div>
                  <span className="text-[12px] md:text-[13px] font-medium" style={{ color: "#B8C7D9" }}>{pt.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Mockup 2 — scale 확대, 운영 closure proof */}
          <div className="flex-1 min-w-0 w-full">
            <div
              className="relative rounded-xl md:rounded-2xl overflow-hidden"
              style={{
                backgroundColor: C.base,
                border: "1px solid rgba(148,163,184,0.18)",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 16px 48px rgba(0,0,0,0.45), 0 6px 20px rgba(0,0,0,0.3), 0 0 24px rgba(59,130,246,0.06)",
              }}
            >
              {/* Top edge highlight */}
              <div className="absolute inset-x-0 top-0 h-px pointer-events-none" style={{ background: "linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.16) 50%, transparent 90%)" }} />

              {/* Title bar */}
              <div
                className="flex items-center px-3 md:px-4 py-2"
                style={{ backgroundColor: "#0E1726", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
              >
                <span className="text-[10px] md:text-[11px] font-medium" style={{ color: "#7A8BA3" }}>LabAxis — 재고 운영</span>
              </div>

              <InventoryOpsMockupContent />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
