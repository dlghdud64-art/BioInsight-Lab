/**
 * §11.255 — 모바일 AI 비교 분석 리포트 레이아웃 최적화 (Option 2 컴팩트 카드).
 *
 * 호영님 spec:
 *   - 모바일에서 2개 제품 동시 비교 가능 (현재 carousel = 1개만).
 *   - 카드 너비 화면 45% (2개 나란히).
 *   - 내부 padding 12px (현재 16px → 25% 축소).
 *   - "견적 요청 조립하기" → 모바일 "견적 요청 만들기" 축약.
 *   - 3개 이상은 자연 가로 스크롤 (snap 보존).
 *
 * canonical truth lock:
 *   - max-md:flex overflow-x-auto snap-x snap-mandatory 보존.
 *   - md:grid md:grid-cols-2 데스크탑 layout 보존.
 *   - AI 종합 의견 + 추천 + 핵심 차이 모든 영역 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const MODAL_PATH = resolve(__dirname, "../../app/_workbench/_components/comparison-modal.tsx");
const code = safeRead(MODAL_PATH);

describe("§11.255 #1 — 카드 모바일 너비 + padding 압축", () => {
  it("§11.255 trace marker", () => {
    expect(code).toMatch(/§11\.255|11\.255/);
  });

  it("카드 모바일 너비 calc(50%-6px) 또는 calc(50%-4px) (2개 동시 노출)", () => {
    expect(code).toMatch(/max-md:min-w-\[calc\(50%-(4|6|8)px\)\]/);
  });

  it("카드 내부 padding p-3 md:p-5 (모바일 25% 축소)", () => {
    // bg-white p-3 md:p-5 패턴.
    expect(code).toMatch(/p-3\s+md:p-5/);
  });
});

describe("§11.255 #2 — CTA 모바일 축약", () => {
  it("'견적 요청 만들기' 모바일 축약 라벨 또는 sm:hidden/hidden sm:inline 분기", () => {
    expect(code).toMatch(/견적\s*요청\s*만들기|sm:hidden[\s\S]{0,300}견적\s*요청|hidden\s+sm:inline[\s\S]{0,300}견적\s*요청\s*조립/);
  });
});

describe("§11.255 — invariant 보존", () => {
  it("max-md:flex + overflow-x-auto + snap (모바일 가로 스크롤, 3개 이상)", () => {
    expect(code).toMatch(/max-md:flex[\s\S]{0,200}overflow-x-auto/);
    expect(code).toMatch(/snap-x/);
  });

  it("md:grid + md:grid-cols-2 (데스크탑 보존)", () => {
    expect(code).toMatch(/md:grid\s+md:grid-cols-2/);
  });

  it("'AI 종합 의견' 헤더 보존", () => {
    expect(code).toMatch(/AI\s*종합\s*의견/);
  });

  it("'예상 단가' + '예상 납기' 라벨 보존", () => {
    expect(code).toMatch(/예상\s*단가/);
    expect(code).toMatch(/예상\s*납기/);
  });

  it("'견적 요청 조립하기' 또는 견적 관련 CTA 보존 (전체 라벨 또는 축약)", () => {
    expect(code).toMatch(/견적\s*요청/);
  });
});
