/**
 * §11.201 #pricing-operating-volume-redefine — Phase 3 RED test
 *
 * /dashboard/pricing 4 카드 통일 (public /pricing 과 동일 descriptor 통과) +
 * settings billing 의 plan label 한국어 swap (descriptor.label 통과).
 *
 * lock §11.142 호환:
 *   - canonical SubscriptionPlan / WorkspacePlan / BillingStatus 변경 0
 *   - dead checkout 0 (CTA route alive)
 *   - fake "AI 무제한" 0
 *   - logged-in 분기 "현재 사용 중" badge 보존 (canonical workspace.plan)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const DASHBOARD_PRICING = "src/app/dashboard/pricing/page.tsx";
const SETTINGS = "src/app/dashboard/settings/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.201 /dashboard/pricing — descriptor 통과 + 4 카드 통일", () => {
  it("PLAN_DESCRIPTOR import 사용 (raw plan name 0)", () => {
    const src = read(DASHBOARD_PRICING);
    expect(src).toMatch(/from\s+["']@\/lib\/billing\/plan-descriptor["']/);
    expect(src).toMatch(/PLAN_DESCRIPTOR|getPlanDescriptor/);
  });

  it("4 카드 통일 — PLAN_INTENT_VALUES.map 패턴 (3 카드 hardcoded 폐기)", () => {
    const src = read(DASHBOARD_PRICING);
    expect(src).toMatch(/PLAN_INTENT_VALUES/);
    // hardcoded 카드 라벨 잔존 0 — 영문 plan name 카드 정의 패턴 폐기
    expect(src).not.toMatch(/CardTitle[^>]*>\s*프로\s*\(Pro\)/);
    expect(src).not.toMatch(/CardTitle[^>]*>\s*스타터\s*\(Starter\)/);
    expect(src).not.toMatch(/CardTitle[^>]*>\s*엔터프라이즈/);
  });

  it("Hard-coded magic price (₩99,000 / ₩129,000 / ₩349,000) 0 — descriptor 통과", () => {
    const src = read(DASHBOARD_PRICING);
    // 직접 hardcoded ₩99,000 패턴 0 (descriptor.priceMonthlyKrw 통과)
    expect(src).not.toMatch(/₩99,000/);
    // 카드 안 hardcoded ₩129,000 / ₩349,000 도 0 (descriptor + formatter 통과)
    expect(src).not.toMatch(/text-4xl[^>]*>\s*₩(129|349),000/);
  });

  it("'BEST CHOICE' 영문 badge 0 — recommendTag 한국어 통과", () => {
    const src = read(DASHBOARD_PRICING);
    expect(src).not.toMatch(/BEST CHOICE/);
    // 한국어 추천 tag 또는 descriptor.recommendTag 통과
    expect(src).toMatch(/recommendTag|추천:/);
  });

  it("'팀원 무제한' / 'AI 무제한' fake 약속 0 — descriptor.features 통과", () => {
    const src = read(DASHBOARD_PRICING);
    // PLAN.md 정합 — fake "AI 무제한" / "팀원 무제한" 약속 0.
    // descriptor.features 가 정량 기반 ("월 30건" 같은) 으로 통과되므로 안전.
    expect(src).not.toMatch(/팀원\s*및?\s*재고\s*무제한/);
    expect(src).not.toMatch(/AI\s*무제한/);
  });

  it("handlePlanSelect resolver 보존 (canonical /api/billing/plan-select)", () => {
    const src = read(DASHBOARD_PRICING);
    expect(src).toMatch(/\/api\/billing\/plan-select/);
    expect(src).toMatch(/handlePlanSelect|onSelect/);
  });

  it("logged-in '현재 사용 중' badge 보존 (workspace.plan 매핑)", () => {
    const src = read(DASHBOARD_PRICING);
    // canonical workspace.plan 또는 currentWorkspacePlan 같은 매핑 패턴
    expect(src).toMatch(/현재\s*사용|현재\s*플랜|currentPlan|currentWorkspacePlan|workspace\.plan/);
  });
});

describe("§11.201 /dashboard/settings — billing plan label 한국어 swap", () => {
  it("plan EDITION 영문 sub-label 폐기 (FREE EDITION / PROFESSIONAL EDITION 0)", () => {
    const src = read(SETTINGS);
    // 영문 EDITION 톤 → 한국어 descriptor.label 통과로 swap
    // (단, sub-label tracking-wider 패턴은 유지 가능 — 한국어 라벨 + "플랜")
    expect(src).not.toMatch(/FREE EDITION/);
    expect(src).not.toMatch(/PROFESSIONAL EDITION/);
    expect(src).not.toMatch(/ENTERPRISE EDITION/);
    expect(src).not.toMatch(/EDITION 미지정/);
  });

  it("descriptor 통과 또는 한국어 plan 라벨 노출", () => {
    const src = read(SETTINGS);
    // descriptor import or workspace plan → 한국어 라벨 매핑 함수
    expect(src).toMatch(/from\s+["']@\/lib\/billing\/plan-descriptor["']|getPlanLabel|PLAN_DESCRIPTOR|workspacePlanToIntent/);
  });

  it("'AI 무제한' / '무제한 워크스페이스' 카피 0 (settings billing section)", () => {
    const src = read(SETTINGS);
    expect(src).not.toMatch(/AI\s*무제한/);
    expect(src).not.toMatch(/무제한\s*워크스페이스/);
  });
});
