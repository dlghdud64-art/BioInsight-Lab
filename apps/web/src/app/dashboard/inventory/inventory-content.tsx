"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

const InventorySummaryBlock = dynamic(
  () => import("./blocks/inventory-summary-block").then(m => m.InventorySummaryBlock),
  { ssr: false, loading: () => <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1,2,3,4].map(i => <div key={i} className="h-24 rounded-xl bg-el animate-pulse" />)}</div> }
);

export function InventoryContent() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">로딩 중...</div>}>
      <div className="w-full max-w-full px-4 md:px-6 py-6 md:py-8 space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl md:text-2xl font-bold text-slate-100">재고 관리</h1>
        </div>
        <InventorySummaryBlock />
        <div className="rounded-xl border border-bd bg-pn p-6 text-center">
          <p className="text-sm text-slate-400">재고 테이블 복구 중 — KPI baseline 안전 상태</p>
        </div>
      </div>
    </Suspense>
  );
}
