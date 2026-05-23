/**
 * §11.283b #sourcing-hamburger-plain-button — 호영님 P0+ 5차 단순화 sentinel.
 *
 * 호영님 P0+ 5차 (2026-05-24) 단순화:
 *   §11.280 / §11.280-2 / §11.282-d / §11.282-e / §11.283 (Radix wiring
 *   5차 hot fix) 후에도 호영님 환경 dead button. Radix DropdownMenu 자체
 *   제거 + plain <button> + useState + 조건부 <div> menu 로 단순화.
 *
 * Fix:
 *   - import 의 DropdownMenu wiring 제거 (Radix dependency 0)
 *   - hamburgerOpen useState
 *   - plain <button onClick> + aria-expanded + aria-haspopup
 *   - 조건부 backdrop (외부 click close) + role="menu" + 5 Link
 *   - menuItem onClick 으로 setHamburgerOpen(false) → navigate 직후 close
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../app/_workbench/search/page.tsx"),
  "utf8",
);

describe("§11.283b — 소싱 햄버거 plain button + useState 단순화", () => {
  it("§11.283b trace marker + sourcing-hamburger-plain-button comment", () => {
    expect(PAGE).toMatch(/§11\.283b/);
    expect(PAGE).toMatch(/sourcing-hamburger-plain-button/);
  });

  it("hamburgerOpen useState 정의 (plain state, Radix uncontrolled 대체)", () => {
    expect(PAGE).toMatch(/const \[hamburgerOpen, setHamburgerOpen\] = useState\(false\)/);
  });

  it('plain <button aria-label="메뉴 열기"> + onClick toggle (Radix DropdownMenuTrigger 제거)', () => {
    expect(PAGE).toMatch(
      /<button[\s\S]{0,300}aria-label="메뉴 열기"[\s\S]{0,200}onClick=\{\(\)\s*=>\s*setHamburgerOpen/,
    );
  });

  it("aria-expanded={hamburgerOpen} + aria-haspopup=\"menu\" (a11y 보장)", () => {
    expect(PAGE).toMatch(/aria-expanded=\{hamburgerOpen\}/);
    expect(PAGE).toMatch(/aria-haspopup="menu"/);
  });

  it("hamburgerOpen 조건부 render — backdrop + role=\"menu\" 구조", () => {
    expect(PAGE).toMatch(/\{hamburgerOpen && \(/);
    expect(PAGE).toMatch(/role="menu"/);
    expect(PAGE).toMatch(/aria-label="주요 화면"/);
  });

  it("backdrop (fixed inset-0) 외부 click 시 setHamburgerOpen(false) close", () => {
    expect(PAGE).toMatch(
      /fixed inset-0[\s\S]{0,200}onClick=\{\(\)\s*=>\s*setHamburgerOpen\(false\)\}/,
    );
  });

  it("기존 menuItem 5종 (대시보드/견적/구매/재고/설정) Link href 보존 — 회귀 0", () => {
    expect(PAGE).toMatch(/href="\/dashboard"[\s\S]{0,500}대시보드/);
    expect(PAGE).toMatch(/href="\/dashboard\/quotes"[\s\S]{0,500}견적 관리/);
    expect(PAGE).toMatch(/href="\/dashboard\/purchases"[\s\S]{0,500}구매 운영/);
    expect(PAGE).toMatch(/href="\/dashboard\/inventory"[\s\S]{0,500}재고 관리/);
    expect(PAGE).toMatch(/href="\/dashboard\/settings"[\s\S]{0,500}설정/);
  });

  it("각 menuItem onClick 시 setHamburgerOpen(false) — navigate 직후 close", () => {
    // 5개 Link 모두 onClick={() => setHamburgerOpen(false)} 패턴 있는지
    const closeCloses = (PAGE.match(/onClick=\{\(\)\s*=>\s*setHamburgerOpen\(false\)\}/g) || []).length;
    expect(closeCloses).toBeGreaterThanOrEqual(6); // backdrop 1 + menuItem 5 = 6
  });

  it("§11.280-2 Menu icon pointer-events-none 보존 (button click target trap 회피)", () => {
    expect(PAGE).toMatch(/<Menu[\s\S]{0,100}pointer-events-none/);
  });

  it("§11.282-d touch-manipulation + webkit-tap-highlight 보존 (mobile UX)", () => {
    expect(PAGE).toMatch(/touch-manipulation/);
    expect(PAGE).toMatch(/\[-webkit-tap-highlight-color:transparent\]/);
  });
});
