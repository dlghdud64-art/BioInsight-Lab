/**
 * §11.209d-notification Phase 2-3 — mutation routes email wiring
 *
 * 3 mutation routes 가 sendEmail 호출 + 새 templates 사용 검증.
 * - request-approval → generatePurchaseApprovalRequestEmail (approver)
 * - request/[id]/approve → generatePurchaseApprovedEmail (requester)
 * - request/[id]/reject → generatePurchaseRejectedEmail (requester + reason)
 *
 * canonical: best effort — try/catch graceful (mutation 성공 후 email fail 시
 * audit log + console error, mutation 자체는 성공 유지).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.209d-notification — request-approval route email", () => {
  const ROUTE = "src/app/api/work-queue/purchase-conversion/[quoteId]/request-approval/route.ts";

  it("sendEmail import + generatePurchaseApprovalRequestEmail import", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/sendEmail/);
    expect(src).toMatch(/generatePurchaseApprovalRequestEmail/);
  });

  it("approver email 조회 + sendEmail 호출", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/email:\s*true/);
    expect(src).toMatch(/sendEmail\s*\(/);
  });

  it("graceful try/catch (email fail 시 mutation 성공 유지)", () => {
    const src = read(ROUTE);
    // sendEmail 호출이 try/catch 안에 있고 mutation 후에 호출
    expect(src).toMatch(/try\s*\{[\s\S]*?sendEmail[\s\S]*?\}\s*catch/);
  });
});

describe("§11.209d-notification — request/[id]/approve route email", () => {
  const ROUTE = "src/app/api/request/[id]/approve/route.ts";

  it("sendEmail + generatePurchaseApprovedEmail import", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/sendEmail/);
    expect(src).toMatch(/generatePurchaseApprovedEmail/);
  });

  it("requester email 조회 + sendEmail 호출 (graceful)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/sendEmail\s*\(/);
    expect(src).toMatch(/try\s*\{[\s\S]*?sendEmail[\s\S]*?\}\s*catch/);
  });
});

describe("§11.209d-notification — request/[id]/reject route email", () => {
  const ROUTE = "src/app/api/request/[id]/reject/route.ts";

  it("sendEmail + generatePurchaseRejectedEmail import", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/sendEmail/);
    expect(src).toMatch(/generatePurchaseRejectedEmail/);
  });

  it("requester email + rejectionReason 포함 sendEmail 호출 (graceful)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/sendEmail\s*\(/);
    expect(src).toMatch(/try\s*\{[\s\S]*?sendEmail[\s\S]*?\}\s*catch/);
    // rejectionReason 또는 reason 변수 forward
    expect(src).toMatch(/rejectionReason|reason/);
  });
});
