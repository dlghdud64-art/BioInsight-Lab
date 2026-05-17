"use client";

export const dynamic = "force-dynamic";

import { useSession } from "next-auth/react";
import { PageHeader } from "@/app/_components/page-header";
import { CronExecutionTable } from "./_components/cron-execution-table";

/**
 * #cron-monitoring-admin-dashboard — /admin/cron page.
 *
 * 호영님 backlog audit P0 (b). Vercel cron 5 entry 의 실행 history 시각화.
 * §11.250b-fix 같은 dead cron 사건 사전 감지 = production critical 가치.
 *
 * admin gate: client 측 useSession + server 측 isAdmin() 2 layer.
 *   admin/rum/page.tsx 패턴 정확 reuse.
 */
export default function CronMonitoringPage() {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <div className="p-6 text-sm text-slate-500">세션을 확인하는 중입니다.</div>
    );
  }
  if (status === "unauthenticated") {
    return (
      <div className="p-6 text-sm text-rose-700">
        로그인이 필요합니다. 다시 로그인해 주세요.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="Cron 실행 모니터링"
        description="Vercel cron 실행 history (성공/실패 / 평균·p95 소요 시간 / 최근 실행 시각). §11.250b-fix 같은 dead cron 사건을 사전 감지합니다."
      />
      <CronExecutionTable />
    </div>
  );
}
