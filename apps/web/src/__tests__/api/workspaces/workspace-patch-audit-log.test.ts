/**
 * #approver-routing-audit-log Phase 1 — RED test
 *
 * /api/workspaces/[id] PATCH 가 threshold 변경 시 createAuditLog 호출.
 * eventType: SETTINGS_CHANGED, entityType: "WORKSPACE",
 * changes: { before: { low, high }, after: { low, high } }.
 *
 * Lock:
 *   - try/catch graceful (mutation atomic 보호)
 *   - threshold 변경 시만 (다른 field 단독 변경 시 skip)
 *   - sensitive data 미포함
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const ROUTE = "src/app/api/workspaces/[id]/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#approver-routing-audit-log — workspace PATCH audit log", () => {
  it("createAuditLog import (lib/audit)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/createAuditLog/);
  });

  it("eventType: WORKSPACE_THRESHOLD_CHANGED 명시 (#approver-routing-event-type-enum-add)", () => {
    // 직전 audit-log batch 의 SETTINGS_CHANGED 재사용 → dedicated enum
    // 으로 swap (#approver-routing-event-type-enum-add).
    const src = read(ROUTE);
    expect(src).toMatch(/eventType:\s*["']WORKSPACE_THRESHOLD_CHANGED["']/);
  });

  it("entityType: WORKSPACE 또는 비슷", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/entityType:\s*["']WORKSPACE["']/);
  });

  it("changes.before / changes.after 명시 (threshold before/after)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/before:\s*\{[\s\S]*?approval/);
    expect(src).toMatch(/after:\s*\{[\s\S]*?approval/);
  });

  it("try/catch graceful (audit fail → mutation 결과 영향 0)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/try[\s\S]*?createAuditLog[\s\S]*?catch/);
  });

  it("threshold 변경 시만 audit (다른 field 단독 변경 시 skip)", () => {
    const src = read(ROUTE);
    // approvalLowThresholdKrw 또는 approvalThresholdKrw 가 명시됐는지 분기 체크
    expect(src).toMatch(/approvalLowThresholdKrw\s*!=\s*null|approvalThresholdKrw\s*!=\s*null|approvalLowThresholdKrw\s*!==\s*undefined|approvalThresholdKrw\s*!==\s*undefined/);
  });

  it("§11.209d-approver-routing 또는 audit-log 코멘트", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/§11\.209d-approver-routing|approver-routing-audit-log|결재 임계치 변경/);
  });
});
