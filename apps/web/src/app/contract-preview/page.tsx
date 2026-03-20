"use client";

import Link from "next/link";

/**
 * Contract Preview Index
 *
 * 계약 작업 결과를 격리된 환경에서 확인하는 진입점.
 * 기본 /app/dashboard와 완전 분리.
 */
export default function ContractPreviewPage() {
  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">
          Contract Preview Hub
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          계약 작업 결과를 기본 대시보드와 분리하여 검증합니다.
        </p>
      </div>

      <div className="space-y-2">
        {[
          {
            label: "Today Operating Hub",
            href: "/contract-preview/today-hub",
            desc: "운영형 대시보드 전체 (useOpsStore 기반)",
            status: "isolated",
          },
          {
            label: "Module Landing Surfaces",
            href: "/contract-preview/module-landing",
            desc: "견적/발주/입고/재고위험 모듈 허브",
            status: "isolated",
          },
          {
            label: "Section Candidates",
            href: "/contract-preview/sections",
            desc: "부분 재도입 후보 section 개별 테스트",
            status: "candidate",
          },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block bg-slate-900 border border-slate-800 rounded-lg p-4 hover:bg-slate-800/70 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-100">
                {item.label}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  item.status === "isolated"
                    ? "bg-amber-500/15 text-amber-400"
                    : "bg-emerald-500/15 text-emerald-400"
                }`}
              >
                {item.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
          </Link>
        ))}
      </div>

      <div className="border-t border-slate-800 pt-4">
        <Link
          href="/dashboard"
          className="text-xs text-blue-400 hover:underline"
        >
          ← 기본 대시보드로 돌아가기
        </Link>
      </div>
    </div>
  );
}
