"use client";

import { useSearchParams } from "next/navigation";
import { Building2, HelpCircle } from "lucide-react";

/**
 * Vendor Portal Top Navigation
 *
 * 사이드바 없는 단일 top nav. URL ?vendorId=v1 컨텍스트를 표시한다.
 */
export function VendorPortalTopNav() {
  const params = useSearchParams();
  const vendorId = params.get("vendorId") ?? "";

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 md:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-white">
            <Building2 className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">LabAxis Vendor Portal</p>
            <p className="text-[10px] text-slate-500">공급사 견적 제출 포털</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {vendorId ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {vendorId}
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
              vendorId 미지정
            </span>
          )}
          <a
            href="mailto:portal@labaxis.example"
            className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            도움말
          </a>
        </div>
      </div>
    </header>
  );
}
