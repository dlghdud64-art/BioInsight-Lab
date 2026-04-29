/**
 * §11.119 #order-operator-surface-mobile
 *
 * Source-level regression guard — admin/orders page.tsx 가 모바일 분기
 * (md:hidden / hidden md:block) 와 mobile card list 를 보유하는지 확인.
 *
 * 목적: 향후 desktop-only 회귀 차단. table 만 남기고 mobile card 제거하는
 * regression 을 build time 에 catch.
 *
 * Scope: source-level lint (Prisma mocking 회피).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(
  __dirname,
  "../../../app/admin/orders/page.tsx",
);

describe("/admin/orders mobile surface — regression guard (§11.119)", () => {
  const source = readFileSync(PAGE_PATH, "utf8");

  it("desktop-only table 분기 존재 (hidden md:block)", () => {
    // table wrapper 가 모바일에서 hidden, desktop 에서만 보임
    expect(source).toMatch(/hidden\s+md:block|hidden md:flex/);
  });

  it("mobile-only card list 분기 존재 (md:hidden)", () => {
    // mobile 에서만 보이는 card list
    expect(source).toMatch(/md:hidden/);
  });

  it("bulk action bar mobile fixed 분기 (sm/md responsive)", () => {
    // bulk action bar 가 모바일에서 fixed 또는 sticky bottom
    expect(source).toMatch(/(fixed|sticky)\s+(bottom-0|inset-x-0)/);
  });

  it("filter bar flex-wrap (좁은 viewport responsive)", () => {
    // filter / search bar 의 wrap 정형화
    expect(source).toMatch(/flex-wrap|flex-col\s+sm:flex-row/);
  });

  it("checkbox / select-all 모바일에서도 onClick 동작 wired", () => {
    // mobile card 안에서도 checkbox 와 selectedIds toggle 함수 호출
    expect(source).toMatch(/setSelectedIds|toggleSelected|onCheckedChange/);
  });
});
