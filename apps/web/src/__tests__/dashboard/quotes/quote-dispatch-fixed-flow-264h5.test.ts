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
  it("keeps the four dispatch preflight steps visible at the top", () => {
    expect(page).toContain("quote-dispatch-fixed-flow");
    expect(page).toContain("quote-dispatch-four-step-gate");
    expect(page).toMatch(/1\. supplier 선택[\s\S]{0,240}2\. contact 검증[\s\S]{0,240}3\. message preview[\s\S]{0,240}4\. send confirm/);
  });

  it("shows a clear disabled send reason before supplier/contact readiness is valid", () => {
    expect(page).toContain("quote-dispatch-send-disabled-reason");
    expect(page).toContain("전송 비활성:");
    expect(page).toContain("primaryDispatchEvidence.blockReason");
    expect(page).toContain("primaryDispatchPreflight.summary");
  });

  it("keeps draft creation as the only primary action when compare review is zero", () => {
    expect(page).toContain("quote-dispatch-primary-draft-cta");
    expect(page).toContain("견적 요청 초안 만들기");
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
