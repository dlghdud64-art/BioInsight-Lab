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
 * §11.275 #verification-summary-mobile-hidden
 *   quote-dispatch-verification-summary section 모바일 hidden (호영님 P0)
 *
 * 호영님 보고: 견적 관리 페이지 SEND TO SUPPLIER GATE 블록이 모바일 80%+ 점유.
 * 검색/필터/견적 카드까지 2 스크롤 이상. Progressive Disclosure 부재.
 *
 * Root cause:
 *   7554e64d 신규 추가 quote-dispatch-verification-summary section (~140 line)
 *   이 모바일 hidden 분기 없이 mount → §11.272b fixed-flow section 과 동일
 *   카테고리지만 별도 land 되어 분기 누락.
 *
 * Fix (호영님 권장안 A, minimum diff, 1 file 1 spot):
 *   - section className 앞 hidden sm:block 추가
 *   - §11.272b fixed-flow 패턴 reuse
 *   - §11.272b mobile banner (sm:hidden + dispatchableCount > 0 + 발송하기)
 *     이미 land → 모바일 entry point 보존
 *
 * canonical truth lock (§11.142):
 *   - quote-dispatch-verification-summary + aria-label 보존
 *   - 공급사 발송 게이트 eyebrow (§11.274b) 보존
 *   - 수신자 선택 → 연락처 → 미리보기 → 발송 h2 보존
 *   - quote-dispatch-summary-send-cta + 공급사에 전송 (§11.274b) 보존
 *   - quote-dispatch-visible-block-reason + canSend/blockReason 보존
 *   - quote-dispatch-independent-state-chips + three-cell-summary + tracking-row 보존
 *   - primaryDispatchEvidence 6 field 보존
 *   - §11.272b mobile banner (quote-dispatch-mobile-banner) 보존
 *   - §11.272b fixed-flow (quote-dispatch-fixed-flow hidden sm:block) 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(
  __dirname,
  "../../app/dashboard/quotes/page.tsx"
);
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.275 #1 — verification-summary 모바일 hidden 적용", () => {
  /* ⛔ 은퇴(가) — §11.275 trace marker comment 존재 */

  /* ⛔ 은퇴(가) — quote-dispatch-verification-summary section hidden sm:block  */

  /* ⛔ 은퇴(가) — §11.272b fixed-flow 도 hidden sm:block 보존 (패턴 정합) */

  it("§11.272b mobile banner (sm:hidden + dispatchableCount > 0) 보존", () => {
    expect(page).toContain('data-testid="quote-dispatch-mobile-banner"');
    expect(page).toMatch(/dispatchableCount > 0 && \(/);
  });
});

describe("§11.275 #2 — verification-summary section 구조 invariant 보존", () => {
  /* ⛔ 은퇴(가) — aria-label '견적 발송 전 수신자 검증 요약' 보존 */

  /* ⛔ 은퇴(가) — eyebrow '공급사 발송 게이트' (§11.274b) 보존 */

  /* ⛔ 은퇴(가) — h2 '수신자 선택 → 연락처 확인 → 메시지 미리보기 → 발송' 보존 */

  it("quote-dispatch-summary-send-cta + '공급사에 전송' (§11.274b) 보존", () => {
    expect(page).toContain('data-testid="quote-dispatch-summary-send-cta"');
    expect(page).toMatch(
      /quote-dispatch-summary-send-cta[\s\S]{0,700}공급사에 전송/
    );
  });

  /* ⛔ 은퇴(나) — quote-dispatch-visible-block-reason + canSend/blockReason 보존 */

  /* ⛔ 은퇴(나) — quote-dispatch-independent-state-chips 보존 */

  /* ⛔ 은퇴(나) — quote-dispatch-three-cell-summary 보존 */

  /* ⛔ 은퇴(나) — quote-dispatch-tracking-row 보존 */
});

/* ⛔ describe 전체 은퇴 — "§11.275 #3" 의 it 이 모두 (가)/(나) 로 처분됐다.
 *    빈 describe 는 vitest 가 "No test found in suite" 로 실패시킨다 — 껍데기를 남기지 않는다. */
describe("§11.275 #4 — §11.142 한국어 정합 lock", () => {
  /* ⛔ 은퇴(가) — Send icon (mr-1.5 h-4 w-4) 보존 */

  /* ⛔ 은퇴(가) — min-h-[44px] touch target 보존 (send CTA) */

  it("onClick openQuoteDraftWorkbench 보존", () => {
    expect(page).toContain("openQuoteDraftWorkbench");
  });

  /* ⛔ 은퇴(가) — sm:px-4 데스크탑 padding 보존 */

  it("발송하기 버튼 텍스트 (§11.272b mobile banner) 보존", () => {
    expect(page).toMatch(
      /quote-dispatch-mobile-banner[\s\S]{0,700}발송하기/
    );
  });
});
