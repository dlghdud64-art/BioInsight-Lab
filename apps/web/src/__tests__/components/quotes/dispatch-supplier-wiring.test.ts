/**
 * #user-supplier-registration Phase 5 RED — wizard / batch sheet supplier
 * picker wiring (org_book source 활성화).
 *
 * Goal:
 *   - quotes/page.tsx 에 useQuery `/api/organization-vendors` GET 추가.
 *   - resolveSuppliers caller 2 곳 (selectedSignals + VendorRequestModal +
 *     BatchDispatchSheet) 에 organizationVendors forward.
 *   - vendor-dispatch-workbench.tsx 의 CONTACT_SOURCE_LABEL / ICON 에
 *     org_book 추가.
 *   - 한국어 라벨 "조직 거래처".
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const BATCH_SHEET_PATH = resolve(
  __dirname,
  "../../../components/quotes/dispatch/batch-dispatch-sheet.tsx",
);
const WORKBENCH_PATH = resolve(
  __dirname,
  "../../../components/quotes/dispatch/vendor-dispatch-workbench.tsx",
);

describe("#user-supplier-registration Phase 5 — quotes page useQuery org-vendors", () => {
  const source = readFileSync(PAGE_PATH, "utf8");

  it("useQuery로 /api/organization-vendors GET", () => {
    expect(source).toMatch(/organization-vendors|organizationVendors/);
    // useQuery key 또는 fetch URL 매칭
    expect(source).toMatch(/\/api\/organization-vendors/);
  });

  it("resolveSuppliers caller 에 organizationVendors forward", () => {
    // 적어도 1개 caller 가 organizationVendors prop 전달
    expect(source).toMatch(/resolveSuppliers\(\{[\s\S]*?organizationVendors/);
  });

  it("BatchDispatchSheet 에 organizationVendors prop 전달", () => {
    expect(source).toMatch(/<BatchDispatchSheet[\s\S]*?organizationVendors/);
  });
});

describe("#user-supplier-registration Phase 5 — batch sheet org_book wiring", () => {
  const source = readFileSync(BATCH_SHEET_PATH, "utf8");

  it("BatchDispatchSheet props 에 organizationVendors optional", () => {
    // type 명 변형 허용 (OrgVendor / OrganizationVendor / Array / 등).
    expect(source).toMatch(/organizationVendors\??\s*[:=]/);
  });

  it("resolveSuppliers 호출에 organizationVendors forward", () => {
    expect(source).toMatch(/resolveSuppliers\(\{[\s\S]*?organizationVendors/);
  });
});

describe("#user-supplier-registration Phase 5 — vendor-dispatch-workbench label", () => {
  const source = readFileSync(WORKBENCH_PATH, "utf8");

  it("CONTACT_SOURCE_LABEL 에 org_book entry", () => {
    expect(source).toMatch(/org_book:\s*["']조직 거래처|org_book:\s*["'][^"']*거래처/);
  });

  it("CONTACT_SOURCE_ICON 에 org_book entry (한국어 약자)", () => {
    expect(source).toMatch(/CONTACT_SOURCE_ICON[\s\S]*?org_book:\s*["']/);
  });
});

describe("#quote-dispatch-final-confirmation - send gate evidence", () => {
  const source = readFileSync(WORKBENCH_PATH, "utf8");

  it("opens a final confirmation modal before sending", () => {
    expect(source).toContain("confirmationOpen");
    expect(source).toContain("setConfirmationOpen(true)");
    expect(source).toContain("quote-dispatch-confirm-before-send");
    expect(source).toContain("quote-dispatch-confirmation-modal");
    expect(source).toContain("quote-dispatch-confirmation-recipient");
    expect(source).toContain("quote-dispatch-confirmation-preview");
  });

  it("keeps Send to supplier disabled until readiness is valid and no sent tracking exists", () => {
    expect(source).toMatch(
      /disabled=\{isSubmitting \|\| sendReadiness !== "ready" \|\| Boolean\(sentTracking\)\}/,
    );
    expect(source).toContain('disabled={isSubmitting || sendReadiness !== "ready"}');
  });

  // §quote-dispatch-real-send-unify P1 — 단일 발송 = 실 이메일 발송(vendor-requests) 역전.
  //   tracking evidence statusLabel "PDF 다운로드 완료" → "발송 완료"(실 발송 결과 기반). 보호 의도(발송 후 추적 증적) 유지.
  it("shows sent tracking evidence after a successful dispatch", () => {
    expect(source).toContain("quote-dispatch-sent-tracking-state");
    expect(source).toContain("quote-dispatch-sent-tracking-id");
    expect(source).toContain("quote-dispatch-sent-refresh-proof");
    expect(source).toContain("발송 완료");
    expect(source).toContain("recipientCount");
  });

  it("persists sent tracking by quote ID so refresh reopens the same handoff evidence", () => {
    expect(source).toContain("getDispatchTrackingStorageKey");
    expect(source).toContain("window.localStorage.getItem(trackingStorageKey)");
    expect(source).toContain("window.localStorage.setItem(trackingStorageKey, JSON.stringify(trackingEvidence))");
    expect(source).toContain("담당자: {sentTracking.operatorName}");
    // §quote-screen-sian P6.4 4a — cuid 봉합: quote ID 원본 → quoteRef.
    expect(source).toContain("견적: {quoteRef ?? sentTracking.quoteId}");
  });
});

describe("#quote-dispatch-stepper - §09 단일 스텝퍼", () => {
  const source = readFileSync(WORKBENCH_PATH, "utf8");

  it("replaces the 4 duplicate status blocks with one horizontal stepper", () => {
    expect(source).toContain("quote-dispatch-stepper");
    expect(source).toContain("dispatchSteps");
    expect(source).toContain("quote-dispatch-step-${step.key}");
    expect(source).not.toContain("quote-dispatch-sent-handoff-line");
    expect(source).not.toContain("quote-dispatch-review-visible");
    expect(source).not.toContain("quote-dispatch-recipient-summary");
    expect(source).not.toContain("quote-dispatch-recipient-evidence");
    expect(source).not.toContain("quote-dispatch-blocker-summary");
  });

  it("derives step tone from readiness without storing it (완료 초록 / 현재 파랑 / 막힘 앰버)", () => {
    expect(source).toContain("includedCount > 0");
    expect(source).toContain('sendReadiness === "blocked"');
    expect(source).toContain("border-emerald-200 bg-emerald-50 text-emerald-700");
    expect(source).toContain("border-blue-200 bg-blue-50 text-blue-700");
    expect(source).toContain("border-yellow-200 bg-yellow-50 text-yellow-700");
  });

  it("keeps the honesty remediation CTA when blocked (no dead button)", () => {
    expect(source).toContain("quote-dispatch-supplier-remediation-visible-cta");
    expect(source).toContain("openSupplierRemediation");
  });
});
