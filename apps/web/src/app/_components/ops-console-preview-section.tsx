"use client";

import { useState } from "react";
import {
  ArrowRight, CheckCircle2, AlertTriangle,
  Clock, ChevronRight, Package, FileText, ShieldAlert,
  TrendingUp,
} from "lucide-react";

/*
 * ── Product Proof — 구매 운영 워크큐 목업 ────────────────
 *
 * 현재 제품 구조에 맞게 업데이트:
 * - 큐 명칭 "구매 운영" 정합 · order conversion 기능 제거 반영(§랜딩 목업 갱신 P1)
 * - "AI 선택안" 패널 → 운영 상태 요약 dock
 * - AI 전면 CTA 금지 원칙 적용
 * - 라이트 테마 기반 (현재 제품과 동일)
 * ────────────────────────────────────────────────────────
 */

const QUEUE_ITEMS = [
  {
    id: "pe-001",
    title: "PCR 튜브 (0.2mL) 회신 완료",
    summary: "PCR Tubes 0.2mL, Flat Cap, 1000ea/pk",
    statusLabel: "비교 가능",
    statusColor: "emerald" as const,
    blocker: null as string | null,
    replies: "3/3",
    price: "₩185,000",
    supplier: "BioKorea",
    ctaLabel: "선택안 확정",
    ctaPrimary: true,
    avKey: "tube",
    avBg: "#EFF6FF",
    selected: true,
  },
  {
    id: "pe-002",
    title: "Premium FBS 선택안 검토 필요",
    summary: "FBS, Heat Inactivated, 500mL",
    statusLabel: "선택안 검토",
    statusColor: "blue" as const,
    blocker: "가격 차이 확인",
    replies: "3/3",
    price: "₩580,000",
    supplier: "GibcoKR",
    ctaLabel: "선택안 검토",
    ctaPrimary: false,
    avKey: "flask",
    avBg: "#EFF6FF",
    selected: false,
  },
  {
    id: "pe-003",
    title: "Trypsin-EDTA (0.25%) 추가 검토",
    summary: "Trypsin-EDTA 0.25%, 100mL × 6",
    statusLabel: "추가 검토",
    statusColor: "amber" as const,
    blocker: null,
    replies: "2/3",
    price: "₩145,000",
    supplier: "Welgene",
    ctaLabel: "추가 확인",
    ctaPrimary: false,
    avKey: "flask",
    avBg: "#FFFBEB",
    selected: false,
  },
];

// §랜딩 목업 갱신 D(7/19 개정본) — 구매 행 아바타 아이콘.
//   목업 원문 paths(24 viewBox, stroke 2, round cap/join). 라운드 사각 파랑 기본, 경고행만 앰버.
const AV_ICON_PATHS: Record<string, string[]> = {
  tube: ["M9 3h6", "M10 3v13a2 2 0 004 0V3", "M9 10h6"],
  flask: ["M9 3h6", "M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3", "M7 15h10"],
};

