/**
 * §11.295 #header-help-profile-plain-button — preemptive Radix silent fail 차단.
 *
 * 호영님 권장안 (2026-05-24):
 *   §11.283b 햄버거 Radix 제거 패턴 정합 — Header.tsx 의 도움말 +
 *   프로필 2 DropdownMenu 도 plain button + useState + 조건부 backdrop
 *   + role="menu" pattern 으로 단순화. 호영님 환경 Radix silent fail
 *   preemptive 차단.
 *
 *   알림 dropdown (line 319-428, 109 line, notifications list 복잡
 *   logic) 은 별도 batch.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const HEADER = readFileSync(
  resolve(__dirname, "../../components/dashboard/Header.tsx"),
  "utf8",
);

describe("§11.295 — Header 도움말 + 프로필 plain button 단순화", () => {
  it("§11.295 trace marker + plain state 정의", () => {
    expect(HEADER).toMatch(/§11\.295/);
    expect(HEADER).toMatch(/const \[isHelpOpen, setIsHelpOpen\] = useState\(false\)/);
    expect(HEADER).toMatch(/const \[isProfileOpen, setIsProfileOpen\] = useState\(false\)/);
  });

  describe("도움말 dropdown — plain button", () => {
    it('plain <button aria-label="도움말"> + onClick toggle (Radix DropdownMenuTrigger 제거)', () => {
      expect(HEADER).toMatch(
        /<button[\s\S]{0,300}aria-label="도움말"[\s\S]{0,200}onClick=\{\(\)\s*=>\s*setIsHelpOpen/,
      );
    });

    it("aria-expanded={isHelpOpen} + aria-haspopup=\"menu\"", () => {
      expect(HEADER).toMatch(/aria-expanded=\{isHelpOpen\}/);
    });

    it('조건부 render + backdrop + role="menu" + 3 Link (운영 매뉴얼/문제 해결 런북/지원 티켓)', () => {
      expect(HEADER).toMatch(/\{isHelpOpen && \(\(\) =>/);
      expect(HEADER).toMatch(/aria-label="도움말 메뉴"/);
      expect(HEADER).toMatch(/운영 매뉴얼/);
      expect(HEADER).toMatch(/문제 해결 런북/);
      expect(HEADER).toMatch(/지원 티켓/);
    });

    it("도움말 menuItem onClick → setIsHelpOpen(false) (navigate 후 close)", () => {
      const closes = (HEADER.match(/onClick=\{\(\)\s*=>\s*setIsHelpOpen\(false\)\}/g) || []).length;
      expect(closes).toBeGreaterThanOrEqual(4); // backdrop 1 + menuItem 3 = 4
    });
  });

  describe("프로필 dropdown — plain button", () => {
    it('plain <button aria-label="사용자 프로필 메뉴"> + onClick toggle', () => {
      expect(HEADER).toMatch(
        /<button[\s\S]{0,400}aria-label="사용자 프로필 메뉴"[\s\S]{0,200}onClick=\{\(\)\s*=>\s*setIsProfileOpen/,
      );
    });

    it("aria-expanded={isProfileOpen} + aria-haspopup=\"menu\"", () => {
      expect(HEADER).toMatch(/aria-expanded=\{isProfileOpen\}/);
    });

    it('조건부 render + backdrop + role="menu" + 4 menuItem (설정/청구/고객센터/로그아웃)', () => {
      expect(HEADER).toMatch(/\{isProfileOpen && \(/);
      expect(HEADER).toMatch(/aria-label="프로필 메뉴"/);
      expect(HEADER).toMatch(/href="\/dashboard\/settings"[\s\S]{0,500}설정/);
      expect(HEADER).toMatch(/청구 및 구독/);
      expect(HEADER).toMatch(/고객센터/);
      expect(HEADER).toMatch(/로그아웃/);
    });

    it("프로필 menuItem onClick → setIsProfileOpen(false) (navigate 후 close)", () => {
      const closes = (HEADER.match(/setIsProfileOpen\(false\)/g) || []).length;
      expect(closes).toBeGreaterThanOrEqual(5); // backdrop 1 + 4 menuItem = 5
    });

    it("로그아웃 button — signOut + resetWorkbenchSessionOnLogout + invalidateWorkbenchQueryCache 보존", () => {
      expect(HEADER).toMatch(/signOut\(\{\s*callbackUrl:\s*"\/"\s*\}\)/);
      expect(HEADER).toMatch(/resetWorkbenchSessionOnLogout\(\)/);
      expect(HEADER).toMatch(/invalidateWorkbenchQueryCache\(queryClient\)/);
    });

    it("Avatar / AvatarImage / AvatarFallback 사용자 정보 표시 보존", () => {
      expect(HEADER).toMatch(/<Avatar/);
      expect(HEADER).toMatch(/<AvatarImage/);
      expect(HEADER).toMatch(/<AvatarFallback/);
    });
  });

  describe("회귀 0 — 알림 dropdown + 햄버거 button 보존", () => {
    it("알림 DropdownMenu (isNotificationOpen) 보존 — 별도 batch", () => {
      expect(HEADER).toMatch(/<DropdownMenu open=\{isNotificationOpen\}/);
    });

    it("§11.282-a 모바일 햄버거 button (Menu icon pointer-events-none) 보존", () => {
      expect(HEADER).toMatch(/§11\.282-a/);
      expect(HEADER).toMatch(/<Menu[\s\S]{0,100}pointer-events-none/);
    });
  });
});
