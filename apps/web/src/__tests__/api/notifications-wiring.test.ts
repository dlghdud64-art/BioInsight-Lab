/**
 * §11.209d-notification-inapp-server-wiring Phase 1 — RED test
 *
 * 3 결재 mutation route 가 dispatchNotificationEvent 호출 (best effort).
 *   - request-approval — PURCHASE_APPROVAL_REQUESTED → approver
 *   - approve — PURCHASE_APPROVED → requester
 *   - reject — PURCHASE_REJECTED → requester (rejectionReason metadata)
 *
 * canonical truth = PurchaseRequest mutation (이미 atomic). notification =
 * best effort (try/catch graceful, mutation 결과 영향 0).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.209d-notification-inapp-server-wiring — request-approval route", () => {
  const ROUTE =
    "src/app/api/work-queue/purchase-conversion/[quoteId]/request-approval/route.ts";

  it("dispatchNotificationEvent import (lib/notifications)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/dispatchNotificationEvent/);
    expect(src).toMatch(/from\s+["']@\/lib\/notifications["']/);
  });

  it("PURCHASE_APPROVAL_REQUESTED eventType 호출", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/eventType:\s*["']PURCHASE_APPROVAL_REQUESTED["']/);
  });

  it("recipients 에 approverId 포함 (approver 수신)", () => {
    const src = read(ROUTE);
    // recipients: [{ userId: approverId }] 또는 비슷한 패턴
    expect(src).toMatch(/recipients:\s*\[\s*\{\s*userId:\s*approverId/);
  });

  it("try/catch graceful (mutation 정합 보호)", () => {
    const src = read(ROUTE);
    // dispatchNotificationEvent 호출이 try block 안에 있어야 함
    expect(src).toMatch(/try[\s\S]*?dispatchNotificationEvent[\s\S]*?catch/);
  });
});

describe("§11.209d-notification-inapp-server-wiring — approve route", () => {
  const ROUTE = "src/app/api/request/[id]/approve/route.ts";

  it("dispatchNotificationEvent import", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/dispatchNotificationEvent/);
  });

  it("PURCHASE_APPROVED eventType 호출", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/eventType:\s*["']PURCHASE_APPROVED["']/);
  });

  it("recipients 에 requesterId 포함 (requester 수신)", () => {
    const src = read(ROUTE);
    // requester 의 userId — purchaseRequest.requesterId 사용
    expect(src).toMatch(/recipients:\s*\[\s*\{\s*userId:\s*[a-zA-Z_.[\]]*requesterId/);
  });

  it("try/catch graceful", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/try[\s\S]*?dispatchNotificationEvent[\s\S]*?catch/);
  });
});

describe("§11.209d-notification-inapp-server-wiring — reject route", () => {
  const ROUTE = "src/app/api/request/[id]/reject/route.ts";

  it("dispatchNotificationEvent import", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/dispatchNotificationEvent/);
  });

  it("PURCHASE_REJECTED eventType 호출", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/eventType:\s*["']PURCHASE_REJECTED["']/);
  });

  it("recipients 에 requesterId 포함", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/recipients:\s*\[\s*\{\s*userId:\s*[a-zA-Z_.[\]]*requesterId/);
  });

  it("metadata 에 rejectionReason 포함 (반려 사유 컨텍스트)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/metadata:\s*\{[\s\S]*?rejectionReason|rejectedReason/);
  });

  it("try/catch graceful", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/try[\s\S]*?dispatchNotificationEvent[\s\S]*?catch/);
  });
});
