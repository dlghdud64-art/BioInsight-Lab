import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const SIDEBAR = "src/app/_components/dashboard-sidebar.tsx";

describe("§11.333 — 사이드바 상단 로고 칸 흰색(헤더 정합)", () => {
  it("로고 칸이 흰 배경 + 하단 border 없음(§11.333-hotfix: 상단 줄 제거)", () => {
    const src = read(SIDEBAR);
    expect(src).toMatch(/h-16 hidden lg:flex items-center px-4 bg-white flex-shrink-0/);
    // 흰 로고칸 하단 border 잔재 0 (좌측 상단 줄 원인)
    expect(src).not.toMatch(/px-4 border-b border-slate-200 bg-white/);
    expect(src).not.toMatch(/border-b border-slate-800/);
  });

  it("로고 텍스트가 검정(흰 배경 가독)", () => {
    const src = read(SIDEBAR);
    expect(src).toMatch(/text-xl font-bold tracking-tight text-slate-900">LabAxis/);
  });

  it("본문 사이드바는 네이비 유지 + 세로 구분선(border-r) 제거", () => {
    const src = read(SIDEBAR);
    // 데스크탑 고정 사이드바 = 네이비, border-r 없음(호영님 2026-07-08 세로 구분선 제거)
    expect(src).toMatch(/hidden lg:flex lg:flex-col fixed inset-y-0 left-0 w-64 bg-slate-900 z-30/);
    expect(src).not.toMatch(/w-64 bg-slate-900 border-r border-slate-800/);
  });
});
