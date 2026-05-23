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
      {/* §11.272a-redo-2 — focus-visible → focus swap (호영님 P0 3차 회귀
          보고). iOS Safari 의 :focus-visible 임의 적용 회피. dashboard-shell
          과 동일 패턴. */}
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:bg-blue-600 focus:text-white focus:px-3 focus:py-2 focus:rounded-md focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        본문 바로가기
      </a>
      <main id="admin-main" tabIndex={-1} className="outline-none">
        {children}
      </main>
    </>
  );
}
