/**
 * #quote-table-sticky-action-h12
 *
 * Source-level guard for the quotes table action column and the dispatch
 * readiness evidence shown in the sticky quote action rail.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("#quote-table-sticky-action-h12 action column", () => {
  it("keeps thead actions sticky on the right", () => {
    expect(page).toMatch(/key === "actions"[\s\S]{0,800}sticky\s+right-0/);
    expect(page).toMatch(/key === "actions"[\s\S]{0,900}bg-gray-100[\s\S]{0,120}z-20/);
  });

  it("keeps tbody actions sticky with row background preservation", () => {
    expect(page).toMatch(/if \(key === "actions"\)[\s\S]{0,600}sticky\s+right-0/);
    expect(page).toMatch(/actionBg[\s\S]{0,240}rowIndex % 2/);
  });

  it("keeps tbody row height stable", () => {
    expect(page).toMatch(/return\s*`h-12\s+\$\{bgClass\}/);
  });

  it("preserves table column invariants", () => {
    expect(page).toMatch(/sticky left-0[\s\S]{0,200}z-20/);
    expect(page).toMatch(/key === "actions" \? "min-w-\[120px\]"/);
    expect(page).toMatch(/actions: 120/);
    expect(page).toMatch(/order:\s*\[[\s\S]{0,200}"actions"\s*\]/);
  });
});

describe("quote dispatch sticky action readiness evidence", () => {
  it("shows supplier/contact/preview/send evidence in the sticky action area", () => {
    expect(page).toContain("quote-dispatch-readiness-strip");
    expect(page).toContain("quote-dispatch-readiness-row");
    expect(page).toContain("quote-dispatch-block-reason");
    expect(page).toContain("quote-dispatch-priority-gate");
    expect(page).toContain("quote-dispatch-priority-order");
    expect(page).toContain("supplierStatus");
    expect(page).toContain("contactStatus");
    expect(page).toContain("previewStatus");
    expect(page).toContain("sendStatus");
  });

  it("enables 공급사에 전송 (Send to supplier) only when supplier and contact preflight pass", () => {
    expect(page).toMatch(/const selectedDispatchBlocked = selectedDispatchEvidence \? !selectedDispatchEvidence\.canSend : false/);
    expect(page).toMatch(/const canSend = !preflight\.hardBlocked[\s\S]{0,160}!supplierMissing[\s\S]{0,160}!contactMissing/);
    // §11.248a — "Send to supplier" → "공급사에 전송" 한글화. 양방향 매칭 (cluster lineage 보존).
    expect(page).toMatch(/(공급사에 전송|Send to supplier)/);
    expect(page).toContain("selectedDispatchEvidence.canSend");
    expect(page).toContain("blockReason");
  });

  it("places dispatch recipient gate before generic status/transition copy in the quote rail", () => {
    expect(page).toMatch(
      /data-testid="quote-dispatch-priority-gate"[\s\S]{0,1400}<div className="grid grid-cols-2 gap-2 text-xs">/,
    );
    expect(page).toMatch(/1\. 공급사[\s\S]{0,320}2\. 연락처[\s\S]{0,320}3\. 메시지 미리보기[\s\S]{0,320}4\. 발송 확인/);
  });
});
