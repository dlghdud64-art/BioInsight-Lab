"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

// 기존 검색 페이지는 /test/search로 리다이렉트
function SearchRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) {
      params.set("q", q);
    }
    router.replace(`/test/search?${params.toString()}`);
  }, [router, q]);

  return null;
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="text-center py-8">Loading...</div>}>
      <SearchRedirect />
    </Suspense>
  );
}
