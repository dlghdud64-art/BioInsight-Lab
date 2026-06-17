"use client";

/**
 * §11.93 #dashboard-quick-actions-card
 *
 * 호영님 시안의 "운영 바로가기" 4 카드 LabAxis 운영 verb 로 정합 흡수.
 *
 *   1. 견적 발송 → /dashboard/quotes?labaxisPilot=quote-dispatch (발송 워크벤치)
 *   2. 발주 전환 → /dashboard/purchases (conversion-ready bucket)
 *   3. 입고 처리 → /dashboard/purchase-orders
 *   4. 재고 점검 → /dashboard/inventory?filter=low
 *
 * §11.364 D-1 — 액션존↔네비존 역할 분리 (호영님 P1, 2026-06-04):
 *   운영 바로가기 = 순수 네비게이션. 진입 링크 + 읽기전용 건수 배지만.
 *   처리/실행 버튼·in-card expand 패널 0 (실행 CTA 는 상단 액션존 단일).
 *   견적 발송 카드도 다른 3 카드와 동형 Link 로 통일 — 클릭 시 발송
 *   워크벤치 라우팅(진입 동선 보존), 발송 truth 는 워크벤치 소유.
 *
 * §11.364 D-2 — 데코 컬러 제거 (호영님 P1):
 *   좌측 컬러바 삭제, 아이콘 박스 무채색. 색은 상태값(§11.302 신호등)에만 —
 *   대기 건수 배지는 노랑(검토 대기) 상태색, 0 건은 무표기(ChevronRight).
 *
 * LabAxis 원칙:
 *   - 모든 link real route 검증 완료 (dead button 0)
 *   - canonical truth: 카드는 count display-only — mutation 0.
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

/** §11.243 #5 — 운영 바로가기 건수 뱃지. countKey 로 stats 매핑 (caller forward).
 *  canonical truth lock: count 자체 mutation 0 — display only. */
type ActionCountKey = "quotes" | "purchases" | "receiving" | "inventory";

interface QuickAction {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  countKey: ActionCountKey;
}

export interface OperatorQuickActionsCounts {
  quotes: number;
  purchases: number;
  receiving: number;
  inventory: number;
}

const ACTIONS: QuickAction[] = [
  {
    // §11.364 D-1 — 견적 "발송" 진입(워크벤치). expand/CTA 강등 → 균질 네비 카드.
    label: "견적 발송",
    description: "발송 대기 견적을 견적 워크벤치에서 처리합니다",
    href: "/dashboard/quotes?labaxisPilot=quote-dispatch",
    icon: FileText,
    countKey: "quotes",
  },
  {
    label: "발주 전환",
    description: "확정된 견적을 발주로 전환합니다",
    href: "/dashboard/purchases",
    icon: ShoppingCart,
    countKey: "purchases",
  },
  {
    label: "입고 처리",
    description: "도착한 발주를 입고 등록합니다",
    href: "/dashboard/purchase-orders",
    icon: Truck,
    countKey: "receiving",
  },
  {
    label: "재고 점검",
    description: "안전재고 미달 품목을 확인합니다",
    href: "/dashboard/inventory?filter=low",
    icon: Package,
    countKey: "inventory",
  },
];

interface OperatorQuickActionsProps {
  /** §11.243 #5 — 카드 우측 상단 건수 뱃지 (count > 0 시 노출). caller forward. */
  counts?: OperatorQuickActionsCounts;
}

export function OperatorQuickActions({
  counts,
}: OperatorQuickActionsProps = {}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-extrabold text-slate-900">운영 바로가기</h3>
        <p className="text-[11px] text-slate-500 break-keep">
          가장 자주 쓰는 운영 동선 4개
        </p>
      </div>
      {/* §dashboard-rightcol-rebalance(호영님) — 우측 단독 컬럼에서 세로 1열로 좌측(예산+도넛) 높이까지
          채움. flex-1 + auto-rows-fr 로 4 타일이 컬럼 높이 균등 분할. (구 P-fid3 2×2 side-col 폐지) */}
      <div className="grid grid-cols-1 gap-3 flex-1 auto-rows-fr">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          // §11.243 #5 — count display-only (caller forward).
          const count = counts ? counts[action.countKey] : 0;
          return (
            <Link
              key={action.countKey}
              href={action.href}
              /* §11.364 D-2 — 좌측 컬러바 제거(데코 색면적 0). 본문 무채색. */
              className="group rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all duration-300 ease-in-out hover:shadow-md hover:border-slate-300 cursor-pointer min-h-[96px]"
            >
              <div className="flex items-start justify-between mb-2">
                {/* §11.364 D-2 — 아이콘 박스 무채색(동선 식별, 상태 아님). */}
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4 w-4 text-slate-600" />
                </div>
                {count > 0 ? (
                  // §11.364 D-2 — 건수 배지 = §11.302 노랑(검토 대기) 상태색. 읽기전용.
                  <span
                    data-quick-action-badge={action.countKey}
                    className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-700"
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 mt-1" />
                )}
              </div>
              <p className="text-sm font-bold text-slate-900 break-keep">{action.label}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 break-keep line-clamp-1 sm:line-clamp-none">
                {action.description}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
