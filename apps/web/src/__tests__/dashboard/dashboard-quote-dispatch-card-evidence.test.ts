/**
 * #dashboard-quote-dispatch-card-evidence
 *
 * Agent Board P1: dashboard quote dispatch entry must expose supplier/contact/
 * preview/send readiness before the operator reaches the quote workbench.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const QUICK_ACTIONS_PATH = resolve(
  __dirname,
  "../../components/dashboard/operator-quick-actions.tsx",
);
const quickActions = readFileSync(QUICK_ACTIONS_PATH, "utf8");

describe("dashboard quote dispatch readiness card", () => {
  it("exposes one quote dispatch evidence card with four separate steps", () => {
    expect(quickActions).toContain("dashboard-quote-dispatch-card");
    expect(quickActions).toContain("dashboard-quote-dispatch-readiness");
    expect(quickActions).toContain("dashboard-quote-dispatch-stage");
    expect(quickActions).toContain("공급사 없음");
    expect(quickActions).toContain("연락처 필요");
    expect(quickActions).toContain("메시지 미리보기");
    expect(quickActions).toContain("전송 확인");
  });

  it("keeps Send to supplier as the single blue primary CTA", () => {
    expect(quickActions).toContain("dashboard-quote-dispatch-primary-cta");
    expect(quickActions).toContain("Send to supplier");
    expect(quickActions).toContain("bg-blue-600");
    expect(quickActions).toContain("hover:bg-blue-700");
  });

  it("blocks the primary CTA until quote dispatch has a candidate", () => {
    expect(quickActions).toMatch(/supplierSelected: count > 0/);
    expect(quickActions).toContain("aria-disabled={!canSendToSupplier}");
    expect(quickActions).toContain("pointer-events-none opacity-60");
  });

  it("uses an amber contact warning with the manual supplier path next to it", () => {
    expect(quickActions).toContain("dashboard-quote-dispatch-contact-warning");
    expect(quickActions).toMatch(/border-amber-200[\s\S]{0,120}bg-amber-50[\s\S]{0,120}text-amber-800/);
    expect(quickActions).toContain("연락처 필요");
    expect(quickActions).toContain("dashboard-quote-dispatch-manual-link");
    expect(quickActions).toContain("수동 공급사 추가");
  });

  it("separates supplier missing, contact missing, and ready input states", () => {
    expect(quickActions).toContain("dashboard-quote-dispatch-state-matrix");
    expect(quickActions).toContain("dashboard-quote-dispatch-case-${row.key}");
    expect(quickActions).toContain('key: "no-supplier"');
    expect(quickActions).toContain('key: "missing-contact"');
    expect(quickActions).toContain('key: "ready"');
    expect(quickActions).toContain("공급사 선택 필요");
    expect(quickActions).toContain("초안만 표시");
    expect(quickActions).toContain("정상 입력");
  });

  it("requires supplier, contact, preview, and no server error before enabling send", () => {
    expect(quickActions).toMatch(/quoteReadiness\.supplierSelected[\s\S]{0,120}quoteReadiness\.contactValid[\s\S]{0,120}quoteReadiness\.previewReady[\s\S]{0,120}!quoteReadiness\.serverError/);
    expect(quickActions).toContain("공급사 선택 필요");
    expect(quickActions).toContain("연락처 필요");
    expect(quickActions).toContain("메시지 미리보기 필요");
    expect(quickActions).toContain("서버 오류");
  });

  it("shows preview and dispatch tracking status before leaving dashboard", () => {
    expect(quickActions).toContain("dashboard-quote-dispatch-preview-tracking");
    expect(quickActions).toContain("dashboard-quote-dispatch-preview-status");
    expect(quickActions).toContain("dashboard-quote-dispatch-tracking-status");
    expect(quickActions).toContain("전송 전 확인됨");
    expect(quickActions).toContain("dispatch 이벤트 추적됨");
    expect(quickActions).toContain("발송 후 새로고침에도 dispatch 이벤트 추적");
  });

  it("keeps the secondary action visually subordinate", () => {
    expect(quickActions).toContain("text-slate-500");
    expect(quickActions).toContain("검토");
  });
});
