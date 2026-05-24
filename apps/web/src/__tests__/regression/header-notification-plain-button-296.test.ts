/**
 * §11.296 #header-notification-plain-button — Header 알림 plain button.
 *
 * 호영님 권장 (2026-05-24): §11.283b/§11.295 패턴 정합 — Header.tsx 3
 *   dropdown 마지막 (알림) 도 plain button + useState pattern 으로 단순화.
 *   notifications list + unreadCount + handleMarkAllRead +
 *   handleNotificationClick + helper 함수 모두 보존 (UI render swap).
 *
 * Header.tsx 3 dropdown 모두 plain button 단순화 완료 → Radix import 제거.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const HEADER = readFileSync(
  resolve(__dirname, "../../components/dashboard/Header.tsx"),
  "utf8",
);

describe("§11.296 — Header 알림 dropdown plain button + Radix import 제거", () => {
  it("§11.296 trace marker", () => {
    expect(HEADER).toMatch(/§11\.296/);
  });

  describe("알림 dropdown — plain button", () => {
    it('plain <button aria-label="알림"> + onClick toggle (Radix DropdownMenuTrigger 제거)', () => {
      expect(HEADER).toMatch(
        /<button[\s\S]{0,400}aria-label="알림"[\s\S]{0,200}onClick=\{\(\)\s*=>\s*setIsNotificationOpen/,
      );
    });

    it("aria-expanded={isNotificationOpen} + aria-haspopup=\"menu\"", () => {
      expect(HEADER).toMatch(/aria-expanded=\{isNotificationOpen\}/);
    });

    it("Bell icon + unreadCount badge 보존 (pointer-events-none)", () => {
      expect(HEADER).toMatch(/<Bell[\s\S]{0,100}pointer-events-none/);
      expect(HEADER).toMatch(/\{unreadCount\}/);
    });

    it('조건부 render + backdrop + role="menu" + aria-label="알림 메뉴"', () => {
      expect(HEADER).toMatch(/\{isNotificationOpen && \(/);
      expect(HEADER).toMatch(/aria-label="알림 메뉴"/);
    });

    it("notifications.slice(0, 8).map + isRead 분기 + handleNotificationClick 보존", () => {
      expect(HEADER).toMatch(/notifications\.slice\(0,\s*8\)\.map/);
      expect(HEADER).toMatch(/n\.readAt !== null/);
      expect(HEADER).toMatch(/handleNotificationClick\(n\)/);
    });

    it("handleMarkAllRead + '모두 읽음' button 보존", () => {
      expect(HEADER).toMatch(/handleMarkAllRead/);
      expect(HEADER).toMatch(/모두 읽음/);
    });

    it("푸터 Link '전체 알림 보기' + setIsNotificationOpen(false) 보존", () => {
      expect(HEADER).toMatch(/전체 알림 보기/);
      expect(HEADER).toMatch(/href="\/dashboard\/notifications"[\s\S]{0,200}setIsNotificationOpen\(false\)/);
    });

    it("helper 함수 (eventTypeToCategory / CATEGORY_CONFIG / renderCategoryIcon / buildNotificationText / formatNotificationTime) 보존", () => {
      expect(HEADER).toMatch(/eventTypeToCategory\(n\.event\.eventType\)/);
      expect(HEADER).toMatch(/CATEGORY_CONFIG\[category\]/);
      expect(HEADER).toMatch(/renderCategoryIcon\(category, isRead\)/);
      expect(HEADER).toMatch(/buildNotificationText\(n\)/);
      expect(HEADER).toMatch(/formatNotificationTime\(n\.createdAt\)/);
    });
  });

  describe("Header.tsx 3 dropdown 모두 plain button 완료 (Radix import 제거)", () => {
    it("DropdownMenu / DropdownMenuTrigger / DropdownMenuContent / DropdownMenuItem / DropdownMenuLabel / DropdownMenuSeparator import 부재", () => {
      expect(HEADER).not.toMatch(/^import\s*\{[^\}]{0,300}DropdownMenu/m);
    });

    it("DropdownMenu / DropdownMenuTrigger / DropdownMenuContent 사용 부재", () => {
      expect(HEADER).not.toMatch(/<DropdownMenu(?!Trigger|Content|Item|Label|Separator)\s/);
      expect(HEADER).not.toMatch(/<DropdownMenuTrigger/);
      expect(HEADER).not.toMatch(/<DropdownMenuContent/);
      expect(HEADER).not.toMatch(/<DropdownMenuItem/);
    });
  });

  describe("회귀 0 — 이전 §11.295 + §11.282-a 보존", () => {
    it("§11.295 도움말 + 프로필 plain button wiring 보존", () => {
      expect(HEADER).toMatch(/§11\.295/);
      expect(HEADER).toMatch(/aria-label="도움말 메뉴"/);
      expect(HEADER).toMatch(/aria-label="프로필 메뉴"/);
    });

    it("§11.282-a 모바일 햄버거 Menu icon pointer-events-none 보존", () => {
      expect(HEADER).toMatch(/§11\.282-a/);
      expect(HEADER).toMatch(/<Menu[\s\S]{0,100}pointer-events-none/);
    });

    it("BarcodeScanFab inline mount 보존 (§11.271)", () => {
      expect(HEADER).toMatch(/<BarcodeScanFab/);
    });
  });
});
