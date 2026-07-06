import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const SHELL = "src/app/dashboard/_components/dashboard-shell.tsx";
const HEADER = "src/components/dashboard/Header.tsx";

describe("§11.331 — 모바일 상단 햄버거 제거(하단 더보기 일원화)", () => {
  it("DashboardShell 이 Header 에 onMenuClick 을 주입하지 않는다", () => {
    const src = read(SHELL);
    expect(src).not.toMatch(/onMenuClick=\{\(\) => setIsMobileMenuOpen/);
    expect(src).toMatch(/<DashboardHeader \/>/);
  });

  it("Header 햄버거는 onMenuClick 조건부라 미주입 시 렌더되지 않는다 (구조 보존)", () => {
    const src = read(HEADER);
    expect(src).toMatch(/\{onMenuClick && \(/);
  });

  it("하단 BottomNav 는 그대로 유지된다 (네비 일원화 대상)", () => {
    const src = read(SHELL);
    expect(src).toMatch(/<BottomNav \/>/);
  });
});
