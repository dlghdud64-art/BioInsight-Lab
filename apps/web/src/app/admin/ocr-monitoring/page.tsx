"use client";

export const dynamic = "force-dynamic";

/**
 * §11.290 Phase 6 #ocr-monitoring-admin-dashboard — /admin/ocr-monitoring page.
 *
 * 호영님 P1 spec (2026-05-23):
 *   §11.290 family cost monitoring 마무리. Phase 5.5 + 5.5.b 의 audit log
 *   + cache 위에 per-provider + per-day + cache reuse + status breakdown 시각화.
 *
 * admin gate: client 측 useSession + server 측 isAdmin() 2 layer.
 *   /admin/cron 패턴 정확 reuse.
 *
 * bundle 최적화: OcrCostChart 는 next/dynamic + ssr:false 로 lazy load
 *   (§11.246b-1 spend-trend-area-chart 패턴 정합).
 */

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import nextDynamic from "next/dynamic";
import { PageHeader } from "@/app/_components/page-header";

// OcrCostChart — recharts 200KB 를 initial bundle 에서 분리
const OcrCostChart = nextDynamic(
  () => import("@/components/admin/ocr-cost-chart"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[260px] w-full animate-pulse rounded-md bg-slate-100" />
    ),
  },
);

interface PerProviderRow {
  provider: string;
  count: number;
  costUsd: number;
  avgLatencyMs: number | null;
}

interface PerDayRow {
  day: string;
  count: number;
  costUsd: number;
}

interface StatusRow {
  status: string;
  count: number;
}

interface OcrMonitoringResponse {
  period: "7d" | "30d";
  totals: {
    jobs: number;
    uniqueHashes: number;
    cacheHits?: number; // §11.290 Phase 6.b
    totalRequests?: number; // §11.290 Phase 6.b
    costUsd: number;
  };
  perProvider: PerProviderRow[];
  perDay: PerDayRow[];
  statusBreakdown: StatusRow[];
  cacheHitCount?: number; // §11.290 Phase 6.b 정확 metric
  cacheHitRatio?: number; // §11.290 Phase 6.b 정확 metric (%)
  cacheReuseRatio: number; // Phase 6 proxy (deprecated)
}

const PROVIDER_LABEL: Record<string, string> = {
  GEMINI: "Gemini",
  CLOUD_VISION_CLAUDE: "Vision + Claude",
  REGEX: "정규식 fallback",
};

const STATUS_LABEL: Record<string, string> = {
  SUCCESS: "성공",
  NEEDS_REVIEW: "검토 필요",
  FAILED: "실패",
  RUNNING: "진행 중",
  PENDING: "대기",
};

export default function OcrMonitoringPage() {
  const { status: sessionStatus } = useSession();
  const [period, setPeriod] = useState<"7d" | "30d">("7d");
  const [data, setData] = useState<OcrMonitoringResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/ocr-monitoring?period=${period}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json: OcrMonitoringResponse) => {
        setData(json);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [period, sessionStatus]);

  if (sessionStatus === "loading") {
    return (
      <div className="p-6 text-sm text-slate-500">세션을 확인하는 중입니다.</div>
    );
  }
  if (sessionStatus === "unauthenticated") {
    return (
      <div className="p-6 text-sm text-rose-700">
        로그인이 필요합니다. 다시 로그인해 주세요.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="OCR 사용량 모니터링"
        description="Phase 5.5 + 5.5.b audit log 기반 per-provider · per-day cost / cache 활용도 시각화. Gemini + Cloud Vision + Claude Haiku 호출 비용 추적."
      />

      {/* period selector */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-600">기간:</span>
        {(["7d", "30d"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={
              p === period
                ? "px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm font-medium"
                : "px-3 py-1.5 rounded-md bg-slate-100 text-slate-700 text-sm hover:bg-slate-200"
            }
          >
            {p === "7d" ? "최근 7일" : "최근 30일"}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-sm text-slate-500">데이터를 불러오는 중...</div>
      )}
      {error && (
        <div className="text-sm text-rose-700">
          오류: {error}. 잠시 후 다시 시도해 주세요.
        </div>
      )}

      {data && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="총 스캔 건수" value={data.totals.jobs.toLocaleString()} />
            <KpiCard
              label="총 비용 (USD)"
              value={`$${data.totals.costUsd.toFixed(4)}`}
            />
            <KpiCard
              label="Cache hit 수"
              value={(data.cacheHitCount ?? 0).toLocaleString()}
            />
            <KpiCard
              label="Cache hit 비율"
              value={`${(data.cacheHitRatio ?? data.cacheReuseRatio).toFixed(1)}%`}
              testId="ocr-cache-hit-ratio"
            />
          </div>

          {/* per-provider summary table */}
          <section
            data-testid="ocr-provider-summary"
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <h2 className="text-sm font-semibold text-slate-800 mb-3">
              Provider 별 사용 현황
            </h2>
            {data.perProvider.length === 0 ? (
              <p className="text-sm text-slate-500">
                지난 {period === "7d" ? "7일" : "30일"} 간 OCR 호출 기록이 없습니다.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500 border-b">
                    <tr>
                      <th className="py-2 pr-3">Provider</th>
                      <th className="py-2 pr-3 text-right">호출 수</th>
                      <th className="py-2 pr-3 text-right">총 비용 (USD)</th>
                      <th className="py-2 pr-3 text-right">평균 지연 (ms)</th>
                      <th className="py-2 text-right">호출 당 평균 비용</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.perProvider.map((row) => (
                      <tr key={row.provider} className="border-b last:border-b-0">
                        <td className="py-2 pr-3 font-medium text-slate-800">
                          {PROVIDER_LABEL[row.provider] ?? row.provider}
                        </td>
                        <td className="py-2 pr-3 text-right">
                          {row.count.toLocaleString()}
                        </td>
                        <td className="py-2 pr-3 text-right">
                          ${row.costUsd.toFixed(4)}
                        </td>
                        <td className="py-2 pr-3 text-right">
                          {row.avgLatencyMs != null ? row.avgLatencyMs.toLocaleString() : "—"}
                        </td>
                        <td className="py-2 text-right text-slate-500">
                          {row.count > 0
                            ? `$${(row.costUsd / row.count).toFixed(5)}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* per-day chart */}
          <section
            data-testid="ocr-per-day-chart"
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <h2 className="text-sm font-semibold text-slate-800 mb-3">
              일별 호출 + 비용 추이
            </h2>
            {data.perDay.length === 0 ? (
              <p className="text-sm text-slate-500">
                기간 내 데이터가 없습니다.
              </p>
            ) : (
              <div className="h-[260px] w-full">
                <OcrCostChart data={data.perDay} />
              </div>
            )}
          </section>

          {/* status breakdown */}
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">
              상태 분포
            </h2>
            {data.statusBreakdown.length === 0 ? (
              <p className="text-sm text-slate-500">데이터가 없습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-3 text-sm">
                {data.statusBreakdown.map((row) => (
                  <div
                    key={row.status}
                    className="px-3 py-2 rounded-md bg-slate-50 border border-slate-200"
                  >
                    <span className="text-slate-600 mr-2">
                      {STATUS_LABEL[row.status] ?? row.status}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {row.count.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  testId?: string;
}
function KpiCard({ label, value, testId }: KpiCardProps) {
  return (
    <div
      data-testid={testId}
      className="rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
