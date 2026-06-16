"use client";

/**
 * §main-dashboard-redesign P3 — GlobalEmpty (종합 빈 계정 첫 화면)
 *
 * 정본: docs/plans/PLAN_main-dashboard-redesign.md (P3, 가드①)
 *
 * summary.derived.allEmpty === true(견적·발주·입고·재고 전부 0)일 때만 노출.
 *   빈 데이터 차트/가짜 분포 금지(가드①②) — 정직한 빈 상태 + 시작 유도 CTA만.
 *   sample 분포·placeholder 배지 0. 컴팩트(큰 일러스트/긴 문구 금지, §1-2④).
 *
 * presentational — 노출 판단(allEmpty)은 P2 useDashboardSection state 로 컨테이너가
 *   결정(별도 탑재). page 미배선(고립 빌드).
 */

import { Sparkles, FileText } from "lucide-react";

export interface GlobalEmptyProps {
  /** 첫 견적 시작 CTA href. */
  quoteHref?: string;
}

// §dashboard-shifan-polish B4 — 예산 설정 CTA + 예산 라우트 prop 제거: 빈 계정 예산 동선은
//   NextStepBanner 단독(중복 3→1). GlobalEmpty 는 예산 외 onboarding(첫 견적) 전담.
export function GlobalEmpty({
  quoteHref = "/dashboard/quotes",
}: GlobalEmptyProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900 leading-tight">
            운영 데이터를 시작하세요
          </h2>
          {/* §dashboard-shifan-polish A7 — 카피 구체화: 무엇을 쌓으면 무엇이 채워지는지 명시(action→result). */}
          <p className="mt-1 text-[13px] text-slate-500 break-keep leading-relaxed">
            견적을 요청하면 파이프라인과 처리 항목이, 예산을 등록하면 집행률·잔여 예산이,
            입고가 기록되면 재고·카테고리 분포가 자동으로 채워집니다.
            데이터가 쌓이기 전에는 빈 상태로 정직하게 표시됩니다.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={quoteHref}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 h-10 min-h-[44px] text-[13px] font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              첫 견적 시작
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
