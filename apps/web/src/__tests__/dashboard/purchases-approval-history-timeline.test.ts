/**
 * §11.209d-history Phase 2 — detail panel approval history timeline
 *
 * detail panel 의 "내부 결재" row 아래에 timeline 표시.
 * - approvalRequestedAt (요청 시각)
 * - approverName (결재자)
 * - approvalDecidedAt (결재 시각, APPROVED/REJECTED 시)
 * - rejectionReason (REJECTED 시)
 *
 * visibility: internalApprovalStatus !== "NOT_REQUIRED" 시만.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PURCHASES = "src/app/dashboard/purchases/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.209d-history Phase 2 — approval history timeline", () => {
  it("approvalRequestedAt 표시 — '결재 요청' 라벨 + 시각", () => {
    const src = read(PURCHASES);
    expect(src).toMatch(/selectedItem\.approvalRequestedAt/);
    expect(src).toMatch(/결재\s*요청\s*시각|요청\s*시각|approvalRequestedAt[\s\S]*?Date/);
  });

  it("approverName 표시 — '결재자' 라벨", () => {
    const src = read(PURCHASES);
    expect(src).toMatch(/selectedItem\.approverName/);
    expect(src).toMatch(/결재자/);
  });

  it("approvalDecidedAt 표시 — '결재 시각' 라벨 (APPROVED/REJECTED 시)", () => {
    const src = read(PURCHASES);
    expect(src).toMatch(/selectedItem\.approvalDecidedAt/);
    expect(src).toMatch(/결재\s*시각|승인\s*시각|반려\s*시각/);
  });

  it("rejectionReason 표시 — '반려 사유' 라벨 (REJECTED 시)", () => {
    const src = read(PURCHASES);
    expect(src).toMatch(/selectedItem\.rejectionReason/);
    expect(src).toMatch(/반려\s*사유/);
  });

  it("visibility — internalApprovalStatus !== 'NOT_REQUIRED' 시만 timeline 노출", () => {
    const src = read(PURCHASES);
    // timeline section 이 NOT_REQUIRED 가 아닌 경우만 visible
    expect(src).toMatch(/internalApprovalStatus\s*!==?\s*["']NOT_REQUIRED["']/);
  });

  it("§11.209d-history 코멘트 명시", () => {
    const src = read(PURCHASES);
    expect(src).toMatch(/§11\.209d-history|11\.209d-history/);
  });
});
