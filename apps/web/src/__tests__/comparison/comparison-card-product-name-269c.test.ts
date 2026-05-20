/**
 * §11.269c #comparison-card-product-name
 * 비교 카드 품목명 h4 className truncate -> line-clamp-2 정합 테스트.
 * PBS.../Pipet... 잘림 해소 — 긴 품목명 2줄까지 표시.
 */

import { readFileSync } from "fs";
import { join } from "path";

const MODAL_PATH = join(
  process.cwd(),
  "src/app/_workbench/_components/comparison-modal.tsx"
);

function src(): string {
  return readFileSync(MODAL_PATH, "utf-8");
}

describe("§11.269c 비교 카드 품목명 line-clamp-2 적용", () => {
  it("§11.269c trace marker — JSDoc 존재", () => {
    expect(src()).toContain("§11.269c");
  });

  it("h4 className line-clamp-2 적용됨", () => {
    expect(src()).toContain("line-clamp-2");
  });

  it("h4 className truncate 가 제품명 h4 에 없음 (line-clamp-2 로 교체)", () => {
    const content = src();
    // truncate 가 h4 에 붙어 있으면 안 됨
    const h4TruncateRegex = /<h4[^>]*truncate[^>]*>/;
    expect(h4TruncateRegex.test(content)).toBe(false);
  });
});

describe("§11.269c human review boundary", () => {
  it("keeps request creation behind operator confirmation copy", () => {
    const content = src();
    const blockedToken = ["ai", "auto", "apply"].join("-");

    expect(content).not.toContain(blockedToken);
    expect(content).toContain('data-testid="comparison-human-review-note"');
    expect(content).toContain(
      "최종 전략과 요청 생성은 담당자가 직접 확인합니다",
    );
    expect(content).toContain("확인 후 요청 생성");
  });
});

describe("§11.269c invariant — 카드 레이아웃 + sibling 보존", () => {
  it("h4 text-sm 보존", () => {
    expect(src()).toContain("text-sm font-semibold text-slate-900 line-clamp-2");
  });

  it("카드 너비 calc(50%-6px) 보존 (모바일 2개 동시 비교)", () => {
    expect(src()).toContain("min-w-[calc(50%-6px)]");
  });

  it("카드 레이아웃 max-md:flex 수평 스와이프 보존", () => {
    expect(src()).toContain("max-md:flex");
    expect(src()).toContain("max-md:overflow-x-auto");
  });

  it("제품 정보 brand + catalogNumber 하단 p 태그 truncate 보존", () => {
    const content = src();
    // 하단 p (brand/cat 넘버) 은 truncate 유지
    expect(content).toContain("text-xs text-slate-400 mt-0.5 truncate");
  });

  it("§11.269b 닫기 variant=outline 보존", () => {
    const content = src();
    const ghostClose = content.match(/variant="ghost"[^>]{0,60}>\s*닫기/s);
    expect(ghostClose).toBeNull();
    expect(content).toContain('variant="outline"');
  });

  it("§11.269a comparison-strategy-sheet 보존", () => {
    expect(src()).toContain("comparison-strategy-sheet");
  });

  it("§11.269a showStrategySheet + pendingStrategy 보존", () => {
    const content = src();
    expect(content).toContain("showStrategySheet");
    expect(content).toContain("pendingStrategy");
  });

  it("product?.name ?? pa.productId 렌더링 보존", () => {
    expect(src()).toContain("product?.name ?? pa.productId");
  });
});
