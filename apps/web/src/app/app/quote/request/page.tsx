"use client";

import QuoteRequestPage from "../../../test/quote/request/page";

/**
 * /app/quote/request — 인증된 사용자 전용 견적 요청 페이지
 * middleware.ts에서 인증 체크 후 접근 가능
 */
export default function AppQuoteRequestPage() {
  return <QuoteRequestPage />;
}