function AvatarLineIcon({ paths, stroke }: { paths: string[]; stroke: string }) {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={stroke}
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

const BADGE_COLORS = {
  emerald: { bg: "#ecfdf5", text: "#059669", border: "#a7f3d0" },
  blue:    { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" },
  amber:   { bg: "#fffbeb", text: "#d97706", border: "#fde68a" },
} as const;

export function OpsConsoleMockupContent() {
  return (
    <div className="flex flex-col md:flex-row bg-white rounded-xl overflow-hidden" style={{ minHeight: 320 }}>

      {/* ── Left: 구매 운영 큐 ── */}
      <div className="flex-1 md:border-r border-slate-200">
        {/* 탭 */}
        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-1">
          {["전체 4", "선택 검토 2", "비교 가능 1", "보류 1"].map((tab, i) => (
            <span key={tab}
              className="text-[10px] font-medium px-2.5 py-1 rounded-md whitespace-nowrap"
              style={{
                color: i === 0 ? "#1e293b" : "#94a3b8",
                backgroundColor: i === 0 ? "#f1f5f9" : "transparent",
              }}
            >{tab}</span>
          ))}
        </div>

        {/* 큐 아이템 */}
        <div>
          {QUEUE_ITEMS.map((item, idx) => (
            <div key={item.id}
              className="px-4 py-3 border-b border-slate-100 animate-stagger-left"
              style={{
                backgroundColor: item.selected ? "#f8fafc" : "#ffffff",
                animationDelay: `${idx * 80}ms`,
              }}
            >
              {/* §랜딩 D — 목업 구조: [아바타] [칩+제목+메타] [CTA] 한 행 */}
              <div className="flex items-center gap-3">
                <span
                  className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-none"
                  style={{ backgroundColor: item.avBg }}
                >
                  <AvatarLineIcon
                    paths={AV_ICON_PATHS[item.avKey]}
                    stroke={item.avBg === "#FFFBEB" ? "#D97706" : "#2563EB"}
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                    <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: BADGE_COLORS[item.statusColor].bg,
                        color: BADGE_COLORS[item.statusColor].text,
                        border: `1px solid ${BADGE_COLORS[item.statusColor].border}`,
                      }}
                    >{item.statusLabel}</span>
                    {item.blocker && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full flex items-center gap-0.5"
                        style={{
                          backgroundColor: BADGE_COLORS.amber.bg,
                          color: BADGE_COLORS.amber.text,
                          border: `1px solid ${BADGE_COLORS.amber.border}`,
                        }}
                      ><AlertTriangle className="h-2 w-2" />{item.blocker}</span>
                    )}
                  </div>
                  <p className="text-[12px] font-bold text-slate-900 leading-snug truncate">{item.title}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    회신 {item.replies} · {item.price} · {item.supplier}
                  </p>
                </div>

                <button className="text-[10px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 whitespace-nowrap flex-shrink-0"
                  style={{
                    backgroundColor: item.ctaPrimary ? "#2563eb" : "transparent",
                    color: item.ctaPrimary ? "#ffffff" : "#64748b",
                    border: item.ctaPrimary ? "none" : "1px solid #e2e8f0",
                  }}>
                  {item.ctaLabel}<ChevronRight className="h-2.5 w-2.5" />
                </button>
              </div>
            </div>
          ))}
          <div className="px-4 py-2 text-center bg-slate-50">
            <span className="text-[10px] text-slate-400">+ 1건 더 보기</span>
          </div>
        </div>
      </div>

      {/* ── Right: 운영 상태 요약 dock ── */}
      <div className="w-full md:w-[220px] bg-slate-50 p-4 hidden md:flex flex-col gap-3">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">운영 상태</p>

        {/* KPI 미니 */}
        {[
          { icon: <FileText className="h-3 w-3 text-blue-500" />, label: "처리 필요", value: "2건", color: "#2563eb" },
          { icon: <CheckCircle2 className="h-3 w-3 text-emerald-500" />, label: "비교 가능", value: "1건", color: "#059669" },
          { icon: <Clock className="h-3 w-3 text-yellow-500" />, label: "승인 대기", value: "0건", color: "#94a3b8" },
          { icon: <ShieldAlert className="h-3 w-3 text-slate-400" />, label: "위험/차단", value: "0건", color: "#94a3b8" },
        ].map((kpi) => (
          <div key={kpi.label} className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center gap-2">
              {kpi.icon}
              <span className="text-[10px] text-slate-600">{kpi.label}</span>
            </div>
            <span className="text-[11px] font-bold" style={{ color: kpi.color }}>{kpi.value}</span>
          </div>
        ))}

        {/* 선택된 아이템 요약 */}
        <div className="mt-1 pt-3 border-t border-slate-200">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">선택된 건</p>
          {/* §랜딩 목업 갱신 P4 — 목업 원본 정합: 선택 건은 공급사 미정·마감임박 케이스(PBS-3 재요청).
              칩(공급사 미정/마감임박)이 아이템 성격과 정합 — 이전 추정 칩(P1 (b))에서 목업 truth로 대체(호영님 2026-07-13). */}
          <div className="bg-white rounded-lg border border-slate-200 p-3">
            <p className="text-[11px] font-bold text-slate-900">PBS-3 (재요청)</p>
            <p className="text-[9px] text-slate-500 mt-1">공급사 미정 · 마감 D-3</p>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-[8px] px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: "#FFFBEB", color: "#B45309", border: "1px solid #FDE68A" }}
              >공급사 미정</span>
              <span className="text-[8px] px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }}
              >마감임박</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
