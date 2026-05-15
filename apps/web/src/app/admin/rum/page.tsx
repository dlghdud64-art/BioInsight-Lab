"use client";

export const dynamic = "force-dynamic";

import { useSession } from "next-auth/react";
import { PageHeader } from "@/app/_components/page-header";
import { RumAggregateTable } from "./_components/rum-aggregate-table";

/**
 * §11.246d-4-cont-2 #rum-aggregate-admin-dashboard — 호영님 §11.246d-4-cont 자연 후속.
 *
 * /admin/rum — RUM (Core Web Vitals) p75/p95 admin dashboard.
 *
 *   §11.246d-3 observer + §11.246d-4 server POST + §11.246d-4-cont DB persist
 *   → 본 page 가 RumMetric 데이터 시각화. recharts 0 (table only, 호영님 scope
 *   축소 결정). admin/layout.tsx 가 skip-link wrapper 자동 적용.
 *
 *   admin gate: client 측 useSession + server 측 isAdmin() 양쪽 layer.
 *   server gate 가 canonical (UI 가드는 fallback).
 */
export default function AdminRumPage() {
  const { status } = useSession();

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

  return (
    <div className="w-full px-4 md:px-6 py-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="RUM 성능 지표"
          description="Core Web Vitals (LCP / CLS / INP) p75 · p95 per-route. §11.246d 클러스터로 수집된 실사용자 데이터."
        />
        <RumAggregateTable />
      </div>
    </div>
  );
}
