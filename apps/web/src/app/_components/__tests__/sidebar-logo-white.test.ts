import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const SIDEBAR = "src/app/_components/dashboard-sidebar.tsx";

/**
 * §sidebar-navy-top(호영님 2026-07-08) — 사이드바 풀하이트 네이비.
 *   §11.333(로고칸 흰색)의 의도적 reversal. 로고가 흰 바닥 위에 떠 보이던 상단
 *   이음매 제거 — 로고칸+메뉴를 하나의 네이비 바닥으로 감싸고, 흰 헤더는 오른쪽
 *   콘텐츠 영역(.main)에서만 시작. 네이비 톤은 --sidebar-navy 전역 토큰 한 곳.
 */
describe("§sidebar-navy-top — 로고칸 네이비(풀하이트, 상단 이음매 제거)", () => {
  it("로고 칸이 네이비(--sidebar-navy) — 흰 배경 잔재 0", () => {
    const src = read(SIDEBAR);
    expect(src).toMatch(
      /h-16 hidden lg:flex items-center px-4 bg-\[var\(--sidebar-navy\)\] flex-shrink-0/,
    );
    // 흰 로고칸 회귀 차단(§11.333 reversal)
    expect(src).not.toMatch(/px-4 bg-white flex-shrink-0/);
  });

  it("로고 텍스트가 흰색(네이비 배경 가독)", () => {
    const src = read(SIDEBAR);
    expect(src).toMatch(/text-xl font-bold tracking-tight text-white">LabAxis/);
    expect(src).not.toMatch(/tracking-tight text-slate-900">LabAxis/);
  });

  it("데스크탑 고정 사이드바 = 네이비 토큰, 세로 구분선(border-r) 없음", () => {
    const src = read(SIDEBAR);
    expect(src).toMatch(
      /hidden lg:flex lg:flex-col fixed inset-y-0 left-0 w-64 bg-\[var\(--sidebar-navy\)\] z-30/,
    );
    expect(src).not.toMatch(/w-64 bg-slate-900/);
  });
});
