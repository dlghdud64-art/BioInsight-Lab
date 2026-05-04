/**
 * §11.209b Phase 3 (옵션 B) #purchases-header-tier-branch — RED test
 *
 * /dashboard/purchases 헤더 부카피의 결재 약속을 workspace.plan 별 분기:
 *   - Lab Team (approvalPolicy='none') → 결재 약속 제거 (dead promise 차단)
 *   - R&D Operations / Enterprise (approvalPolicy='in_app_approval') →
 *     기존 "결재 라인에 자동으로..." 약속 visible
 *
 * 옵션 1 보수적 wiring 정합 — workspacePlanToIntent("TEAM") = "team" →
 * approvalPolicy = "none" 인 현실에서, Lab Team 사용자에게 결재 약속이
 * dead promise 가 되는 것을 차단.
 *
 * canonical truth:
 *   - PLAN_DESCRIPTOR.approvalPolicy single source (§11.201 lock)
 *   - work-queue/purchase-conversion route 가 response.data 에
 *     workspacePlan field 추가 (page useQuery 통과)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PURCHASES = "src/app/dashboard/purchases/page.tsx";
const ROUTE = "src/app/api/work-queue/purchase-conversion/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.209b Phase 3 옵션 B — purchases 헤더 카피 Tier 분기", () => {
  describe("route — workspacePlan 노출", () => {
    it("response.data 에 workspacePlan field 추가", () => {
      const src = read(ROUTE);
      // data: { items, stats, workspacePlan } 패턴 또는 동등
      expect(src).toMatch(/workspacePlan/);
    });

    it("workspaceMember.findFirst 통한 plan 조회 (billing/checkout 패턴)", () => {
      const src = read(ROUTE);
      expect(src).toMatch(/workspaceMember\.findFirst/);
    });

    it("§11.209b Phase 3 코멘트 명시", () => {
      const src = read(ROUTE);
      expect(src).toMatch(/§11\.209b\s+Phase\s+3|§11\.209b/);
    });
  });

  describe("page — Tier 분기 헤더 카피", () => {
    it("resolveApprovalPolicyForPlan import (single source)", () => {
      const src = read(PURCHASES);
      expect(src).toMatch(/resolveApprovalPolicyForPlan[\s\S]*from\s+["']@\/lib\/billing\/plan-descriptor["']|import[\s\S]*resolveApprovalPolicyForPlan[\s\S]*plan-descriptor/);
    });

    it("workspacePlan 기반 approvalPolicy 결정 (resolveApprovalPolicyForPlan 호출)", () => {
      const src = read(PURCHASES);
      expect(src).toMatch(/resolveApprovalPolicyForPlan\s*\(/);
    });

    it("Lab Team 카피 ('none') — 결재 약속 제거", () => {
      const src = read(PURCHASES);
      // Lab Team 카피 — 결재 라인 약속 제거된 단순 카피
      expect(src).toMatch(/회신 받은 견적을 비교하고 발주로 전환하세요\.(?!\s*결재)/);
    });

    it("R&D Operations / Enterprise 카피 ('in_app_approval') — 기존 약속 유지", () => {
      const src = read(PURCHASES);
      // 결재 라인 약속 카피 잔존 (in_app_approval branch)
      expect(src).toMatch(/결재가 필요한 항목은 자동으로 결재 라인에 올라갑니다/);
    });

    it("§11.209b Phase 3 코멘트 명시", () => {
      const src = read(PURCHASES);
      expect(src).toMatch(/§11\.209b\s+Phase\s+3|§11\.209b/);
    });
  });
});
