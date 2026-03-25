"use client";

import ComparePage from "../../test/compare/page";

/**
 * /app/compare — 인증된 사용자 전용 비교 페이지
 * middleware.ts에서 인증 체크 후 접근 가능
 */
export default function AppComparePage() {
  return <ComparePage />;
}
