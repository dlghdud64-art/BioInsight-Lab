import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workbenchSource = readFileSync(
  resolve(__dirname, "../../../components/quotes/dispatch/vendor-dispatch-workbench.tsx"),
  "utf8",
);
const quotesPageSource = readFileSync(
  resolve(__dirname, "../../../app/dashboard/quotes/page.tsx"),
  "utf8",
);

describe("quote supplier remediation visible gate", () => {
  it("keeps send blocked while exposing a visible remediation action in the dialog", () => {
    expect(workbenchSource).toContain('data-testid="quote-dispatch-supplier-remediation-visible-cta"');
    expect(workbenchSource).toContain("공급사 후보 보강");
    expect(workbenchSource).toContain("openSupplierRemediation");
    expect(workbenchSource).toContain('data-testid="quote-dispatch-send-disabled"');
  });

  it("shows an immediate operator-readable result and direct contact entry", () => {
    expect(workbenchSource).toContain('data-testid="quote-dispatch-remediation-result"');
    expect(workbenchSource).toContain("보강 필요: 아래에서 공급사 연락처를 직접 추가하세요.");
    expect(workbenchSource).toContain('data-testid="quote-dispatch-manual-supplier-panel"');
    expect(workbenchSource).toContain("manualEmailInputRef.current?.focus()");
  });

  /* 🛑 은퇴 §quote-brief-rail-removed (2026-09-26 · 호영님 판정) — 원 명제: 「목록 화면이 공급사 후보 누락을 발송 차단으로 분류한다」.
     그 분류(getQuoteDispatchEvidence)는 레일 안 발송 준비 띠만 쓰던 것이라 레일과 함께 삭제됐다(소비자 0).
     발송 차단의 정본은 발송 작업창(vendor-dispatch-workbench)이고 위 두 it 가 그쪽을 본다. */
  it.skip("classifies any missing supplier-candidate blocker as send-blocking", () => {
    expect(quotesPageSource).toContain('blocker.includes("공급사 후보")');
  });

  it("leaves only the visible dialog action with the remediation label", () => {
    const labels = `${quotesPageSource}\n${workbenchSource}`.match(/공급사 후보 보강/g) ?? [];

    expect(labels).toHaveLength(1);
    // 승계 §quote-brief-rail-removed — 목록 쪽 「보완 화면 열기」 버튼 2곳은 레일·모바일 시트 안이라 함께 삭제됐다.
    expect(quotesPageSource).not.toContain("보완 화면 열기");
  });
});
