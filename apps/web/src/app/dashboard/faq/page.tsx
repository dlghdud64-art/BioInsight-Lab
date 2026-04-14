import { redirect } from "next/navigation";

// FAQ는 운영 지원 센터의 "문제 해결" 탭(런북)으로 통합되었습니다.
// canonical route: /dashboard/support-center?tab=troubleshoot
export default function DashboardFaqRedirectPage() {
  redirect("/dashboard/support-center?tab=troubleshoot");
}
