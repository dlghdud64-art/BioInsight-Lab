import { redirect } from "next/navigation";

// 지원 문의는 운영 지원 센터의 "지원 티켓" 탭으로 통합되었습니다.
// canonical route: /dashboard/support-center?tab=ticket
export default function DashboardSupportRedirectPage() {
  redirect("/dashboard/support-center?tab=ticket");
}
