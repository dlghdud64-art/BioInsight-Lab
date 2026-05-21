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
  it("§11.274b trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.274b/);
  });

  it("eyebrow '공급사 발송 게이트' 한글 적용", () => {
    expect(page).toContain("공급사 발송 게이트");
  });

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

  it("primaryDispatchEvidence.canSend + blockReason 분기 보존", () => {
    expect(page).toContain("primaryDispatchEvidence.canSend");
    expect(page).toContain("primaryDispatchEvidence.blockReason");
  });

  it("quote-dispatch-visible-block-reason data-testid 보존", () => {
    expect(page).toContain('data-testid="quote-dispatch-visible-block-reason"');
  });

  it("quote-dispatch-three-cell-summary + sm:grid-cols-3 보존", () => {
    expect(page).toContain('data-testid="quote-dispatch-three-cell-summary"');
    expect(page).toMatch(/quote-dispatch-three-cell-summary[\s\S]{0,200}sm:grid-cols-3/);
  });
});

describe("§11.274b #3 — §11.142 한국어 정합 + §11.248a / §11.274 연계 lock", () => {
  it("eyebrow className 보존 (text-[11px] font-semibold uppercase tracking-wider text-blue-700)", () => {
    expect(page).toContain("text-[11px] font-semibold uppercase tracking-wider text-blue-700");
  });

  it("수신자 선택 → 연락처 확인 → 메시지 미리보기 → 발송 h2 보존", () => {
    expect(page).toContain("수신자 선택 → 연락처 확인 → 메시지 미리보기 → 발송");
  });

  it("Send icon (mr-1.5 h-4 w-4) 보존", () => {
    expect(page).toMatch(/<Send className="mr-1\.5 h-4 w-4"/);
  });

  it("disabled 분기 (isLoading || quotes.length === 0 || !primaryDispatchEvidence.canSend) 보존", () => {
    expect(page).toContain("isLoading || quotes.length === 0 || !primaryDispatchEvidence.canSend");
  });
});
