/**
 * §org-create-limit B2 — maxOrganizations 정본 신설 + 인라인 제거.
 *
 * 판정 A (호영님 2026-08-29) 2조건을 기계로 잠근다:
 *   1  ∞ 는 명시적 sentinel(null). 매직값 금지.
 *   2  maxOrganizations 를 maxMembers 에서 파생시키지 말 것.
 *      🔑 이게 이 트랙에서 실제로 일어난 오독의 재발 경로다 — FREE·TEAM 에서
 *        두 축의 숫자가 겹치는 것은 베낀 자국이지 정합의 증거가 아니다.
 *        값만 보는 단언으로는 파생과 우연한 일치를 구분할 수 없어 소스를 본다.
 *
 * 🛑 부정 단언은 주석 제거본에 건다. plans.ts 의 maxOrganizations 문서 주석이
 *   "maxMembers 에서 파생시키지 말 것" 이라고 적고 있어, 소스 전체에 걸면
 *   그 설명 주석이 매칭되고 구현자가 주석 삭제로 통과할 수 있다.
 *
 * 🛑 창은 PLAN_LIMITS 본문부터 연다. 인터페이스의 `maxMembers: number | null` 은
 *   타입 선언이지 값이 아니라서, 창을 넓게 열면 그게 대신 매칭된다 (§4원칙 ②).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";
import { PLAN_LIMITS, SubscriptionPlan, getPlanLimits } from "@/lib/plans";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

const PLANS_CODE = stripComments(read("src/lib/plans.ts"));
const PLANS_BODY = PLANS_CODE.slice(PLANS_CODE.indexOf("export const PLAN_LIMITS"));
const ROUTE_CODE = stripComments(read("src/app/api/organizations/route.ts"));

/** PLAN_LIMITS 본문에서 두 축의 우변만 뽑는다. */
function rhsOf(field: "maxMembers" | "maxOrganizations"): string[] {
  const re = new RegExp(field + ":\s*([^,\n]+)", "g");
  return [...PLANS_BODY.matchAll(re)].map((m) => m[1].trim().replace(/,$/, ""));
}

describe("§org-create-limit B2 — 사다리 값 정본", () => {
  it("FREE 1 · TEAM 3 · ORGANIZATION null(무제한)", () => {
    expect(PLAN_LIMITS[SubscriptionPlan.FREE].maxOrganizations).toBe(1);
    expect(PLAN_LIMITS[SubscriptionPlan.TEAM].maxOrganizations).toBe(3);
    expect(PLAN_LIMITS[SubscriptionPlan.ORGANIZATION].maxOrganizations).toBeNull();
  });

  it("∞ 는 undefined 가 아니라 null sentinel 이다 (조건 1 · 매직값 금지)", () => {
    const pro = PLAN_LIMITS[SubscriptionPlan.ORGANIZATION];
    expect("maxOrganizations" in pro).toBe(true);
    expect(pro.maxOrganizations).not.toBeUndefined();
    expect(Number.isFinite(pro.maxOrganizations as unknown as number)).toBe(false);
  });

  it("세 플랜 전부 필드를 갖는다 — 누락 시 getPlanLimits 가 undefined 를 흘린다", () => {
    for (const plan of Object.values(SubscriptionPlan)) {
      expect(getPlanLimits(plan)).toHaveProperty("maxOrganizations");
    }
  });
});

describe("§org-create-limit B2 — 조건 2: maxMembers 파생 금지 (소스 축)", () => {
  it("두 축이 세 플랜 모두에 각각 선언된다", () => {
    expect(rhsOf("maxOrganizations")).toHaveLength(3);
    expect(rhsOf("maxMembers")).toHaveLength(3);
  });

  it("두 축의 값이 전부 리터럴이다 — 식별자/공유 상수 경유 0", () => {
    // 파생의 실제 형태: const SEATS = 3; maxMembers: SEATS, maxOrganizations: SEATS
    for (const v of [...rhsOf("maxOrganizations"), ...rhsOf("maxMembers")]) {
      expect(v).toMatch(/^(\d+|null)$/);
    }
  });

  it("한 축의 우변이 다른 축 이름을 참조하지 않는다", () => {
    expect(PLANS_BODY).not.toMatch(/maxOrganizations:[^,\n]*maxMembers/);
    expect(PLANS_BODY).not.toMatch(/maxMembers:[^,\n]*maxOrganizations/);
  });
});

describe("§org-create-limit B2 — 세 번째 진실 소멸 (route.ts 축)", () => {
  it("라우트가 PLAN_LIMITS 정본을 읽는다", () => {
    expect(ROUTE_CODE).toMatch(/getPlanLimits\(\s*effectivePlan\s*\)\.maxOrganizations/);
  });

  it("라우트에 조직 한도 인라인 상수가 없다 (되살아나면 진실이 둘이 된다)", () => {
    expect(ROUTE_CODE).not.toMatch(/MAX_ORGANIZATIONS/);
    expect(ROUTE_CODE).not.toMatch(/Record<SubscriptionPlan,\s*number\s*\|\s*null>/);
  });

  it("회귀 0 — B1b 배선(OWNER 필터 · plan 실기 · PLAN_ORDER 최고등급)이 살아 있다", () => {
    expect(ROUTE_CODE).toMatch(/role:\s*"OWNER"/);
    expect(ROUTE_CODE).toMatch(/organization:\s*\{\s*select:\s*\{\s*plan:\s*true/);
    expect(ROUTE_CODE).toMatch(/PLAN_ORDER\[/);
  });
});
