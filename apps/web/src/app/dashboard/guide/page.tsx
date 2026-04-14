import { redirect } from "next/navigation";

// 운영 가이드는 운영 지원 센터의 "운영 매뉴얼" 탭으로 통합되었습니다.
// canonical route: /dashboard/support-center?tab=manual
export default function DashboardGuideRedirectPage() {
  redirect("/dashboard/support-center?tab=manual");
}
