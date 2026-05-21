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
    expect(page).toMatch(/1\. 공급사 선택[\s\S]{0,240}2\. 연락처 확인[\s\S]{0,240}3\. 메시지 미리보기[\s\S]{0,240}4\. 발송 확인/);
  });

  it("shows a clear disabled send reason before supplier/contact readiness is valid", () => {
    expect(page).toContain("quote-dispatch-send-disabled-reason");
    expect(page).toContain("전송 비활성:");
    expect(page).toContain("primaryDispatchEvidence.blockReason");
    expect(page).toContain("primaryDispatchPreflight.summary");
  });

  it("keeps Send to supplier tied to supplier/contact readiness", () => {
    expect(page).toContain("quote-dispatch-send-cta");
    expect(page).toContain("공급사에 전송");
    expect(page).toMatch(/disabled=\{isLoading \|\| quotes\.length === 0 \|\| !primaryDispatchEvidence\.canSend\}/);
    expect(page).toContain("quote-dispatch-button-reason");
    expect(page).toContain("전송 불가 ·");
  });

  it("shows supplier, contact, and preview badges beside the send action", () => {
    expect(page).toContain("quote-dispatch-readiness-badges");
    expect(page).toMatch(/data-testid=\{`quote-dispatch-\$\{badge\.label\}-badge`\}/);
    expect(page).toContain('label: "공급사 선택"');
    expect(page).toContain('label: "연락처 확인"');
    expect(page).toContain('label: "메시지 미리보기"');
    expect(page).toContain("primaryDispatchBadges");
    expect(page).toContain("border-emerald-200 bg-emerald-50 text-emerald-700");
    expect(page).toContain("border-amber-200 bg-amber-50 text-amber-700");
  });

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
