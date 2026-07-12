/**
 * §inventory-action-menu-clip-fix (호영님 재고 지시문 §1) — ⋮ 메뉴 잘림 수정 sentinel.
 *
 * 근본원인: ActionMenu 메뉴가 absolute top-full → 부모 카드 overflow-hidden /
 *   테이블 overflow-x-auto 경계에서 잘림.
 * 수정: position:fixed + getBoundingClientRect 앵커(overflow 탈출) + flip-up(하단 여백
 *   부족 시 위로) + 스크롤/리사이즈 시 닫힘. backdrop·단일 open·role="menu"·a11y 보존.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "../../components/inventory/action-menu.tsx"),
  "utf8",
);

describe("§inventory-action-menu-clip-fix — overflow 탈출 + flip-up", () => {
  it("메뉴가 position:fixed 로 렌더(overflow 컨텍스트 탈출)", () => {
    expect(SRC).toMatch(/position:\s*"fixed"/);
    // 구 absolute top-full 드롭 제거(잘림 원인 재발 방지)
    expect(SRC).not.toMatch(/absolute right-0 top-full/);
  });

  it("getBoundingClientRect 앵커 + flip-up(openUp) 산출", () => {
    expect(SRC).toMatch(/getBoundingClientRect\(\)/);
    expect(SRC).toMatch(/const openUp =/);
    expect(SRC).toMatch(/window\.innerHeight/);
    // openUp 시 bottom, 아니면 top 좌표
    expect(SRC).toMatch(/bottom: window\.innerHeight - r\.top/);
    expect(SRC).toMatch(/top: r\.bottom \+ 4/);
  });

  it("스크롤/리사이즈 시 닫힘(fixed 오정렬 방지)", () => {
    expect(SRC).toMatch(/addEventListener\("scroll", close, true\)/);
    expect(SRC).toMatch(/addEventListener\("resize", close\)/);
    expect(SRC).toMatch(/removeEventListener\("scroll", close, true\)/);
  });

  it("회귀 0 — backdrop·단일 open·role·a11y 보존(§11.297b)", () => {
    expect(SRC).toMatch(/fixed inset-0[\s\S]{0,120}onClick=\{\(\)\s*=>\s*onOpenChange\(null\)\}/);
    expect(SRC).toMatch(/const isOpen = currentOpenId === menuId/);
    expect(SRC).toMatch(/role="menu"/);
    expect(SRC).toMatch(/aria-label="작업 메뉴"/);
    expect(SRC).toMatch(/aria-haspopup="menu"/);
    expect(SRC).toMatch(/<MoreVertical[\s\S]{0,60}pointer-events-none/);
  });
});
