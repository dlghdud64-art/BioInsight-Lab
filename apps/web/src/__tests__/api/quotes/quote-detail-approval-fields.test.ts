/**
 * §11.209d-mobile Phase 1 #quote-detail-approval-fields — RED test
 *
 * /api/quotes/[id] GET response 가 결재 정보 노출:
 *   - internalApprovalStatus
 *   - latestPendingRequestId
 *   - approvalRequestedAt / approverName / approvalDecidedAt / rejectionReason
 *
 * source-level 검증 — route 가 PurchaseRequest 별도 batched query +
 * derive helper (resolver 와 동일 source) 호출.
 *
 * canonical truth: PurchaseRequest (web 의 §11.209d cluster 와 동일).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const ROUTE = "src/app/api/quotes/[id]/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.209d-mobile Phase 1 — quote detail 결재 정보 노출", () => {
  it("PurchaseRequest 별도 batched query (db.purchaseRequest.findMany)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/db\.purchaseRequest\.findMany|purchaseRequest\.findMany/);
  });

  it("approver { name } + rejectedReason select", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/approver:\s*\{\s*select:\s*\{\s*name:\s*true/);
    expect(src).toMatch(/rejectedReason:\s*true/);
  });

  it("resolver derive helper import (deriveInternalApprovalStatus / deriveApprovalHistory / deriveLatestPendingRequestId)", () => {
    const src = read(ROUTE);
    // 3 helper 중 최소 1개 import (또는 inline duplicate 0)
    expect(src).toMatch(/deriveInternalApprovalStatus|deriveApprovalHistory|deriveLatestPendingRequestId/);
  });

  it("response 에 internalApprovalStatus 노출", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/internalApprovalStatus/);
  });

  it("response 에 approvalRequestedAt / approverName / approvalDecidedAt / rejectionReason 노출", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/approvalRequestedAt/);
    expect(src).toMatch(/approverName/);
    expect(src).toMatch(/approvalDecidedAt/);
    expect(src).toMatch(/rejectionReason/);
  });

  it("response 에 latestPendingRequestId 노출 (mutation caller 가 사용)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/latestPendingRequestId/);
  });

  it("§11.209d-mobile 코멘트 명시 (drift 차단)", () => {
    const src = read(ROUTE);
    // 의도적 주석 인용 — 이 단언은 소스 **주석의 출처 태그**를 문다(주석이 사라지면 RED 가 맞다). §comment-axis 2026-09-21 조사에서 무효 아님으로 분류됨.
    expect(src).toMatch(/§11\.209d-mobile|11\.209d-mobile/);
  });
});
