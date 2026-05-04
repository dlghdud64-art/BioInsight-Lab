/**
 * §11.209d Phase 3 #purchases-internal-approval-ui — RED test
 *
 * /dashboard/purchases UI 시각화 검증.
 * - detail panel 에 internal approval 상태 표시 (external 옆)
 * - PO 발주 전환 CTA disabled when internalApprovalStatus === "PENDING"
 * - 운영자 친화 메시지 (결재 완료 후 발주 가능)
 *
 * canonical truth: PurchaseConversionItem.internalApprovalStatus
 * (§11.209d Phase 1 lock).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PURCHASES = "src/app/dashboard/purchases/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.209d Phase 3 — purchases UI 시각화", () => {
  describe("detail panel — internal approval 상태 표시", () => {
    it("'내부 결재' 라벨 + selectedItem.internalApprovalStatus 분기", () => {
      const src = read(PURCHASES);
      // "내부 결재" 라벨 + internalApprovalStatus 분기 visible
      expect(src).toMatch(/내부\s*결재|내부\s*승인/);
      expect(src).toMatch(/selectedItem\.internalApprovalStatus/);
    });

    it("APPROVED → 결재 완료 라벨", () => {
      const src = read(PURCHASES);
      expect(src).toMatch(/internalApprovalStatus\s*===?\s*["']APPROVED["']/);
    });

    it("PENDING → 결재 대기 라벨", () => {
      const src = read(PURCHASES);
      expect(src).toMatch(/internalApprovalStatus\s*===?\s*["']PENDING["']/);
      expect(src).toMatch(/결재\s*대기/);
    });

    it("REJECTED → 결재 반려 라벨", () => {
      const src = read(PURCHASES);
      expect(src).toMatch(/internalApprovalStatus\s*===?\s*["']REJECTED["']/);
      expect(src).toMatch(/결재\s*반려|반려/);
    });
  });

  describe("PO 발주 전환 CTA — internalApprovalStatus 분기", () => {
    it("PENDING 시 disabled (결재 미완 → 발주 차단)", () => {
      const src = read(PURCHASES);
      // 발주 전환 button 의 disabled 조건에 internalApprovalStatus === "PENDING" 포함
      expect(src).toMatch(/disabled=\{[\s\S]*internalApprovalStatus[\s\S]*PENDING|internalApprovalStatus\s*===?\s*["']PENDING["'][\s\S]*disabled/);
    });

    it("운영자 친화 메시지 — 결재 완료 후 발주 가능", () => {
      const src = read(PURCHASES);
      expect(src).toMatch(/결재\s*완료\s*후\s*발주|결재\s*완료\s*후|결재\s*후\s*발주/);
    });
  });

  describe("§11.209d Phase 3 코멘트 명시 (drift 차단)", () => {
    it("§11.209d 코멘트 명시", () => {
      const src = read(PURCHASES);
      expect(src).toMatch(/§11\.209d/);
    });
  });
});
