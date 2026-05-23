/**
 * §11.272e + §11.272d — 호영님 P0 5차 보고 hot fix.
 *
 * 1. skip-link 완전 삭제 — §11.272a-redo / §11.272a-redo-2 / §11.272d
 *    (sr-only + focus:not-sr-only) 모든 hot fix 후에도 호영님 데스크탑
 *    환경 좌상단 "본문 바로가기" visible. CSS hot fix 의존 한계 인정.
 *    element 자체 제거. WCAG 2.4.1 a11y trade-off 인정.
 * 2. FAB: bodyScrollLocked watch → Radix Sheet/Dialog open 시 FAB hidden
 *    (이 부분은 §11.272d 그대로 유지).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DASHBOARD_SHELL = readFileSync(
  resolve(__dirname, "../../app/dashboard/_components/dashboard-shell.tsx"),
  "utf8",
);
const ADMIN_LAYOUT = readFileSync(
  resolve(__dirname, "../../app/admin/layout.tsx"),
  "utf8",
);
const FAB = readFileSync(
  resolve(__dirname, "../../components/operational-brief/floating-entry.tsx"),
  "utf8",
);

describe("§11.272e + §11.272d — skip-link 완전 삭제 + FAB sheet overlap hide", () => {
  describe("skip-link — 완전 삭제 (§11.272e)", () => {
    it("dashboard-shell §11.272e trace marker + skip-link <a> element 잔존 부재", () => {
      expect(DASHBOARD_SHELL).toMatch(/§11\.272e/);
      // skip-link <a href="#main-content"> element 자체 부재
      expect(DASHBOARD_SHELL).not.toMatch(/href="#main-content"/);
      // <a ...>본문 바로가기</a> 패턴 부재 (comment 안의 "본문 바로가기"는 허용)
      expect(DASHBOARD_SHELL).not.toMatch(/<a[\s\S]{0,300}>본문 바로가기<\/a>/);
    });

    it("admin/layout §11.272e trace marker + skip-link <a> element 잔존 부재", () => {
      expect(ADMIN_LAYOUT).toMatch(/§11\.272e/);
      expect(ADMIN_LAYOUT).not.toMatch(/href="#admin-main"/);
      expect(ADMIN_LAYOUT).not.toMatch(/<a[\s\S]{0,300}>본문 바로가기<\/a>/);
    });

    it("기존 main id (#main-content, #admin-main) anchor target 보존", () => {
      // skip-link 만 제거. main element 의 id 는 그대로 (다른 anchor 가능성)
      expect(ADMIN_LAYOUT).toMatch(/id="admin-main"/);
    });
  });

  describe("FAB — bodyScrollLocked watch (§11.272d 보존)", () => {
    it("§11.272d trace + useBodyScrollLocked helper", () => {
      expect(FAB).toMatch(/§11\.272d/);
      expect(FAB).toMatch(/useBodyScrollLocked/);
    });

    it("MutationObserver + body data-scroll-locked / style.overflow watch", () => {
      expect(FAB).toMatch(/MutationObserver/);
      expect(FAB).toMatch(/data-scroll-locked/);
      expect(FAB).toMatch(/overflow.*hidden|style\.overflow/);
    });

    it("bodyScrollLocked → return null (FAB hidden)", () => {
      expect(FAB).toMatch(/bodyScrollLocked\s*\)\s*return null/);
    });

    it("기존 popup.isOpen aria-expanded 동기 보존 (회귀 0)", () => {
      expect(FAB).toMatch(/popup\.isOpen/);
      expect(FAB).toMatch(/aria-expanded/);
    });
  });
});
