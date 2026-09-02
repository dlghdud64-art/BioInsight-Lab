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
  ["quotes POST", ["app", "api", "quotes", "route.ts"]],
];

/**
 * 핸들러 본문만 잘라낸다 — `export async function <NAME>` 부터 다음 `export ` 직전까지.
 * 파일 단위 부재 단언이 **틀리는** 경우가 있어서다: 같은 파일의 GET 이 읽기 축으로
 * 관대한 resolver 를 쓰는 것은 정당하다. 쓰기 계약은 POST 본문 안에서만 성립한다.
 * (handler 경계 분리는 Phase 2-4 분류에서 쓴 기법 — Cowork QA 제안 2026-09-02.)
 */
function handlerBody(code: string, name: string): string {
  const start = code.search(new RegExp(`export\\s+async\\s+function\\s+${name}\\b`));
  if (start < 0) return "";
  const rest = code.slice(start + 1);
  const next = rest.search(/\nexport\s+(async\s+)?function\s/);
  return next < 0 ? rest : rest.slice(0, next);
}

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
    /* 팀: 조직 0 은 400 NO_ORGANIZATION(권한 문제가 아니라 선행 조건 부재)
     * 🛑 두 토큰을 **한 분기 안에서** 본다. 독립 toMatch 2개로 쓰면 4원칙 ④(대체 매칭)에 걸린다 —
     *    team/route.ts 에는 `status: 400` 이 2곳이고(name 누락 400 · NO_ORGANIZATION 400),
     *    NO_ORGANIZATION 쪽을 403 으로 바꿔도 **다른 400 이 대신 매칭해 GREEN** 이 유지된다.
     *    즉 이 단언이 막겠다고 선언한 바로 그 변경을 놓친다(Cowork QA 지적 2026-09-02). */
    const team = stripComments(read("app", "api", "team", "route.ts"));
    expect(team).toMatch(/NO_ORGANIZATION[\s\S]{0,80}?status:\s*400/);
    /* 예산: 조직 0 은 개인 예산으로 계속 간다(거부가 아니다) */
    const budgets = stripComments(read("app", "api", "budgets", "route.ts"));
    expect(budgets).toMatch(/isPersonalBudget\s*=\s*!membership/);
    /* 활동 로그: 조직 0 은 organizationId null 로 기록(개인 활동 로그가 정당하다).
     * 창을 orgResolution.ok 분기부터 열어 create 에 그 값이 실리는 것까지 한 흐름으로 본다. */
    const activity = stripComments(read("app", "api", "activity-logs", "route.ts"));
    expect(activity).toMatch(
      /finalOrganizationId[\s\S]{0,60}?orgResolution\.ok[\s\S]{0,80}?:\s*null/,
    );
    expect(activity).toMatch(/organizationId:\s*finalOrganizationId/);
  });

  it("quotes POST — hint 검증 실패가 조용한 승격이 아니라 403 이다 (돈 경로)", () => {
    /* 🛑 이관 **전** 형태: clientOrgId 멤버십 검증 실패 → serverOrgId = null → 바로 아래
     *    fallback 이 첫 멤버십으로 승격 → 화면이 org-A 를 보냈는데 **org-B 에 견적 생성**.
     *    에러도 빈 화면도 없다. 이 단언이 그 형태의 부활을 막는다. */
    const post = handlerBody(read("app", "api", "quotes", "route.ts"), "POST");
    const code = stripComments(post);
    expect(code.length).toBeGreaterThan(0);
    expect(code).toMatch(/hint:\s*clientOrgId/);
    expect(code).toMatch(/hint_forbidden[\s\S]{0,300}?status:\s*403/);
    /* 역방향 — 옛 승격 경로(정렬만 있는 fallback findFirst)가 되살아나면 RED */
    expect(code).not.toMatch(/firstMembership/);
    expect(code).not.toMatch(/orderBy:\s*\{\s*createdAt:\s*"asc"\s*\}/);
  });

  it("quotes POST 본문에 관대한 resolver 가 없다 (GET 은 무관 — 핸들러 한정)", () => {
    /* 파일 단위로 금지하면 틀린다: 같은 파일의 GET 이 나중에 읽기 축으로 이관되면
     * 관대한 resolver 를 쓰는 것이 정당하다. 쓰기 계약은 POST 본문 안에서만 성립한다. */
    const raw = read("app", "api", "quotes", "route.ts");
    const post = stripComments(handlerBody(raw, "POST"));
    expect(post).toMatch(/resolveOrganizationIdForMutation/);
    expect(post).not.toMatch(/resolveActiveOrganizationId\s*\(/);
  });

  it("budgets·team 은 hint 를 열지 않는다 (기존 결정 보존)", () => {
    /* budgets 의 [RBAC] 결정("organizationId 는 body 에서 받지 않는다")과 team 의 입력 계약을
     * 이관이 뒤집지 않았는지 — 여기서 hint 가 생기면 그건 결정 교체라 승인이 필요하다. */
    for (const path of [
      ["app", "api", "budgets", "route.ts"],
      ["app", "api", "team", "route.ts"],
    ]) {
      const code = stripComments(read(...path));
      /* 🛑 첫 호출만 보지 않는다 — 나중에 hint 있는 **두 번째** 호출이 추가되면
       *    `.match()` 는 첫 건만 돌려주므로 통과한다(Cowork QA 하드닝 2026-09-02). */
      const calls = [
        ...code.matchAll(/resolveOrganizationIdForMutation\s*\(\{[\s\S]{0,200}?\}\)/g),
      ].map((m) => m[0]);
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) expect(call).not.toMatch(/hint/);
    }
  });
});
