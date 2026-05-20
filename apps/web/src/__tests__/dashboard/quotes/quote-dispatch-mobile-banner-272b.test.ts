/**
 * §11.272b #quote-dispatch-mobile-banner
 * 발송 전 확인 블록 조건부 + 한글화 테스트.
 *
 * Fix:
 *   (1) quote-dispatch-fixed-flow section: hidden sm:block (모바일 hidden)
 *   (2) 신규 quote-dispatch-mobile-banner: sm:hidden, dispatchableCount > 0 조건부
 *       → 발송하기 → openQuoteDraftWorkbench
 *   (3) primaryDispatchBadges label 한글화:
 *       "supplier" → "공급사 선택", "contact" → "연락처 확인", "preview" → "메시지 미리보기"
 *   (4) 4 단계 grid label 한글 보존 (이미 적용, invariant lock)
 */

import { readFileSync } from "fs";
import { join } from "path";

const PAGE_PATH = join(
  process.cwd(),
  "src/app/dashboard/quotes/page.tsx"
);

function src(): string {
  return readFileSync(PAGE_PATH, "utf-8");
}

describe("§11.272b #1 — trace marker + section structure", () => {
  it("§11.272b trace marker JSDoc 존재", () => {
    expect(src()).toContain("§11.272b");
  });

  it("quote-dispatch-fixed-flow 에 hidden sm:block 적용 (모바일 hidden)", () => {
    expect(src()).toMatch(
      /quote-dispatch-fixed-flow[\s\S]{0,100}hidden sm:block/
    );
  });

  it("quote-dispatch-fixed-flow aria-label 견적 발송 전 확인 보존", () => {
    expect(src()).toContain('aria-label="견적 발송 전 확인 4단계"');
  });

  it("§11.272b 모바일 배너 + 큰 블록 조건부 구조 존재", () => {
    const content = src();
    expect(content).toContain("quote-dispatch-mobile-banner");
    expect(content).toContain("quote-dispatch-fixed-flow");
  });
});

describe("§11.272b #2 — 모바일 배너 (quote-dispatch-mobile-banner)", () => {
  it("quote-dispatch-mobile-banner testid 존재", () => {
    expect(src()).toContain('data-testid="quote-dispatch-mobile-banner"');
  });

  it("모바일 배너 sm:hidden flex items-center 적용", () => {
    expect(src()).toMatch(
      /quote-dispatch-mobile-banner[\s\S]{0,200}sm:hidden flex items-center/
    );
  });

  it("dispatchableCount > 0 조건부 — 배너 노출 분기", () => {
    expect(src()).toMatch(/dispatchableCount > 0 && \(/);
  });

  it("모바일 배너 '발송하기' 버튼 텍스트 보존", () => {
    expect(src()).toMatch(
      /quote-dispatch-mobile-banner[\s\S]{0,700}발송하기/
    );
  });

  it("모바일 배너 onClick → openQuoteDraftWorkbench 연결", () => {
    expect(src()).toMatch(
      /quote-dispatch-mobile-banner[\s\S]{0,700}openQuoteDraftWorkbench/
    );
  });

  it("모바일 배너 발송 준비 N건 텍스트 + dispatchableCount 바인딩", () => {
    expect(src()).toMatch(
      /발송 준비[\s\S]{0,50}dispatchableCount[\s\S]{0,50}건/
    );
  });
});

describe("§11.272b #3 — badge label 한글화 (4 spot)", () => {
  it("primaryDispatchBadges label '공급사 선택' 적용 (영문 supplier 제거)", () => {
    expect(src()).toContain('"공급사 선택"');
  });

  it("primaryDispatchBadges label '연락처 확인' 적용 (영문 contact 제거)", () => {
    expect(src()).toContain('"연락처 확인"');
  });

  it("primaryDispatchBadges label '메시지 미리보기' 적용 (영문 preview 제거)", () => {
    expect(src()).toContain('"메시지 미리보기"');
  });

  it("primaryDispatchBadges 에 영문 label: \"supplier\" 없음", () => {
    // primaryDispatchBadges useMemo 근처에 label: "supplier" 없어야 함
    expect(src()).not.toMatch(
      /primaryDispatchBadges[\s\S]{0,600}label: "supplier"/
    );
  });
});

describe("§11.272b #4 — 4단계 grid label invariant 보존", () => {
  it("4단계 grid 1. 공급사 선택 라벨 보존", () => {
    expect(src()).toContain('"1. 공급사 선택"');
  });

  it("4단계 grid 2. 연락처 확인 라벨 보존", () => {
    expect(src()).toContain('"2. 연락처 확인"');
  });

  it("4단계 grid 3. 메시지 미리보기 라벨 보존", () => {
    expect(src()).toContain('"3. 메시지 미리보기"');
  });

  it("4단계 grid 4. 발송 확인 라벨 보존", () => {
    expect(src()).toContain('"4. 발송 확인"');
  });
});

describe("§11.272b #5 — invariant 보존 (canonical truth)", () => {
  it("primaryDispatchEvidence 5 field 보존 (supplierStatus / contactStatus / previewStatus / sendStatus / canSend)", () => {
    const content = src();
    expect(content).toContain("primaryDispatchEvidence.supplierStatus");
    expect(content).toContain("primaryDispatchEvidence.contactStatus");
    expect(content).toContain("primaryDispatchEvidence.previewStatus");
    expect(content).toContain("primaryDispatchEvidence.sendStatus");
    expect(content).toContain("primaryDispatchEvidence.canSend");
  });

  it("dispatchableCount + openQuoteDraftWorkbench 선언 보존", () => {
    const content = src();
    expect(content).toContain("dispatchableCount");
    expect(content).toContain("openQuoteDraftWorkbench");
  });

  it("quote-dispatch-send-cta + quote-dispatch-readiness-badges 보존", () => {
    const content = src();
    expect(content).toContain('data-testid="quote-dispatch-send-cta"');
    expect(content).toContain('data-testid="quote-dispatch-readiness-badges"');
  });
});
