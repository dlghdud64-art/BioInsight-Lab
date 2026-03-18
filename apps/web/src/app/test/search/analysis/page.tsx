"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";

/**
 * AI 분석 상세 보기는 검색 결과 내 인라인 패널로 이동했습니다.
 * 이 페이지는 기존 링크/북마크 호환을 위해 검색 페이지로 리다이렉트합니다.
 */
function RedirectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";

  useEffect(() => {
    const target = query
      ? `/test/search?q=${encodeURIComponent(query)}`
      : "/test/search";
    router.replace(target);
  }, [query, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-pn">
      <div className="text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3 text-blue-500" />
        <p className="text-sm text-slate-500">검색 결과로 이동 중...</p>
      </div>
    </div>
  );
}

export default function SearchAnalysisPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-pn">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      }
    >
      <RedirectContent />
    </Suspense>
  );
}
