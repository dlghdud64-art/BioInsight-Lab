import { redirect } from "next/navigation";

/**
 * §route-duplication (2026-08-10) — 벤더 포털 RFQ 대시보드 폐기.
 *
 * 이 화면은 전부 하드코딩 mock 이었다: `/api/vendor/stats`(가짜 통계) +
 * `/api/vendor/requests`(실재하지 않는 견적 요청 3건과 조직명). 두 API 모두 삭제했다.
 *
 * 라우트 자체를 지우지 않고 리다이렉트로 남기는 이유: 사이드바와 로그인 이후 경로가
 * 이 주소를 가리키므로 404 를 만들지 않기 위함이다. 화면은 만들지 않는다(미생성).
 */
export default function VendorDashboardRedirectPage() {
  redirect("/vendor");
}
