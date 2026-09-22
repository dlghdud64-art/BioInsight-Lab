"use client";

/**
 * 월별 지출 상세 — §monthly-analytics-no-fabrication (2026-09-22 · 호영님 순서 지시)
 *
 * 🛑 이 화면은 `monthlyData2026`(주석 「가상 12개월 데이터」)을 막대 그래프·표로 그리고 있었고,
 *    2025년 값은 `2026 × (0.85 + Math.random() × 0.2)` 를 **모듈 로드 때마다** 새로 뽑았다 —
 *    지어낸 수일 뿐 아니라 **새로고침할 때마다 바뀌는** 수였다. 「연도 선택」 도 고를 데이터가 없는 선택지였다.
 *    지웠다.
 *
 * 왜 실데이터로 바꾸지 않았나: 실제 월별 지출 출처(`/api/analytics/dashboard` 의 monthlySpending)는
 *   **최근 6개월**만 준다. 이 화면이 약속하던 「연도별 12개월」 을 참으로 채울 출처가 없다.
 *   6개월짜리를 연도 화면에 끼워 넣으면 제목이 다시 거짓이 된다. → 비워 두고 실제 추이가 있는 곳을 안내한다.
 * 이 라우트로 들어오는 링크는 2026-09-22 현재 0 이다(직접 URL 로만 도달).
 * 계약: __tests__/regression/monthly-analytics-no-fabrication.test.ts
 */
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MonthlyAnalyticsPage() {
  return (
    <div className="flex-1 space-y-6 p-8 pt-6 w-full max-w-6xl mx-auto">
      <div className="flex flex-col space-y-4 mb-6">
        <Button variant="ghost" className="w-fit -ml-2 text-slate-500 hover:text-blue-600" asChild>
          <Link href="/dashboard/analytics">
            <ArrowLeft className="mr-2 h-4 w-4" />
            지출 분석 홈으로 돌아가기
          </Link>
        </Button>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">월별 지출 상세 분석</h2>
      </div>

      <div
        data-testid="monthly-analytics-unwired"
        className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3"
      >
        <p className="text-[13px] font-bold text-gray-500">연도별 월간 지출 데이터 없음</p>
        <p className="mt-0.5 text-xs text-gray-500 break-keep">
          연도별 12개월 집계는 아직 제공하지 않습니다. 최근 6개월 실제 월별 지출은{" "}
          <Link href="/dashboard/analytics" className="font-semibold text-blue-600 hover:text-blue-700">
            지출 분석 홈
          </Link>
          에서 볼 수 있습니다.
        </p>
      </div>
    </div>
  );
}
