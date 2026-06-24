/**
 * §quotes-workbench-rail Layer B — rail push↔overlay breakpoint 분기 (호영님 a, threshold 1440px)
 *
 * 문제: 1200–1439px band에서 rail(480px push)이 queue를 min-width 아래로 밀어 압축.
 * 수정: rail 위치를 breakpoint로 분기 —
 *   · 1200–1439px: overlay drawer(min-[1200px]:fixed right-4 z-30 shadow) — queue 폭 불침범.
 *   · ≥1440px: push(min-[1440px]:sticky, in-flow 480px 나란히).
 *   · <1200px: hidden(모바일 bottom-sheet, 불변).
 *
 * sentinel 진화 0: 기존 §11.248e 핀(hidden min-[1200px]:flex … w-[480px], 200자 간격)은
 *   className에서 w-[480px]를 flex 직후 유지해 GREEN 보존 — "rail ≥1200 노출+480px" 의도 불변.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§quotes-workbench-rail B — push↔overlay 분기", () => {
  it("1200–1439 overlay: min-[1200px]:fixed + right-4 + z-30 + shadow-2xl", () => {
    expect(page).toMatch(/min-\[1200px\]:fixed/);
    expect(page).toMatch(/min-\[1200px\]:right-4/);
    expect(page).toMatch(/min-\[1200px\]:z-30/);
    expect(page).toMatch(/min-\[1200px\]:shadow-2xl/);
  });

  it("≥1440 push: min-[1440px]:sticky + right-auto + z-auto + shadow-none (overlay override)", () => {
    expect(page).toMatch(/min-\[1440px\]:sticky/);
    expect(page).toMatch(/min-\[1440px\]:right-auto/);
    expect(page).toMatch(/min-\[1440px\]:z-auto/);
    expect(page).toMatch(/min-\[1440px\]:shadow-none/);
  });

  it("push band 전용 ml-5 + self-start (in-flow 나란히)", () => {
    expect(page).toMatch(/min-\[1440px\]:ml-5/);
    expect(page).toMatch(/min-\[1440px\]:self-start/);
  });

  it("§quotes-workbench-rail B trace marker", () => {
    expect(page).toMatch(/§quotes-workbench-rail B/);
  });
});

describe("§quotes-workbench-rail B — 회귀 0 (기존 §11.248e 핀 의도 보존)", () => {
  it("rail ≥1200 노출 + 480px 보존 (hidden min-[1200px]:flex … w-[480px], 진화 0)", () => {
    expect(page).toMatch(/hidden\s+min-\[1200px\]:flex[\s\S]{0,200}w-\[480px\]/);
  });

  it("모바일 bottom-sheet min-[1200px]:hidden 불변", () => {
    expect(page).toMatch(/min-\[1200px\]:hidden\s+fixed\s+inset-0/);
  });

  it("옛 base 절대 위치(ml-5/sticky/self-start 무분기) 제거 — push는 min-[1440px] 한정", () => {
    // 옛 className: '...bg-pn ml-5 rounded-xl overflow-hidden self-start sticky top-20'
    //   → base ml-5/self-start/sticky 무분기 시퀀스 제거(분기로 이전). 회귀 가드.
    expect(page).not.toMatch(/bg-pn ml-5 rounded-xl overflow-hidden self-start sticky top-20/);
  });
});
