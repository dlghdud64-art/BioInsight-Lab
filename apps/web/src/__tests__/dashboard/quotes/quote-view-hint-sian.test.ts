/**
 * §quote-view-hint(시안 §12, 호영님 라이브 대조) — 카드·테이블 전환 첫 방문 안내 말풍선.
 *   시안 견적 관리 화면의 "카드·테이블 보기를 여기서 전환할 수 있어요" 1회 안내가 라이브 누락 → 추가.
 *   §12 spec: 첫 방문 시 1회 노출, 누르거나 닫으면 재노출 0(localStorage persist).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(__dirname, "../../../app/dashboard/quotes/page.tsx"),
  "utf8",
);

describe("§quote-view-hint — 카드·테이블 첫 방문 안내 말풍선", () => {
  it("시안 문구 + 1회 노출 state", () => {
    expect(src).toContain("카드·테이블 보기를 여기서 전환할 수 있어요");
    expect(src).toContain("showViewHint");
  });

  it("누르거나 닫으면 재노출 0 — localStorage dismiss", () => {
    expect(src).toContain("labaxis-quote-view-hint-dismissed");
    expect(src).toContain("dismissViewHint");
    // 토글 클릭 시에도 dismiss (누르거나)
    expect(src).toMatch(/setViewMode\("card"\);\s*dismissViewHint\(\)/);
    expect(src).toMatch(/setViewMode\("table"\);\s*dismissViewHint\(\)/);
  });
});
