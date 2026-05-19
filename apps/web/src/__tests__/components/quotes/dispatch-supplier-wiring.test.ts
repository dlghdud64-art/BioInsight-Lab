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

  it("shows sent tracking evidence after a successful dispatch", () => {
    expect(source).toContain("quote-dispatch-sent-tracking-state");
    expect(source).toContain("quote-dispatch-sent-tracking-id");
    expect(source).toContain("dispatchEventId");
    expect(source).toContain("vendorRequestBatchId");
    expect(source).toContain("createdRequests?.[0]?.id");
  });
});

describe("#quote-dispatch-recipient-summary - top evidence", () => {
  const source = readFileSync(WORKBENCH_PATH, "utf8");

  it("pins selected supplier names and contacts above the send flow", () => {
    expect(source).toContain("quote-dispatch-recipient-summary");
    expect(source).toContain("quote-dispatch-recipient-count-badge");
    expect(source).toContain("quote-dispatch-selected-supplier-names");
    expect(source).toContain("quote-dispatch-selected-contact-list");
    expect(source).toContain("quote-dispatch-next-required-action");
  });

  it("shows supplier count, verified contact count, and the next action in Korean", () => {
    expect(source).toContain("공급사 {includedCount}곳 선택됨");
    expect(source).toContain("회신 담당자 {validContactCount}명 확인됨");
    expect(source).toContain("다음: 메시지 미리보기 확인");
  });
});
