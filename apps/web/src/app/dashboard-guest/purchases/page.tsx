/**
 * §guest-scope-leak (2026-09-16 · 호영님 승인) — 게스트 데모 구매 화면 **경로 차단**.
 *
 * 이 화면이 고정 키 `"guest-demo"` 로 `/api/purchases/import` 를 호출하던 **유일한 살아 있는
 * 쓰기 경로**였다(같은 키로 쓰는 `components/purchases/csv-upload-tab.tsx` 는 렌더되는 화면이 없다).
 * 근거·경위는 ../page.tsx 주석 · regression/guest-scope-leak.test.ts.
 */

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function DashboardGuestPurchasesRedirect() {
  redirect("/dashboard");
}
