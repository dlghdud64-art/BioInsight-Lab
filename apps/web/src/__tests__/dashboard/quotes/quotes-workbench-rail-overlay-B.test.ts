/**
 * §quotes-workbench-rail Layer B — [EVOLVED by §quote-briefing-rail-overlay]
 *
 * 원래 §rail B (호영님 a, threshold 1440px): 1200–1439 overlay / ≥1440 push(sticky in-flow 480px 나란히).
 *
 * ⚠️ 1440 push 반전 (호영님 directed 2026-06-29, 업로드 "견적관리 브리핑 레일 수정 핸드오프"):
 *   "운영 브리핑은 테이블을 밀어내면 안 되고 위로 떠야 한다." → 레일 ≥1200 **항상 overlay**,
 *   테이블 항상 풀폭. ≥1440 push(sticky/right-auto/z-auto/shadow-none/ml-5/self-start) 폐기.
 *
 * sentinel 진화: push 단언 RETIRE, overlay 단언이 canonical(전 ≥1200 구간 적용).
 *   회귀 핀(w-[480px] 인접, mobile sheet, 옛 base 무분기 시퀀스 0)은 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§quote-briefing-rail-overlay — 레일 ≥1200 항상 overlay", () => {
  it("overlay: min-[1200px]:fixed + right-4 + z-30 + shadow-2xl", () => {
    expect(page).toMatch(/min-\[1200px\]:fixed/);
    expect(page).toMatch(/min-\[1200px\]:right-4/);
    expect(page).toMatch(/min-\[1200px\]:z-30/);
    expect(page).toMatch(/min-\[1200px\]:shadow-2xl/);
  });

  it("≥1440 push 폐기: min-[1440px]:sticky / right-auto / z-auto / shadow-none 0", () => {
    expect(page).not.toMatch(/min-\[1440px\]:sticky/);
    expect(page).not.toMatch(/min-\[1440px\]:right-auto/);
    expect(page).not.toMatch(/min-\[1440px\]:z-auto/);
    expect(page).not.toMatch(/min-\[1440px\]:shadow-none/);
  });

  it("in-flow 나란히(ml-5 / self-start) 폐기", () => {
    expect(page).not.toMatch(/min-\[1440px\]:ml-5/);
    expect(page).not.toMatch(/min-\[1440px\]:self-start/);
  });

  it("§quote-briefing-rail-overlay trace marker", () => {
    expect(page).toMatch(/§quote-briefing-rail-overlay/);
  });
});

describe("§quote-briefing-rail-overlay — 회귀 0 (기존 핀 보존)", () => {
  it("rail ≥1200 노출 + 480px (hidden min-[1200px]:flex … w-[480px])", () => {
    expect(page).toMatch(/hidden\s+min-\[1200px\]:flex[\s\S]{0,200}w-\[480px\]/);
  });

  it("모바일 bottom-sheet min-[1200px]:hidden fixed inset-0 불변", () => {
    expect(page).toMatch(/min-\[1200px\]:hidden\s+fixed\s+inset-0/);
  });

  it("옛 base 절대 위치(무분기 sticky/self-start 시퀀스) 0", () => {
    expect(page).not.toMatch(/bg-pn ml-5 rounded-xl overflow-hidden self-start sticky top-20/);
  });
});
