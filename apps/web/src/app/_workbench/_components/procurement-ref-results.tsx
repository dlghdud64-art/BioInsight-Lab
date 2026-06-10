"use client";

// §catalog-A Phase 3 — 공공조달 참조 검색 결과 섹션 (호영님 P1, 2026-06-10)
// ref = projection(not truth). 배지로 출처 구분, canonical 결과를 밀어내지 않도록
// 본 결과 리스트 아래 별도 섹션. CTA = demand-driven 승격 → 견적 담기 (dead-end 0).
// §11.311: 터치 ≥44px(h-10), 0건 시 본 컴포넌트 자체 미렌더(first fold 절약).

import { useState } from "react";
import { Landmark, Loader2, FilePlus2 } from "lucide-react";
import type { RefSearchItem } from "@/lib/catalog/procurement-search";

interface ProcurementRefResultsProps {
  refs: RefSearchItem[];
  /** 승격→견적 담기. 실패 시 reject — 호출측 toast 책임. */
  onAddToQuote: (ref: RefSearchItem) => Promise<void>;
}

export function ProcurementRefResults({ refs, onAddToQuote }: ProcurementRefResultsProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (refs.length === 0) return null;

  const handleAdd = async (ref: RefSearchItem) => {
    if (pendingId) return;
    setPendingId(ref.prdctIdNo);
    try {
      await onAddToQuote(ref);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="mt-4 border-t border-slate-200 pt-3" data-testid="procurement-ref-results">
      <h3 className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1.5">
        <Landmark className="h-3.5 w-3.5" strokeWidth={1.5} />
        공공조달 물품목록 참조
        <span className="text-slate-400">· {refs.length}건</span>
      </h3>
      <div className="space-y-1.5">
        {refs.map((ref) => {
          const isPending = pendingId === ref.prdctIdNo;
          return (
            <div
              key={ref.prdctIdNo}
              className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50/50 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm text-slate-800">{ref.name}</p>
                  <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-200">
                    공공조달 참조
                  </span>
                </div>
                <p className="truncate text-xs text-slate-500">
                  {[ref.brand, ref.modelNm].filter(Boolean).join(" · ") || `식별번호 ${ref.prdctIdNo}`}
                </p>
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={() => void handleAdd(ref)}
                aria-label={`${ref.name} 카탈로그 등록 후 견적 담기`}
                className="shrink-0 inline-flex h-10 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                ) : (
                  <FilePlus2 className="h-3.5 w-3.5" strokeWidth={2} />
                )}
                견적 담기
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
