"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTestFlow } from "../../test/_components/test-flow-provider";
import { getPendingAction, clearPendingAction } from "@/lib/auth/pending-action";
import SearchPage from "../../test/search/page";

/**
 * /app/search — 인증된 사용자 전용 소싱 워크벤치
 *
 * 로그인 후 진입 시:
 * 1. URL ?q= 파라미터가 있으면 자동 검색
 * 2. sessionStorage pendingAction이 있으면 복원
 */
function RestorePendingState() {
  const { setSearchQuery, runSearch } = useTestFlow();
  const searchParams = useSearchParams();

  useEffect(() => {
    // 1. URL ?q= 파라미터 우선
    const urlQuery = searchParams?.get("q");
    if (urlQuery) {
      setSearchQuery(urlQuery);
      setTimeout(() => runSearch(), 100);
      clearPendingAction();
      return;
    }

    // 2. sessionStorage pending state
    const pending = getPendingAction();
    if (!pending) return;

    clearPendingAction();

    if (pending.query) {
      setSearchQuery(pending.query);
      setTimeout(() => runSearch(), 100);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export default function AppSearchPage() {
  return (
    <>
      <Suspense fallback={null}>
        <RestorePendingState />
      </Suspense>
      <SearchPage />
    </>
  );
}
