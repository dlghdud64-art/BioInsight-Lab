"use client";

import { useEffect } from "react";
import { useTestFlow } from "../../test/_components/test-flow-provider";
import SearchPage from "../../test/search/page";

/**
 * /app/search — 인증된 사용자 전용 소싱 워크벤치
 * 공개 /search 페이지에서 저장한 pendingQuery를 복원하여 자동 검색 실행
 */
function useRestorePendingState() {
  const { setSearchQuery, runSearch } = useTestFlow();

  useEffect(() => {
    try {
      const pendingQuery = sessionStorage.getItem("bioinsight_pendingQuery");
      if (pendingQuery) {
        sessionStorage.removeItem("bioinsight_pendingQuery");
        sessionStorage.removeItem("bioinsight_pendingAction");
        sessionStorage.removeItem("bioinsight_pendingTarget");
        setSearchQuery(pendingQuery);
        // runSearch reads searchQuery from state; trigger after state settles
        setTimeout(() => {
          runSearch();
        }, 100);
      }
    } catch {
      // sessionStorage may not be available
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

export default function AppSearchPage() {
  useRestorePendingState();
  return <SearchPage />;
}
