/**
 * §11.367-2 — 모바일 소싱 견적 바 1차 CTA(견적 요청) 잘림 방지 sentinel
 *
 * root cause(차단 대상): 견적 바 우측 그룹 + 가격 텍스트가 모두 shrink-0,
 *   가격 텍스트 whitespace-nowrap → 좁은 모바일에서 행 overflow → 최우측 CTA 잘림.
 * 해결: 우측 그룹 min-w-0(shrink 허용) + 가격 텍스트 min-w-0 truncate(우선 축약).
 *   🗑·CTA 는 shrink-0 유지 → 절대 잘리지 않음.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const SEARCH = "src/app/_workbench/search/page.tsx";

describe("§11.367-2 — 견적 바 가격 텍스트 truncate(overflow 주범 제거)", () => {
  it("quote-bar-total 가격 텍스트 = min-w-0 truncate (shrink-0 whitespace-nowrap 제거)", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/data-testid="quote-bar-total"/);
    // 가격 텍스트 span 의 className 이 min-w-0 truncate 를 포함
    expect(src).toMatch(/min-w-0 truncate"\s+data-testid="quote-bar-total"/);
    // 회귀 방지: 가격 텍스트가 다시 shrink-0 whitespace-nowrap 로 돌아가면 실패
    expect(src).not.toMatch(/shrink-0 whitespace-nowrap"\s+data-testid="quote-bar-total"/);
  });
});

describe("§11.367-2 — CTA·🗑 는 절대 잘리지 않음(shrink-0 보존)", () => {
  it("1차 CTA(견적 요청) emerald 버튼 shrink-0 유지", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/bg-emerald-600 hover:bg-emerald-500 text-white font-medium shrink-0/);
    expect(src).toMatch(/견적 요청/);
  });
  it("전체 해제 🗑 트리거 shrink-0 유지", () => {
    const src = read(SEARCH);
    expect(src).toMatch(/data-testid="sourcing-bar-clear-all-trigger"/);
    expect(src).toMatch(/h-8 w-8 p-0 shrink-0/);
  });
});
