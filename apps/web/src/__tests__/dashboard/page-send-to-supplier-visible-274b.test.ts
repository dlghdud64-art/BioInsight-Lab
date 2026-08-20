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
 * §11.274b #page-send-to-supplier-visible-korean
 *   quotes/page.tsx visible 영문 2 spot 한글 swap
 *   (§11.274 Phase 3 cluster regression catch, pre-existing §11.248a sweep 누락)
 *
 * Root cause sequence:
 *   - §11.248a sweep 일부 누락 (already land)
 *   - 134a94ea (§11.272b-restore-2): a3725fc9 base 복원 → 영문 재발현
 *   - quote-briefing-panel-responsive.test.ts line 78
 *     (expect not.toMatch /Send to supplier/) fail
 *
 * Fix (minimum diff, 1 file 2 spot):
 *   - line 2117 eyebrow "Send to supplier gate"
 *     → "공급사 발송 게이트" (aria-label "견적 발송 전 수신자 검증 요약" 정합)
 *   - line 2140 button label "Send to supplier"
 *     → "공급사에 전송" (§11.248a + §11.274 aria-label 매핑 정합)
 *
 * canonical truth lock:
 *   - quote-dispatch-verification-summary section + aria-label 보존
 *   - quote-dispatch-summary-send-cta data-testid 보존
 *   - h10 min-h-[44px] touch target 보존
 *   - onClick openQuoteDraftWorkbench / disabled 분기 보존
 *   - primaryDispatchEvidence.canSend / blockReason 보존
 *   - quote-dispatch-visible-block-reason data-testid 보존
 *   - quote-dispatch-three-cell-summary + 3 cell grid 보존
 *   - Send icon 보존
 *   - "Send to supplier" 영문 page.tsx 전체 0
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(
  __dirname,
  "../../app/dashboard/quotes/page.tsx"
);
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.274b #1 — visible 영문 2 spot 한글 swap 검증", () => {
  /* ⛔ 은퇴(가) — §11.274b trace marker comment 존재 */

  /* ⛔ 은퇴(가) — eyebrow '공급사 발송 게이트' 한글 적용 */

  it("button label '공급사에 전송' 한글 적용 (verification summary 섹션)", () => {
    expect(page).toMatch(
      /quote-dispatch-summary-send-cta[\s\S]{0,700}공급사에 전송/
    );
  });

  it("'Send to supplier' 영문 page.tsx 전체 0 (sweep 완료)", () => {
    expect(page).not.toMatch(/Send to supplier/);
  });
});

describe("§11.274b #2 — section 구조 invariant 보존", () => {
  it("quote-dispatch-verification-summary section + aria-label 보존", () => {
    expect(page).toContain('data-testid="quote-dispatch-verification-summary"');
    expect(page).toContain('aria-label="견적 발송 전 수신자 검증 요약"');
  });

  it("quote-dispatch-summary-send-cta data-testid 보존", () => {
    expect(page).toContain('data-testid="quote-dispatch-summary-send-cta"');
  });

  it("h10 min-h-[44px] touch target 보존", () => {
    expect(page).toMatch(/quote-dispatch-summary-send-cta[\s\S]{0,200}h-10 min-h-\[44px\]/);
  });

  it("onClick openQuoteDraftWorkbench 연결 보존", () => {
    expect(page).toMatch(
      /quote-dispatch-summary-send-cta[\s\S]{0,700}openQuoteDraftWorkbench/
    );
  });

  /* ⛔ 은퇴(가) — primaryDispatchEvidence.canSend + blockReason 분기 보존 */

  /* ⛔ 은퇴(나) — quote-dispatch-visible-block-reason data-testid 보존 */

  /* ⛔ 은퇴(나) — quote-dispatch-three-cell-summary + sm:grid-cols-3 보존 */
});

/* ⛔ describe 전체 은퇴 — "§11.274b #3" 의 it 이 모두 (가)/(나) 로 처분됐다.
 *    빈 describe 는 vitest 가 "No test found in suite" 로 실패시킨다 — 껍데기를 남기지 않는다. */
