/**
 * §11.125 #dashboard-skip-link
 *
 * Source-level regression guard — DashboardShell 에 skip-link anchor +
 * main id="main-content" 추가. 키보드 사용자 / 스크린 리더가 sidebar nav
 * 건너뛰고 main 으로 빠르게 이동.
 *
 * WCAG 2.1 SC 2.4.1 Bypass Blocks 정합.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(
  __dirname,
  "../../../app/dashboard/_components/dashboard-shell.tsx",
);

describe("DashboardShell skip-link — regression guard (§11.125)", () => {
  const source = readFileSync(PATH, "utf8");

  it("main 에 id=\"main-content\" 부착", () => {
    expect(source).toMatch(/id="main-content"/);
  });

  it("skip-link anchor 존재 (href=#main-content)", () => {
    expect(source).toMatch(/href="#main-content"/);
  });

  it("skip-link 이 sr-only by default + focus 시 노출 (focus:not-sr-only)", () => {
    expect(source).toMatch(/sr-only/);
    expect(source).toMatch(/focus:not-sr-only/);
  });

  it("한국어 텍스트 \"본문 바로가기\" 또는 \"Skip to main content\"", () => {
    expect(source).toMatch(/본문 바로가기|Skip to main/);
  });

  it("기존 mobile drawer + sidebar 회귀 0 — DashboardSidebar 그대로", () => {
    expect(source).toMatch(/DashboardSidebar/);
  });
});
