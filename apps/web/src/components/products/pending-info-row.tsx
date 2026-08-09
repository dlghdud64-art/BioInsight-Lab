"use client";

/**
 * §product-detail-sourcing-v21 §1 — 완성도 게이지 은퇴 → 접힌 1줄.
 *   - buyer 화면에서 완성도 %(내부 데이터 품질)는 행동 불가 정보 → 상단 점유 폐기.
 *     완성도 관리는 공급사/관리자 콘솔 몫. 산정 lib(computeCompleteness)은 그 콘솔용으로 존치.
 *   - 여기서는 **미등록 사실만** 정직하게 1줄 노출(은폐 0) + 탭 시 미등록 항목 목록.
 *   - 편집/요청 액션 0 — §1 권한 규칙(buyer 에게 편집·업로드·요청 링크 미생성, dead link 0).
 *     ADMIN·SUPPLIER 의 편집 진입은 각 섹션(스펙 카드 · 안전·규제 카드)의 canEditSpec 게이트가 담당.
 *   - 미등록 0건이면 렌더 자체 없음(빈 줄/대시 금지).
 */

import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { computeCompleteness } from "@/lib/product-detail/completeness";

export function PendingInfoRow({ product }: { product: Record<string, unknown> | null | undefined }) {
  const [open, setOpen] = useState(false);
  const { missingLabels } = computeCompleteness(product);
  if (missingLabels.length === 0) return null;

  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3.5 min-h-[44px] py-2 text-left"
      >
        <span className="text-[11.5px] text-slate-400 flex-1 min-w-0 truncate">
          일부 정보 미등록 · 견적·문의 시 안내됩니다
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-300" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
        )}
      </button>
      {open && (
        <ul className="px-3.5 pb-3 pt-0 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100">
          {missingLabels.map((label) => (
            <li key={label} className="text-[11px] text-slate-500">
              {label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
