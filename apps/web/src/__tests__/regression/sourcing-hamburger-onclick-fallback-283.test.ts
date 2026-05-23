/**
 * §11.283 #sourcing-hamburger-onClick-fallback — 호영님 P0+ 4차 진단 sentinel.
 *
 * 호영님 P0+ 4차 (2026-05-24) audit:
 *   - Sandbox + 호영님 console 결과 동일:
 *     · reactKeys: ['__reactFiber...', '__reactProps...'] (React hydrate 정상)
 *     · props: 13개 (onPointerDown + onKeyDown attach 정상)
 *     · onPointerDown: "function" (Radix handler 정상)
 *     · native pointerdown PD@ 로그 → TARGET: BUTTON 메뉴 열기 (button hit 정상)
 *   - 그런데 호영님 환경에서 dropdown 안 열림 = React event delegation 이
 *     특정 환경 (브라우저/OS/마우스 driver 조합) 에서 onPointerDown 까지
 *     fire 안 함 (browser/OS level trap)
 *
 * Fix: DropdownMenuTrigger 에 onClick fallback prop 추가 — data-state=closed
 *   이면 PointerEvent('pointerdown') 강제 dispatch → Radix internal handler
 *   가 받아서 setOpen(true). Radix uncontrolled mode 유지 (§11.282-e asChild
 *   제거 보존, §11.280-2 Menu icon pointer-events-none 보존,
 *   §11.282-d touch-manipulation 보존). defense-in-depth — 모든 환경 cover.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../app/_workbench/search/page.tsx"),
  "utf8",
);

describe("§11.283 — 소싱 햄버거 onClick fallback (defense-in-depth)", () => {
  it("§11.283 trace marker + sourcing-hamburger-onClick-fallback comment", () => {
    expect(PAGE).toMatch(/§11\.283/);
    expect(PAGE).toMatch(/sourcing-hamburger-onClick-fallback/);
  });

  it('DropdownMenuTrigger aria-label="메뉴 열기" + onClick prop wiring', () => {
    expect(PAGE).toMatch(
      /aria-label="메뉴 열기"[\s\S]{0,200}onClick=\{\(e\)\s*=>/,
    );
  });

  it("onClick fallback 내부 data-state=\"closed\" 분기", () => {
    expect(PAGE).toMatch(/getAttribute\("data-state"\)\s*===\s*"closed"/);
  });

  it("onClick fallback 내부 PointerEvent('pointerdown') 강제 dispatch", () => {
    expect(PAGE).toMatch(
      /dispatchEvent\(\s*[\s\S]{0,50}new PointerEvent\(\s*"pointerdown"/,
    );
  });

  it("PointerEvent options — isPrimary:true / bubbles:true / button:0", () => {
    expect(PAGE).toMatch(/isPrimary:\s*true/);
    expect(PAGE).toMatch(/bubbles:\s*true/);
    expect(PAGE).toMatch(/button:\s*0/);
  });

  it("기존 §11.280-2 Menu icon pointer-events-none 보존", () => {
    expect(PAGE).toMatch(/<Menu[\s\S]{0,100}pointer-events-none/);
  });

  it("기존 §11.282-d touch-manipulation + webkit-tap-highlight 보존", () => {
    expect(PAGE).toMatch(/touch-manipulation/);
    expect(PAGE).toMatch(/\[-webkit-tap-highlight-color:transparent\]/);
  });

  it("기존 §11.282-e asChild 제거 보존 (DropdownMenuTrigger type=\"button\")", () => {
    expect(PAGE).toMatch(/<DropdownMenuTrigger[\s\S]{0,300}type="button"/);
    expect(PAGE).not.toMatch(/<DropdownMenuTrigger\s+asChild[\s\S]{0,300}aria-label="메뉴 열기"/);
  });

  it("기존 menuItem 5종 (대시보드/견적/구매/재고/설정) 보존 (회귀 0)", () => {
    expect(PAGE).toMatch(/href="\/dashboard"[\s\S]{0,200}대시보드/);
    expect(PAGE).toMatch(/href="\/dashboard\/quotes"[\s\S]{0,200}견적 관리/);
    expect(PAGE).toMatch(/href="\/dashboard\/purchases"[\s\S]{0,200}구매 운영/);
    expect(PAGE).toMatch(/href="\/dashboard\/inventory"[\s\S]{0,200}재고 관리/);
    expect(PAGE).toMatch(/href="\/dashboard\/settings"[\s\S]{0,200}설정/);
  });
});
