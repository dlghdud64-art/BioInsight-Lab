import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const SIDEBAR = "src/app/_components/dashboard-sidebar.tsx";

describe("§11.333 — 사이드바 상단 로고 칸 흰색(헤더 정합)", () => {
  it("로고 칸이 흰 배경 + 밝은 보더", () => {
    const src = read(SIDEBAR);
    expect(src).toMatch(/h-16 hidden lg:flex items-center px-4 border-b border-slate-200 bg-white/);
    expect(src).not.toMatch(/h-16 hidden lg:flex items-center px-4 border-b border-slate-800 flex-shrink-0/);
  });

  it("로고 텍스트가 검정(흰 배경 가독)", () => {
    const src = read(SIDEBAR);
    expect(src).toMatch(/text-xl font-bold tracking-tight text-slate-900">LabAxis/);
  });

  it("본문 사이드바는 네이비 유지 (회귀 0)", () => {
    const src = read(SIDEBAR);
    expect(src).toMatch(/w-64 bg-slate-900 border-r border-slate-800/);
  });
});
