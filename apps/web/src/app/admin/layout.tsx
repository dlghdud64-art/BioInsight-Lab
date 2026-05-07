/**
 * §11.126 #admin-skip-link
 *
 * Admin domain layout — 7 admin page 공통 wrapper.
 *
 * 책임:
 *   - skip-link anchor (WCAG 2.4.1 Bypass Blocks) — 키보드 사용자가 sidebar
 *     건너뛰고 main 으로 이동
 *   - <main id="admin-main"> wrapper — anchor target + landmark
 *
 * NOTE: 기존 admin page 들이 직접 AdminSidebar 를 mount 하는 패턴 유지.
 * 본 layout 은 children 만 wrap — sidebar 중복 회피. main landmark 안에
 * page 의 sidebar+content 구조가 그대로 들어감 (WCAG 관점에서 main 1개
 * 만 있으면 정합).
 *
 * §11.125 DashboardShell skip-link 와 동일 패턴 — admin domain 한정.
 */

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* §11.214c — focus: → focus-visible: swap (자동 focus 시 visible 0) */}
      <a
        href="#admin-main"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-[100] focus-visible:bg-blue-600 focus-visible:text-white focus-visible:px-3 focus-visible:py-2 focus-visible:rounded-md focus-visible:text-sm focus-visible:font-semibold focus-visible:shadow-lg"
      >
        본문 바로가기
      </a>
      <main id="admin-main" tabIndex={-1} className="outline-none">
        {children}
      </main>
    </>
  );
}
