/**
 * §guest-scope-leak (2026-09-16 · 호영님 승인) — 게스트 데모 대시보드 **경로 차단**.
 *
 * 이 화면은 로그인 없이 구매 내역을 시험하던 초기 MVP(PURCHASE_DASHBOARD_GUESTKEY_MVP.md)의
 * 잔존물이고, `lib/guest-key.ts` 의 고정 키 `"guest-demo"` 로 읽고 **썼다**. 그 공용 스코프가
 * 로그인 사용자의 지출 집계에 섞이던 것이 이번 발견이다(prod 실측 2026-09-16: 6개월 창
 * ₩44,634,000 중 ₩43,784,000 이 데모 시드). 읽기 축은 API 에서 닫았고, 쓰기 축은
 * **진입 화면을 없애는 것**이 처방이다 — 로그인만 요구하면(미들웨어 추가) 오염원은 남는다.
 *
 * 진입 경로 전수(2026-09-16): 앱 안에서 이 경로를 가리키는 링크·리다이렉트·sitemap 0건.
 * 파일 삭제 대신 redirect-only swap — 레포 선례 `app/inventory/page.tsx`(§11.92).
 * 되돌리려면 이 커밋을 revert 한다.
 */

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function DashboardGuestRedirect() {
  redirect("/dashboard");
}
