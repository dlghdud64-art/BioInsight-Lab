/**
 * §11.125 → §11.272e #dashboard-skip-link (retire/정합)
 *
 * §11.125 는 DashboardShell 에 skip-link anchor(#main-content)를 추가했으나,
 * §11.272e(호영님 P0 5차 결정, 2026-xx)에서 skip-link element 를 **의도적으로
 * 완전 삭제**했다. sr-only + focus:not-sr-only 5차 hot fix 후에도 호영님 데스크탑
 * 좌상단 "본문 바로가기" visible 회귀가 재발 → element 자체 제거로 종결(WCAG
 * 2.4.1 Bypass Blocks a11y trade-off 인정, 키보드는 브라우저 기본 Tab).
 *
 * 본 sentinel 은 그 최신 truth(§11.272e)로 정합한다.
 *   - main id="main-content" anchor 는 보존(대시보드 main 앵커)
 *   - skip-link element(href="#main-content" / "본문 바로가기")는 부재여야 함
 *   - DashboardSidebar / mobile drawer 회귀 0
 * ⚠ skip-link 재추가 금지 — §11.272e(호영님 P0) 되돌림 + visible 회귀 재발.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PATH = resolve(
  __dirname,
  "../../../app/dashboard/_components/dashboard-shell.tsx",
);

describe("DashboardShell skip-link — §11.272e 제거 정합", () => {
  const source = readFileSync(PATH, "utf8");

  it("main 에 id=\"main-content\" 앵커 보존", () => {
    expect(source).toMatch(/id="main-content"/);
  });

  it("skip-link element 부재 (§11.272e 삭제 — anchor href/focus 클래스 0)", () => {
    // ⚠ "본문 바로가기" 문자열은 §11.272e 설명 주석에 잔존하므로 절대 assert 대상 아님.
    //   skip-link element 고유 시그니처(href=#main-content, focus-visible:not-sr-only)로 부재 판정.
    expect(source).not.toMatch(/href="#main-content"/);
    expect(source).not.toMatch(/focus-visible:not-sr-only/);
  });

  it("회귀 0 — DashboardSidebar 그대로", () => {
    expect(source).toMatch(/DashboardSidebar/);
  });
});
