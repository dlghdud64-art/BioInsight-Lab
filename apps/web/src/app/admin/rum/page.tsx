"use client";

export const dynamic = "force-dynamic";

import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import nextDynamic from "next/dynamic";
import { PageHeader } from "@/app/_components/page-header";
import { RumAggregateTable } from "./_components/rum-aggregate-table";

/**
 * §11.246d-4-cont-2 #rum-aggregate-admin-dashboard — 호영님 §11.246d-4-cont 자연 후속.
 * §11.246d-4-cont-3 #rum-trend-line-chart — 일자별 LCP/CLS/INP p75 추세 추가.
 *
 * /admin/rum — RUM (Core Web Vitals) admin dashboard.
 *
 *   §11.246d-3 observer + §11.246d-4 server POST + §11.246d-4-cont DB persist
 *   → 본 page 가 RumMetric 데이터 시각화 (table + 3 line chart).
 *   admin/layout.tsx 가 skip-link wrapper 자동 적용 (§11.126).
 *
 *   admin gate: client 측 useSession + server 측 isAdmin() 양쪽 layer.
 *
 *   §11.246b-1 nextDynamic alias 패턴 — `export const dynamic = "force-dynamic"`
 *   symbol 과 충돌 회피.
 */

// §11.246d-4-cont-3 — recharts (~200KB) lazy load. ssr:false (client only).
const RumTrendLineChart = nextDynamic(
  () => import("@/components/analytics/rum-trend-line-chart"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[260px] flex items-center justify-center text-sm text-slate-500">
        차트 로딩 중...
      </div>
    ),
  },
);

interface RumTimeseriesRow {
  date: string;
  count: number;
  lcp_p75: number | null;
  cls_p75: number | null;
  inp_p75: number | null;
}

interface RumTimeseriesResponse {
  rows: RumTimeseriesRow[];
}

export default function AdminRumPage() {
  const { status } = useSession();

  // §11.246d-4-cont-3 — 30일 timeseries fetch (호영님 결정: 30일 고정).
  const { data: trendData, isLoading: trendLoading, isError: trendError } =
    useQuery<RumTimeseriesResponse>({
      queryKey: ["admin-rum-timeseries"],
      queryFn: async () => {
        const res = await fetch(`/api/admin/rum/timeseries`);
        if (!res.ok) {
          throw new Error(`Failed to fetch RUM timeseries (${res.status})`);
        }
        return res.json();
      },
      enabled: status === "authenticated",
    });

  if (status === "loading") {
    return (
      <div className="w-full px-4 md:px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-muted-foreground">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="w-full px-4 md:px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <p className="text-muted-foreground">로그인이 필요합니다.</p>
          </div>
        </div>
      </div>
    );
  }

  const trendRows = trendData?.rows ?? [];
  const hasTrendData = trendRows.length > 0;

  return (
    <div className="w-full px-4 md:px-6 py-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="RUM 성능 지표"
          description="Core Web Vitals (LCP / CLS / INP) p75 · p95 per-route. §11.246d 클러스터로 수집된 실사용자 데이터."
        />

        {/* §11.246d-4-cont-3 — 일자별 p75 추세 (30일 고정) */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              최근 30일 p75 추세
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              일자별 Core Web Vitals p75 변화 추세. 회귀 감지에 활용.
            </p>
          </div>

          {trendLoading && (
            <div className="rounded-xl border border-bd bg-white px-4 py-12 text-center text-sm text-slate-500">
              추세 데이터 로딩 중...
            </div>
          )}
          {trendError && !trendLoading && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-center text-sm text-rose-700">
              추세 데이터 조회에 실패했습니다.
            </div>
          )}
          {!trendLoading && !trendError && !hasTrendData && (
            <div className="rounded-xl border border-bd bg-white px-4 py-12 text-center text-sm text-slate-500">
              아직 RUM 추세 데이터가 충분하지 않습니다. (최소 1일 이상 수집 필요)
            </div>
          )}
          {!trendLoading && !trendError && hasTrendData && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-xl border border-bd bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-2">
                  LCP p75 (Largest Contentful Paint)
                </h3>
                <RumTrendLineChart data={trendRows} metric="lcp" />
              </div>
              <div className="rounded-xl border border-bd bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-2">
                  CLS p75 (Cumulative Layout Shift)
                </h3>
                <RumTrendLineChart data={trendRows} metric="cls" />
              </div>
              <div className="rounded-xl border border-bd bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-2">
                  INP p75 (Interaction to Next Paint)
                </h3>
                <RumTrendLineChart data={trendRows} metric="inp" />
              </div>
            </div>
          )}
        </section>

        {/* §11.246d-4-cont-2 — pathname 별 p75/p95 table */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              경로별 p75 / p95
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              pathname 별 percentile aggregate. 7일 / 30일 토글.
            </p>
          </div>
          <RumAggregateTable />
        </section>
      </div>
    </div>
  );
}
