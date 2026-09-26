import { redirect } from "next/navigation";

/**
 * Server-side redirect from the legacy route `/dashboard/quotes/[quoteId]`
 * to the quote detail page `/quotes/{quoteId}`.
 *
 * §quote-brief-rail-removed 후속 (2026-09-27 · 호영님 판정) — 종전 목적지는
 * `/dashboard/quotes?selected={quoteId}`(목록 + 우측 레일)였다. 레일이 삭제된 뒤 그 URL 은
 * 목록에서 행 하나를 표시할 뿐이다. 알림·메일·푸시로 이 링크를 누른 사람은 그 견적을 보러 온
 * 것이지 목록에서 그 행을 찾으러 온 것이 아니다(호영님) → 상세로 바로 보낸다.
 *
 * Removed in §11.39: the previous client component depended on a mock store.
 * The callers across the codebase (`lib/email.ts`, push hooks, `lib/ops-console/*`)
 * keep their existing URL — this redirect absorbs them.
 */
export default async function QuoteDetailRedirect({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}) {
  const { quoteId } = await params;
  redirect(`/quotes/${encodeURIComponent(quoteId)}`);
}
