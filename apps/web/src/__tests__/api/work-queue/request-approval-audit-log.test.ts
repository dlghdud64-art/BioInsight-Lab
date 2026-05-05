/**
 * #approver-routing-audit-log Phase 1 — RED test
 *
 * request-approval/route.ts 가 PR INSERT 성공 후 createAuditLog 호출.
 * eventType: WORK_QUEUE_TASK_GENERATED, entityType: "PURCHASE_REQUEST",
 * metadata: { source, totalAmount, appliedThresholds, approverId, requesterId }.
 *
 * Lock:
 *   - try/catch graceful (mutation atomic 보호)
 *   - PR INSERT 성공 후만 (실패 시 skip)
 *   - candidate.source + appliedThresholds 추적성
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const ROUTE =
  "src/app/api/work-queue/purchase-conversion/[quoteId]/request-approval/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#approver-routing-audit-log — request-approval audit log", () => {
  it("createAuditLog import (lib/audit)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/createAuditLog/);
  });

  it("eventType: PURCHASE_REQUEST_CREATED 명시 (#approver-routing-event-type-enum-add)", () => {
    // 직전 audit-log batch 의 WORK_QUEUE_TASK_GENERATED 재사용 → dedicated
    // enum 으로 swap (#approver-routing-event-type-enum-add).
    const src = read(ROUTE);
    expect(src).toMatch(/eventType:\s*["']PURCHASE_REQUEST_CREATED["']/);
  });

  it("entityType: PURCHASE_REQUEST 명시", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/entityType:\s*["']PURCHASE_REQUEST["']/);
  });

  it("metadata 에 candidate.source 포함 (workspace_admin / org_owner / org_admin / self_admin)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/source:\s*candidate\.source|candidate\.source/);
  });

  it("metadata 에 totalAmount 포함 (audit 추적성)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/totalAmount:[\s\S]*quote\.totalAmount|quote\.totalAmount/);
  });

  it("metadata 에 appliedThresholds (low + high) 포함", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/appliedThresholds|approvalLowThresholdKrw[\s\S]*approvalThresholdKrw|low[\s\S]*high/);
  });

  it("try/catch graceful (audit fail → mutation 결과 영향 0)", () => {
    const src = read(ROUTE);
    // createAuditLog 호출이 try block 안
    expect(src).toMatch(/try[\s\S]*?createAuditLog[\s\S]*?catch/);
  });

  it("§11.209d-approver-routing 또는 audit-log 코멘트", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/§11\.209d-approver-routing|approver-routing-audit-log|결재 매핑 audit/);
  });
});
