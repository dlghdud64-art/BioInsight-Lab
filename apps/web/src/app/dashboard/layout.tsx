import { DashboardShell } from "./_components/dashboard-shell";
// §onboarding-blocker 3a — 조직 이름 확인 1스텝. same-canvas(신규 라우트 0).
import { OrganizationNamePrompt } from "@/components/onboarding/organization-name-prompt";

export const dynamic = 'force-dynamic';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell>
      {/* 임시 조직명일 때만 렌더된다(확정되면 null) — 상시 노출 0. */}
      <OrganizationNamePrompt />
      {children}
    </DashboardShell>
  );
}
