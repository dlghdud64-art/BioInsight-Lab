"use client";

import QuotePage from "../../test/quote/page";

/**
 * /app/quote — 인증된 사용자 전용 견적 리스트 페이지
 * middleware.ts에서 인증 체크 후 접근 가능
 */
export default function AppQuotePage() {
  return <QuotePage />;
}
