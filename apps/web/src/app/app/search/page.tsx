"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTestFlow } from "../../test/_components/test-flow-provider";
import { getPendingAction, clearPendingAction } from "@/lib/auth/pending-action";
import SearchPage from "../../test/search/page";

/**
 * /app/search — 인증된 사용자 전용 소싱 워크벤치
 *
 * 로그인 후 진입 시:
 * 1. URL ?q= 파라미터가 있으면 자동 검색
 * 2. sessionStorage pendingAction이 있으면 복원:
 *    - run_search: query 복원 + 자동 검색
 *    - add_compare / add_request: query 복원 + 검색 후 액션은 수동 재실행
 */
function useRestorePendingState() {
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
    // add_compare, add_request 등은 검색 결과가 나온 후 사용자가 직접 처리
    // (자동 실행은 지시문에서 금지)
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

export default function AppSearchPage() {
  useRestorePendingState();
  return <SearchPage />;
}
