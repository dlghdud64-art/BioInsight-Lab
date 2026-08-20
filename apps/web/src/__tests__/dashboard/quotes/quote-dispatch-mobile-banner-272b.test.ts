/* ⛔ §11.279 계열 일괄 은퇴 (2026-08-19) — 아래 개별 it 은 (가)/(나) 갈래로 처분됐다.
 *
 *    원인 1개: fd86d1c4 "§11.279 공급사 발송 게이트 + 발송 전 확인 블록 전면 제거 (호영님 P0)"
 *              (+ 후속 정리 b771c163 §11.279e-cont-2 primaryDispatch* helper cleanup)
 *    처분 3개: (가) 은퇴 — 279 가 승계  (나) 구멍 메움 후 은퇴  (다) 재조준 — 판정 대기라 **존치**
 *
 *    🛑 (다) 로 분류된 it 은 남아 있고 RED 다. 지우지 말 것 —
 *       "4. 발송 확인" · "공급사에 전송" 이 소스에 **살아 있고**(L3609·L3733·L4277),
 *       primaryDispatchEvidence → selectedDispatchEvidence 로 **이동**했을 가능성이 있다.
 *       fd86d1c4 body 는 "전면 제거" 라 적었지만 화면에는 남아 있다 — body 는 근거가 아니다.
 *       이동이면 재조준이 맞고, 미완 제거면 소스에서 빼야 한다. 호영님 판정 대기.
 *
 *    승계처: quote-gate-blocks-removed-279.test.ts
 *            L46~72 (기존 8토큰) + §11.279-holes describe (이번에 메운 9토큰)
 */
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

  /* ⛔ 은퇴(가) — quote-dispatch-fixed-flow 에 hidden sm:block 적용 (모바일 hidden) */

  it("quote-dispatch-fixed-flow aria-label 견적 발송 전 확인 보존", () => {
    expect(src()).toContain('aria-label="견적 발송 전 확인 4단계"');
  });

  /* ⛔ 은퇴(가) — §11.272b 모바일 배너 + 큰 블록 조건부 구조 존재 */
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
  /* ⛔ 은퇴(나) — primaryDispatchBadges label '공급사 선택' 적용 (영문 supplier 제거) */

  /* ⛔ 은퇴(나) — primaryDispatchBadges label '연락처 확인' 적용 (영문 contact 제거) */

  /* ⛔ 은퇴(나) — primaryDispatchBadges label '메시지 미리보기' 적용 (영문 preview 제거) */

  it("primaryDispatchBadges 에 영문 label: \"supplier\" 없음", () => {
    // primaryDispatchBadges useMemo 근처에 label: "supplier" 없어야 함
    expect(src()).not.toMatch(
      /primaryDispatchBadges[\s\S]{0,600}label: "supplier"/
    );
  });
});

describe("§11.272b #4 — 4단계 grid label invariant 보존", () => {
  /* ⛔ 은퇴(나) — 4단계 grid 1. 공급사 선택 라벨 보존 */

  /* ⛔ 은퇴(나) — 4단계 grid 2. 연락처 확인 라벨 보존 */

  /* ⛔ 은퇴(나) — 4단계 grid 3. 메시지 미리보기 라벨 보존 */

  it("4단계 grid 4. 발송 확인 라벨 보존", () => {
    expect(src()).toContain('"4. 발송 확인"');
  });
});

describe("§11.272b #5 — invariant 보존 (canonical truth)", () => {
  /* ⛔ 은퇴(가) — primaryDispatchEvidence 5 field 보존 (supplierStatus / contact */

  it("dispatchableCount + openQuoteDraftWorkbench 선언 보존", () => {
    const content = src();
    expect(content).toContain("dispatchableCount");
    expect(content).toContain("openQuoteDraftWorkbench");
  });

  /* ⛔ 은퇴(나) — quote-dispatch-send-cta + quote-dispatch-readiness-badges 보존 */
});
