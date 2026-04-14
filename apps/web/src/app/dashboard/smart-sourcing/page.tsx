"use client";

/**
 * Legacy Smart Sourcing redirect.
 *
 * Smart Sourcing는 독립 페이지가 아닌 견적 운영 워크큐 내부 capability로 통합되었습니다.
 * 이 route는 1 release 동안만 유지한 뒤 제거합니다.
 *
 * TODO: 다음 릴리스에서 이 파일과 smart-sourcing/ 디렉토리 삭제
 */

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SmartSourcingRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // source hint 보존: manual_upload / bom_import 등
    const source = searchParams?.get("source");
    const dockParam = source === "bom_import"
      ? "?dock=intake&source=bom_import"
      : source === "manual_upload"
        ? "?dock=intake&source=manual_upload"
        : "";

    router.replace(`/dashboard/quotes${dockParam}`);
  }, [router, searchParams]);

  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <p className="text-sm text-slate-500">견적 운영 워크큐로 이동 중...</p>
      </div>
    </div>
  );
}
