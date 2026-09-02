/**
 * §invite-flow Phase 2-5 — 쓰기 경로는 활성 조직을 **mutation resolver** 로 읽는다
 *   (PLAN: docs/plans/PLAN_invite-flow.md Phase 2 이관 규칙 · 호영님 승인 2026-09-02)
 *
 * 잠그는 것: 쓰기에서 조직 선택이 관대한 resolver 로 흡수되지 않는다.
 *   `resolveActiveOrganizationId` 는 hint 실패를 활성 조직으로 삼킨다 — **읽기 계약**이다.
 *   쓰기에 그대로 쓰면 "요청이 명시한 조직 != 실제로 쓰인 조직" 이 에러 없이 성립한다.
 *
 * 🛑 두 실패를 뭉개지 않는다(이 파일이 그것도 잠근다):
 *   `hint_forbidden`  → 403 (명시했는데 멤버십 없음)
 *   `no_organization` → 각 호출자의 **기존** 경로 (팀 400 NO_ORGANIZATION · 예산 개인 예산 ·
 *                       활동 로그 organizationId null). 403 으로 통일하지 않는다 —
 *                       "조직이 없다" 와 "권한이 없다" 는 사용자에게 다른 사건이다.
 *
 * hint 축이 라우트마다 다른 것은 **의도된 차이**다:
 *   activity-logs : body.organizationId 를 받는다(로그가 가리키는 조직을 호출자가 안다)
 *   budgets       : hint 없음 — 위 [RBAC] 결정이 "organizationId 는 body 에서 받지 않는다".
 *                   여기에 hint 를 새로 여는 것은 그 결정을 뒤집는 것이라 하지 않았다.
 *   team          : hint 없음 — 생성 요청이 이름·설명만 싣는다.
 *   → 그래서 "전 라우트가 hint 를 받는다" 로 잠그지 않는다. 그건 계약이 아니라 우연이다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(SRC, ...p), "utf8");

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, ""))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const ROUTES: [string, string[]][] = [
  ["activity-logs POST", ["app", "api", "activity-logs", "route.ts"]],
  ["budgets POST", ["app", "api", "budgets", "route.ts"]],
  ["team POST", ["app", "api", "team", "route.ts"]],
];

describe("§invite-flow P2-5 — 쓰기 3경로가 mutation resolver 를 쓴다", () => {
  for (const [label, path] of ROUTES) {
    it(`${label} — resolveOrganizationIdForMutation 사용 · 관대한 resolver 아님`, () => {
      const code = stripComments(read(...path));
      expect(code).toMatch(/resolveOrganizationIdForMutation\s*\(/);
      /* 🛑 "첫 멤버십 직접 선택" 부활 금지는 여기서 다시 잠그지 않는다 —
       *    래칫(org-scope-callers-inventory)이 이미 소유한 사실이고, 이 3파일은 그 상한에서
       *    제거됐으므로 unscoped findFirst 가 되살아나면 거기서 파일명까지 찍혀 RED 다.
       *    같은 사실을 두 곳에서 잠그면 갈라지는 순간 정본을 알 수 없다(이 트랙 규칙).
       *    ⚠️ 실제로 여기 넣었던 역방향 정규식은 `where: { userId, organizationId }` 의
       *       **정당한** 스코프 조회까지 매칭했다(`[^}]*` 가 organizationId 를 삼킴) — 4원칙 ①/④. */
    });
  }

  it("activity-logs — hint 를 받고, 비멤버면 403 (저장 전에 선다)", () => {
    const code = stripComments(read("app", "api", "activity-logs", "route.ts"));
    /* hint 출처가 요청이어야 한다 — 상수·활성값 재사용은 계약이 아니다. */
    expect(code).toMatch(/hint:[\s\S]{0,80}?organizationId/);
    expect(code).toMatch(/hint_forbidden[\s\S]{0,300}?status:\s*403/);
    /* 403 분기가 create 보다 **앞**에 있어야 저장 0 이 성립한다. */
    const guard = code.indexOf('hint_forbidden');
    const create = code.indexOf("activityLog.create");
    expect(guard).toBeGreaterThan(-1);
    expect(create).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(create);
  });

  it("🛑 no_organization 을 403 으로 뭉개지 않는다 — 기존 경로 보존", () => {
    /* 팀: 조직 0 은 400 NO_ORGANIZATION(권한 문제가 아니라 선행 조건 부재) */
    const team = stripComments(read("app", "api", "team", "route.ts"));
    expect(team).toMatch(/NO_ORGANIZATION/);
    expect(team).toMatch(/status:\s*400/);
    /* 예산: 조직 0 은 개인 예산으로 계속 간다(거부가 아니다) */
    const budgets = stripComments(read("app", "api", "budgets", "route.ts"));
    expect(budgets).toMatch(/isPersonalBudget\s*=\s*!membership/);
    /* 활동 로그: 조직 0 은 organizationId null 로 기록(개인 활동 로그가 정당하다) */
    const activity = stripComments(read("app", "api", "activity-logs", "route.ts"));
    expect(activity).toMatch(/finalOrganizationId\s*=\s*orgResolution\.ok\s*\?[\s\S]{0,80}?:\s*null/);
  });

  it("budgets·team 은 hint 를 열지 않는다 (기존 결정 보존)", () => {
    /* budgets 의 [RBAC] 결정("organizationId 는 body 에서 받지 않는다")과 team 의 입력 계약을
     * 이관이 뒤집지 않았는지 — 여기서 hint 가 생기면 그건 결정 교체라 승인이 필요하다. */
    for (const path of [
      ["app", "api", "budgets", "route.ts"],
      ["app", "api", "team", "route.ts"],
    ]) {
      const code = stripComments(read(...path));
      const call = code.match(/resolveOrganizationIdForMutation\s*\(\{[\s\S]{0,200}?\}\)/)?.[0] ?? "";
      expect(call.length).toBeGreaterThan(0);
      expect(call).not.toMatch(/hint/);
    }
  });
});
