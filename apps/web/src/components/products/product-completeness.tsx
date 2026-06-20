"use client";

/**
 * §product-detail PD-B (§04·§05) — 완성도 바 + 미등록 1줄 축약(정직)
 *
 * 지시문 §04·§02 원칙2/3. 완성도 %(분모 8 고정) + "채워지는 중" 프레이밍.
 *   - 100% = 배지 숨김(완전한 제품). 그 외 = §11.302 yellow(중립 — 빨강 금지).
 *   - 미등록 필드는 개별 빈 블록 대신 1줄로 묶어 표기 + 정보 요청(실 라우트 /support).
 *   - 가짜 채움 0, dead button 0(정보 요청 = 실제 이동).
 */

import Link from "next/link";
import { computeCompleteness } from "@/lib/product-detail/completeness";

export function ProductCompleteness({ product }: { product: Record<string, unknown> | null | undefined }) {
  const { pct, missingLabels } = computeCompleteness(product);
  if (pct >= 100) return null; // 완전한 제품 = 완성도 배지 숨김(§04)

  return (
    <div className="mb-6 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-yellow-800">제품 정보 완성도</span>
        <span className="text-xs font-bold text-yellow-800 tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-yellow-100 overflow-hidden">
        <div className="h-full rounded-full bg-yellow-400" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-yellow-800/80 mt-2 leading-relaxed">
        {pct < 40 ? "제품 정보가 일부만 등록되어 있습니다 — 견적·문의 시 안내됩니다." : "제품 정보가 채워지는 중입니다."}
        {missingLabels.length > 0 && (
          <>
            {" "}
            {missingLabels.join(" · ")} 정보는 아직 등록되지 않았습니다 (미등록 {missingLabels.length}개).{" "}
            <Link href="/support" className="font-semibold underline underline-offset-2">
              정보 요청
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
