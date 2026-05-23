/**
 * §11.272a-redo-2 + §11.272d — 호영님 P0 3차 보고 hot fix.
 *
 * 1. skip-link: focus-visible → focus swap (iOS Safari 의 :focus-visible
 *    임의 적용 회피 → 모바일 항상 visible 회귀 차단)
 * 2. FAB: bodyScrollLocked watch → Radix Sheet/Dialog open 시 FAB hidden
 *    (견적 detail sheet 의 primary CTA "회신 검토 시작 →" 겹침 해소)
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

describe("§11.272a-redo-2 + §11.272d — skip-link sr-only + FAB sheet overlap hide", () => {
  describe("skip-link — focus (NOT focus-visible)", () => {
    it("dashboard-shell §11.272a-redo-2 trace + focus:not-sr-only (focus-visible 제거)", () => {
      expect(DASHBOARD_SHELL).toMatch(/§11\.272a-redo-2/);
      expect(DASHBOARD_SHELL).toMatch(/focus:not-sr-only/);
      // focus-visible: 가 제거됐는지 (skip-link 의 className 안에)
      expect(DASHBOARD_SHELL).not.toMatch(/focus-visible:not-sr-only/);
    });

    it("admin/layout §11.272a-redo-2 trace + focus:not-sr-only", () => {
      expect(ADMIN_LAYOUT).toMatch(/§11\.272a-redo-2/);
      expect(ADMIN_LAYOUT).toMatch(/focus:not-sr-only/);
      expect(ADMIN_LAYOUT).not.toMatch(/focus-visible:not-sr-only/);
    });

    it("absolute left-[-9999px] 3-layer defense 제거 (sr-only + focus 만으로 충분)", () => {
      // §11.272a-redo 의 absolute -9999px off-screen 패턴 제거 (sr-only 만 사용)
      // dashboard-shell 의 skip-link className 에 absolute left-[-9999px] 없음
      const skipLinkSection = DASHBOARD_SHELL.match(
        /href="#main-content"[\s\S]*?>/,
      );
      expect(skipLinkSection).not.toBeNull();
      expect(skipLinkSection![0]).not.toMatch(/left-\[-9999px\]/);
    });
  });

  describe("FAB — bodyScrollLocked watch", () => {
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
