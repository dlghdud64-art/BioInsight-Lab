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

  it("classifies any missing supplier-candidate blocker as send-blocking", () => {
    expect(quotesPageSource).toContain('blocker.includes("공급사 후보")');
  });
});
