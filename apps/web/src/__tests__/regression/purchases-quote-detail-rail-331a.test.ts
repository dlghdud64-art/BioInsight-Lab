/**
 * §11.331-a (회귀) — 구매 운영 "견적 상세" same-canvas Rail 전환 sentinel
 *
 * 버그: 구매 운영 큐 카드 "견적 상세" 클릭 → /dashboard/quotes 로 페이지 점프
 *   (구매 운영 컨텍스트 이탈). §11.330 패턴 위반.
 * 수정: 큐 카드 "견적 상세" = setSelectedId(item.id) 로 same-canvas Rail 열기.
 *   Rail 내부의 "전체 견적 페이지 열기"(deep-dive secondary)는 Link 유지.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const PAGE = "src/app/dashboard/purchases/page.tsx";

describe("§11.331-a — 견적 상세 same-canvas Rail", () => {
  it("큐 카드 견적 상세가 Rail 열기(setSelectedId)로 동작", () => {
    const src = read(PAGE);
    expect(src).toMatch(/data-testid="purchases-quote-detail-rail"/);
    // 해당 버튼 onClick 이 setSelectedId 호출
    expect(src).toMatch(/purchases-quote-detail-rail"[\s\S]{0,160}setSelectedId\(item\.id\)/);
  });

  it("큐 카드 견적 상세가 더이상 quotes 페이지로 Link 점프하지 않음", () => {
    const src = read(PAGE);
    // 큐 카드 영역의 Link href=/dashboard/quotes/${item.id} 제거됨
    expect(src).not.toMatch(/<Link href=\{`\/dashboard\/quotes\/\$\{item\.id\}`\}/);
  });
});

describe("§11.331-a 회귀 0 — Rail/탭 인프라 + deep-dive 보존", () => {
  it("Rail 인프라(selectedId/closeRail) 보존", () => {
    const src = read(PAGE);
    expect(src).toMatch(/setSelectedId/);
    expect(src).toMatch(/closeRail/);
  });
  it("Rail 내부 전체 견적 페이지 deep-dive Link 보존(selectedItem)", () => {
    const src = read(PAGE);
    expect(src).toMatch(/<Link href=\{`\/dashboard\/quotes\/\$\{selectedItem\.id\}`\}/);
    expect(src).toMatch(/전체 견적 페이지 열기/);
  });
});
