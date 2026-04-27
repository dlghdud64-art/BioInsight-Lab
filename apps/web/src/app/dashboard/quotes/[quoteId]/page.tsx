import { redirect } from "next/navigation";

/**
 * Server-side redirect from the legacy page-per-feature route
 * `/dashboard/quotes/[quoteId]` to the canonical same-canvas detail
 * surface `/dashboard/quotes?selected={quoteId}`.
 *
 * Removed in §11.39 (#α-F-followup-quote-detail-page-per-feature):
 * the previous 389-line client component depended on `useOpsStore`
 * (Zustand mock store) and rendered "찾을 수 없습니다" against
 * production data because the store was never hydrated from the
 * canonical Prisma source. That violated two LabAxis principles
 * simultaneously: (1) page-per-feature regression — same-canvas
 * already exists in `/dashboard/quotes` via the `?selected=` query
 * param + right-rail; (2) preview/projection (`useOpsStore`) over-
 * writing actual truth.
 *
 * The 30+ callers across the codebase
 * (`/dashboard/purchase-orders/[poId]/page.tsx:292`,
 *  `/dashboard/purchases/page.tsx:563,788`, `lib/email.ts:225`,
 *  `lib/ops-console/*`) keep their existing URL — this redirect
 * absorbs them into the canonical right-rail surface.
 */
export default async function QuoteDetailRedirect({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}) {
  const { quoteId } = await params;
  redirect(`/dashboard/quotes?selected=${encodeURIComponent(quoteId)}`);
}
