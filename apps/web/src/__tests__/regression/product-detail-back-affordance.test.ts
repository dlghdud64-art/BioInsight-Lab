/**
 * §1-2② — 제품 상세 헤더 back affordance 중복·겹침 제거 회귀 가드
 *
 * Truth (2026-06-08 cowork TR): /products/[id] 모바일에 back affordance 2개 충돌 —
 *   (1) floating 원형 `<` (fixed top-16 left-4 z-50, rounded-full) + (2) breadcrumb.
 *   container pt-14 로 floating 과 breadcrumb 이 같은 상단대에서 시작 → 수직 겹침 +
 *   x축 어긋남. 전역 헤더 없음(root layout) + viewportFit:cover.
 *
 * Fix (호영님 lock — ⓑ floating 제거): floating 원형 back 제거(breadcrumb 이 회귀
 *   경로 담당, 중복). container 를 safe-area 인식 pt 로 교체(breadcrumb 이 모바일
 *   최상단). breadcrumb · 데스크톱 "검색 결과 목록" 링크는 보존.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const PAGE = "src/app/products/[id]/page.tsx";

describe("§1-2② — 제품 상세 back 중복 제거", () => {
  it("floating 원형 back 버튼(fixed top-16 ... rounded-full) 재출현 0", () => {
    const src = read(PAGE);
    // fixed top-16 + rounded-full 조합의 floating back 금지
    expect(src).not.toMatch(/fixed\s+top-16[^"]*rounded-full/);
    // aria-label 뒤로가기 floating 버튼 패턴 금지(데스크톱 텍스트 링크는 aria 없음)
    expect(src).not.toMatch(/className="fixed top-16 left-4 z-50/);
  });

  it("safe-area 인식 상단 패딩 적용(노치 대응)", () => {
    const src = read(PAGE);
    expect(src).toMatch(/pt-\[calc\(env\(safe-area-inset-top\)/);
  });

  // 회귀 0 — 회귀 경로(breadcrumb)·데스크톱 back 보존
  it("breadcrumb · 데스크톱 '검색 결과 목록' back 보존", () => {
    const src = read(PAGE);
    expect(src).toMatch(/aria-label="Breadcrumb"/);
    expect(src).toMatch(/검색 결과 목록/);
  });
});
