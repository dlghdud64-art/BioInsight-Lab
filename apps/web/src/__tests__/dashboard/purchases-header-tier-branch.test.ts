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
      // 의도적 주석 인용 — 이 단언은 소스 **주석의 출처 태그**를 문다(주석이 사라지면 RED 가 맞다). §comment-axis 2026-09-21 조사에서 무효 아님으로 분류됨.
      expect(src).toMatch(/§11\.209b\s+Phase\s+3|§11\.209b/);
    });
  });

  /* 🛑 은퇴 §purchases-ui-removed (2026-09-24 · 호영님 판정) — describe("page — Tier 분기 헤더 카피") 5건.
   *    잴 화면(app/dashboard/purchases/page.tsx)이 삭제됐다.
   *    🔑 **API 축(위 describe)은 살아 있다** — /api/work-queue/purchase-conversion 이 workspacePlan 을
   *       내려주는 계약은 그대로다. 그 위에 얹힌 **헤더 카피**만 갈 곳이 없어졌다.
   *    명제 원문: 플랜별 결재 약속 카피를 resolveApprovalPolicyForPlan 단일 소스로 분기하고,
   *      결재가 없는 플랜(none)에는 결재 라인을 약속하지 않는다.
   *      → 이 명제는 **결재 CTA 를 견적 상세로 옮길 때 그쪽에서 다시 든다**(호영님 ① 판정). */
});
