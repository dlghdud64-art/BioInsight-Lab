/**
 * Vendor Portal Layout
 *
 * 외부 공급사용 격리 레이아웃.
 * - 내부 dashboard sidebar / DashboardShell 미사용
 * - top navigation 단일 (벤더명 + 도움말)
 * - 내부 OpsStore / 인증 컨텍스트와 분리
 * - 다른 페이지 oh-pollution 없음
 */
import type { Metadata } from "next";
import { Suspense } from "react";
import { VendorPortalTopNav } from "./_components/top-nav";

export const metadata: Metadata = {
  title: "Vendor Portal — LabAxis",
  description: "공급사 견적 제출 포털",
};

/**
 * Vendor portal은 외부 공급사 전용 라우트로 쿼리스트링(vendor=...)에 의존한다.
 * useSearchParams를 쓰는 top-nav/board가 있어 prerender 대상이 되면 CSR bailout이
 * 발생하므로 route segment 전체를 dynamic render로 강제한다.
 */
export const dynamic = "force-dynamic";

export default function VendorPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Suspense fallback={<div className="h-14 border-b border-slate-200 bg-white" />}>
        <VendorPortalTopNav />
      </Suspense>
      <main className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
        {children}
      </main>
      <footer className="mx-auto max-w-5xl px-4 pb-8 text-center text-[11px] text-slate-400 md:px-6">
        본 포털은 외부 공급사 전용입니다. 내부 운영 데이터는 표시되지 않습니다.
      </footer>
    </div>
  );
}
