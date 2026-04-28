"use client";

/**
 * §11.93 #dashboard-quick-actions-card
 *
 * 호영님 시안의 "운영 바로가기" 4 카드 LabAxis 운영 verb 로 정합 흡수.
 * 시안의 (시약 뱅크 / 신규 발주 / SOP 점검 / 세팅) 은 LabAxis 운영
 * ontology 와 부분 정합 — 운영자가 가장 자주 쓰는 4 verb 로 재선정:
 *
 *   1. 견적 등록 → /dashboard/quotes (견적 요청 wizard)
 *   2. 발주 전환 → /dashboard/purchases (conversion-ready bucket)
 *   3. 입고 처리 → /dashboard/purchase-orders?bucket=handoff
 *   4. 재고 점검 → /dashboard/inventory?filter=low
 *
 * Sidebar 와 부분 duplicate 이지만:
 *   - sidebar: 메뉴 형태 (모든 surface 진입)
 *   - quick actions: dashboard 종합 surface 의 single-click 단축
 *   → operator quick access 가치, duplicate 가 아닌 multi-channel
 *     entry (호영님 mental model: dashboard 한 화면에서 처리).
 *
 * LabAxis 원칙:
 *   - 모든 link real route 검증 완료 (dead button 0)
 *   - icon + verb + 보조 description (시안 visual essence)
 *   - hover transition (§11.82 KpiCard 와 일관)
 */

import Link from "next/link";
import {
  FileText,
  ShoppingCart,
  Truck,
  Package,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface QuickAction {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /** accent border color (좌측 thin line — KpiCard 4-tone palette 와 일관) */
  tone: "blue" | "emerald" | "amber" | "purple";
}

const ACTIONS: QuickAction[] = [
  {
    label: "견적 등록",
    description: "공급사 견적을 새로 요청합니다",
    href: "/dashboard/quotes",
    icon: FileText,
    tone: "blue",
  },
  {
    label: "발주 전환",
    description: "확정된 견적을 발주로 전환합니다",
    href: "/dashboard/purchases",
    icon: ShoppingCart,
    tone: "emerald",
  },
  {
    label: "입고 처리",
    description: "도착한 발주를 입고 등록합니다",
    href: "/dashboard/purchase-orders",
    icon: Truck,
    tone: "amber",
  },
  {
    label: "재고 점검",
    description: "안전재고 미달 품목을 확인합니다",
    href: "/dashboard/inventory?filter=low",
    icon: Package,
    tone: "purple",
  },
];

const TONE_MAP = {
  blue: { accent: "border-l-blue-500", iconBg: "bg-blue-50", iconColor: "text-blue-600" },
  emerald: { accent: "border-l-emerald-500", iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
  amber: { accent: "border-l-amber-500", iconBg: "bg-amber-50", iconColor: "text-amber-600" },
  purple: { accent: "border-l-purple-500", iconBg: "bg-purple-50", iconColor: "text-purple-600" },
};

export function OperatorQuickActions() {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-extrabold text-slate-900">운영 바로가기</h3>
        <p className="text-[11px] text-slate-500 break-keep">
          가장 자주 쓰는 운영 동선 4개
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const tone = TONE_MAP[action.tone];
          return (
            <Link
              key={action.href}
              href={action.href}
              className={`group rounded-lg border border-slate-200 border-l-2 ${tone.accent} bg-white px-4 py-3 shadow-sm transition-all hover:shadow-md hover:border-slate-300 cursor-pointer`}
            >
              <div className="flex items-start justify-between mb-2">
                <div
                  className={`w-8 h-8 rounded-lg ${tone.iconBg} flex items-center justify-center flex-shrink-0`}
                >
                  <Icon className={`h-4 w-4 ${tone.iconColor}`} />
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 mt-1" />
              </div>
              <p className="text-sm font-bold text-slate-900 break-keep">{action.label}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 break-keep">
                {action.description}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
