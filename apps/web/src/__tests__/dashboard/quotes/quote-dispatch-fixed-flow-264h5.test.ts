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
 * #quote-dispatch-fixed-flow-264h5
 *
 * Guards the top-of-page quote dispatch decision surface:
 * supplier selection, contact validation, message preview, and final send
 * confirmation must be visible before the operator starts dispatch.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("quote dispatch fixed flow", () => {
  /* ⛔ 은퇴(가) — keeps the four dispatch preflight steps visible at the top */

  /* ⛔ 은퇴(가) — shows a clear disabled send reason before supplier/contact r */

  it("keeps Send to supplier tied to supplier/contact readiness", () => {
    expect(page).toContain("quote-dispatch-send-cta");
    expect(page).toContain("공급사에 전송");
    expect(page).toMatch(/disabled=\{isLoading \|\| quotes\.length === 0 \|\| !primaryDispatchEvidence\.canSend\}/);
    expect(page).toContain("quote-dispatch-button-reason");
    expect(page).toContain("전송 불가 ·");
  });

  /* ⛔ 은퇴(나) — shows supplier, contact, and preview badges beside the send  */

  it("keeps compare review zero as a disabled secondary state", () => {
    expect(page).toContain("quote-compare-review-zero-disabled");
    expect(page).toContain("비교 검토 필요 0건 · 검토 대상 없음");
  });

  it("prevents the zero compare-review KPI from behaving like a primary CTA", () => {
    expect(page).toContain("const isCompareReviewZero = label === \"비교 검토 필요\" && isZero");
    expect(page).toMatch(/if \(isCompareReviewZero\) return/);
    expect(page).toMatch(/disabled=\{isCompareReviewZero\}/);
    expect(page).toMatch(/aria-disabled=\{isCompareReviewZero\}/);
  });
});
