"use client";

import { Package } from "lucide-react";

export function InventoryContent() {
  return (
    <div className="w-full max-w-full px-4 md:px-6 py-6 md:py-8">
      <div className="flex items-center gap-3 mb-6">
        <Package className="h-6 w-6 text-slate-400" />
        <h1 className="text-xl font-bold text-slate-100">재고 관리</h1>
      </div>
      <div className="rounded-xl border border-bd bg-pn p-8 text-center">
        <p className="text-sm text-slate-400">Shell-only 테스트 — TDZ 진단 중</p>
      </div>
    </div>
  );
}
