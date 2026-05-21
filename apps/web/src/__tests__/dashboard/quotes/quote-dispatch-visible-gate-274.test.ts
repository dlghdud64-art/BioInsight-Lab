/**
 * #quote-dispatch-visible-gate-274
 *
 * Agent Board P1:
 * /dashboard/quotes must expose the dispatch gate before the operator opens
 * the draft workbench: supplier, contact, send readiness, and the four-step
 * send order must be visible in the page surface.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("quote dispatch visible gate", () => {
  it("pins a visible three-cell dispatch summary above the workbench CTA", () => {
    expect(page).toContain('data-testid="quote-dispatch-verification-summary"');
    expect(page).toContain('data-testid="quote-dispatch-three-cell-summary"');
    expect(page).toContain('data-testid={`quote-dispatch-summary-${cell.key}`}');
    expect(page).toContain('label: "공급사"');
    expect(page).toContain('label: "연락처"');
    expect(page).toContain('label: "전송 가능 여부"');
  });

  it("keeps Send to supplier disabled until supplier and contact are valid", () => {
    expect(page).toContain('data-testid="quote-dispatch-summary-send-cta"');
    expect(page).toMatch(/disabled=\{isLoading \|\| quotes\.length === 0 \|\| !primaryDispatchEvidence\.canSend\}/);
    expect(page).toContain("전송 버튼 비활성");
    expect(page).toContain("primaryDispatchEvidence.blockReason");
  });

  it("shows the Korean four-step dispatch order in the visible summary", () => {
    expect(page).toContain('data-testid="quote-dispatch-visible-four-step"');
    expect(page).toContain('"수신자 선택"');
    expect(page).toContain('"연락처 확인"');
    expect(page).toContain('"메시지 미리보기"');
    expect(page).toContain('"발송 확인"');
  });

  it("keeps sent tracking visible from persisted vendor request data", () => {
    expect(page).toContain("function getQuoteDispatchTracking");
    expect(page).toContain("q?.vendorRequests ?? []");
    expect(page).toContain('data-testid="quote-dispatch-tracking-row"');
    expect(page).toContain('data-testid={`quote-dispatch-tracking-${cell.key}`}');
    expect(page).toContain('label: "발송됨"');
    expect(page).toContain('label: "추적중"');
    expect(page).toContain('label: "실패"');
    expect(page).toContain("발송 시각 {primaryDispatchTracking.lastSentAt}");
    expect(page).toContain("추적 ID {primaryDispatchTracking.trackingId}");
  });

  it("shows supplier and contact as independent completion chips before send", () => {
    expect(page).toContain('data-testid="quote-dispatch-independent-state-chips"');
    expect(page).toContain('data-testid={`quote-dispatch-state-chip-${chip.key}`}');
    expect(page).toContain("공급사 선택 완료");
    expect(page).toContain("공급사 선택 필요");
    expect(page).toContain("연락처 확인 완료");
    expect(page).toContain("연락처 확인 필요");
    expect(page).toContain("메시지 미리보기 1회 표시");
  });

  it("pins a one-line sent tracking badge with quote id and timestamp", () => {
    expect(page).toContain('data-testid="quote-dispatch-sent-tracking-badge"');
    expect(page).toContain("sent tracking · quote {primaryDispatchTracking.quoteId}");
    expect(page).toContain("{primaryDispatchTracking.statusLabel}");
    expect(page).toContain("{primaryDispatchTracking.lastSentAt}");
  });

  it("places supplier valid and contact valid badges beside the send button", () => {
    expect(page).toContain('data-testid="quote-dispatch-button-validity-badges"');
    expect(page).toContain('data-testid={`quote-dispatch-validity-${badge.key}`}');
    expect(page).toContain("supplier valid: 확인됨");
    expect(page).toContain("supplier valid: 대기");
    expect(page).toContain("contact valid: 확인됨");
    expect(page).toContain("contact valid: 대기");
  });

  it("fixes the operational lifecycle chips for before, review, and sent states", () => {
    expect(page).toContain('data-testid="quote-dispatch-lifecycle-status-chips"');
    expect(page).toContain('data-testid={`quote-dispatch-lifecycle-${chip.key}`}');
    expect(page).toContain('label: "발송 전"');
    expect(page).toContain('label: "검토 필요"');
    expect(page).toContain('label: "발송 완료"');
    expect(page).toContain("primaryDispatchLifecycleStage");
  });
});
