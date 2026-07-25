"use client";

/**
 * §product-detail-refinement 계약③ — 데이터 0건 섹션 = 접힌 한 줄 + 액션 (PD-L 교체).
 *   형태: `▸ {label} · {status} · [{action}]`. buyer 에게도 미등록 사실 노출(은폐 0).
 *   확장 시 children(상세 콘텐츠) 노출. action 은 링크(/support 등) 또는 핸들러 — dead button 0.
 *   공용 컴포넌트: 상세 스펙 · 등록된 SDS 문서 · 국내 규제기관 포털 등 재사용.
 */

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown } from "lucide-react";

export interface CollapsedRowAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export function CollapsedRow({
  label,
  status,
  action,
  children,
  defaultOpen = false,
}: {
  label: string;
  status: string;
  action?: CollapsedRowAction;
  children?: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasContent = !!children;

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-3 min-h-[44px] py-2 text-sm">
        <button
          type="button"
          onClick={() => hasContent && setOpen((v) => !v)}
          aria-expanded={hasContent ? open : undefined}
          className={`flex items-center gap-1.5 min-w-0 ${hasContent ? "cursor-pointer hover:opacity-80 transition-opacity" : "cursor-default"}`}
        >
          {hasContent && open ? (
            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className={`h-4 w-4 shrink-0 ${hasContent ? "text-slate-400" : "text-slate-300"}`} />
          )}
          <span className="font-medium text-slate-800 truncate">{label}</span>
          <span className="text-slate-300 shrink-0">·</span>
          <span className="text-slate-500 shrink-0">{status}</span>
        </button>
        {action && (
          <div className="ml-auto shrink-0">
            {action.href ? (
              <Link
                href={action.href}
                className="text-xs font-semibold text-blue-600 hover:text-blue-500 hover:underline underline-offset-2"
              >
                {action.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={action.onClick}
                className="text-xs font-semibold text-blue-600 hover:text-blue-500 hover:underline underline-offset-2"
              >
                {action.label}
              </button>
            )}
          </div>
        )}
      </div>
      {hasContent && open && (
        <div className="px-3 pb-3 pt-0 text-sm text-slate-600 border-t border-slate-100">{children}</div>
      )}
    </div>
  );
}
