"use client";

import Link from "next/link";
import { ScanLine } from "lucide-react";

const INVENTORY_LOT_ISSUE_HREF = "/dashboard/inventory?filter=lot_issue&tab=overview";

export interface SmartReceivingStatusCardProps {
  pendingHandoffCount: number;
  exceptionCount?: number;
  reorderReviewCount?: number;
}

function formatCount(count: number) {
  return count > 99 ? "99+" : count;
}

export function SmartReceivingStatusCard({
  pendingHandoffCount,
  exceptionCount = 0,
  reorderReviewCount = 0,
}: SmartReceivingStatusCardProps) {
  const hasPending = pendingHandoffCount > 0;
  const displayCount = formatCount(pendingHandoffCount);

  const statusItems = [
    { label: "입고 대기", value: displayCount },
    { label: "예외", value: formatCount(exceptionCount) },
    { label: "재주문 검토", value: formatCount(reorderReviewCount) },
  ];

  return (
    <section
      className="mt-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-4"
      data-testid="dashboard-smart-receiving-status-card"
    >
      <div
        className="mb-3 grid grid-cols-3 gap-2"
        data-testid="dashboard-smart-receiving-status-summary"
      >
        {statusItems.map((item) => (
          <Link
            key={item.label}
            href={INVENTORY_LOT_ISSUE_HREF}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 transition-colors hover:border-blue-200 hover:bg-blue-50"
            data-testid="dashboard-smart-receiving-state-link"
          >
            <span className="block truncate text-[10px] font-semibold text-slate-500">
              {item.label}
            </span>
            <span className="mt-0.5 block text-sm font-extrabold leading-none text-slate-900">
              {item.value}건
            </span>
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50">
            <ScanLine className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">스마트 입고</h3>
              <span
                className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  hasPending
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
                data-testid="dashboard-smart-receiving-pending-badge"
              >
                처리 대기 {displayCount}건
              </span>
            </div>
            <p className="mt-0.5 break-keep text-[11px] leading-relaxed text-slate-500">
              입고 대기, 예외, 재주문 검토를 같은 재고 이슈 화면에서 이어서 확인합니다.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:flex-shrink-0">
          <Link
            href={INVENTORY_LOT_ISSUE_HREF}
            className="inline-flex min-h-[32px] items-center justify-center rounded-md bg-blue-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
            data-testid="dashboard-smart-receiving-status-cta"
          >
            입고/예외 확인
          </Link>
        </div>
      </div>
    </section>
  );
}
