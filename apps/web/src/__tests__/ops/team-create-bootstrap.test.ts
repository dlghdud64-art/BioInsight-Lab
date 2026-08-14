/**
 * §team-create-bootstrap — 팀 생성은 **부트스트랩 예외**다 (호영님 승인 2026-08-12)
 *
 * 배경 (왕복 검증 5단계 실측):
 *   신규 가입자가 `POST /api/team` 에서 **403** 을 받았다.
 *   `RESEARCHER → requester` 인데 `team_manage: ['ops_admin']` 이었기 때문이다.
 *   **자기 조직의 OWNER 인데도 첫 팀을 만들 수 없었다.**
 *
 *   그리고 이것은 **새 문제가 아니다** — 세 줄 아래 `workspace_create` 가
 *   같은 역설을 같은 방법으로 이미 풀어 놓았고 주석까지 달려 있다
 *   ("bootstrap paradox 방지: 첫 워크스페이스를 만드는 사람은 아직 ADMIN일 수 없음").
 *   **옆 칸은 그대로였다.** 즉 설계 결정이 아니라 **누락 보정**이다.
 *
 *   ⚠️ 운영에서도 동일하다 — 역할 정책은 DB 무관 코드 상수다.
 *      그리고 고객사가 스스로 풀 수 없다(`User.role` 변경은 우리만 가능).
 *
 * 계약:
 *   T1. `team_create` 가 부트스트랩 역할들을 허용한다 (ops_admin 단독 복귀 = RED)
 *   T2. `workspace_create` 와 **같은 모양**이다 — 같은 이유로 존재하는 예외는
 *       같은 모양이어야 한다. 갈라지면 다음 사람이 어느 쪽을 기준으로 삼을지 모른다
 *   T3. 완화 범위는 **생성뿐**이다 — `team_manage` 는 ops_admin 유지
 *   T4. `team_manage` 가 **빈껍데기가 아니다** — 분리 후에도 실제로 막는 동작이 남아야
 *       한다. 남는 게 없으면 그건 분리가 아니라 우회다
 *   T5. 팀 생성 라우트가 `team_create` 를 쓴다 (도달성)
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(WEB_ROOT, rel), "utf8");
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const GUARD_REL = "src/lib/security/server-authorization-guard.ts";
const GUARD = stripComments(read(GUARD_REL));

/** 정책 한 줄에서 역할 배열을 뽑는다. */
function rolesOf(action: string): string[] | null {
  const m = GUARD.match(new RegExp(`\\n\\s*${action}:\\s*\\[([^\\]]*)\\]`));
  if (!m) return null;
  return m[1]
    .split(",")
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

describe("§team-create-bootstrap T0 — 수집이 실제로 동작한다", () => {
  it("정책 파일이 읽히고 파서가 동작한다", () => {
    expect(GUARD.length).toBeGreaterThan(3000);
    // 파서 자체 검증 — 알려진 값으로 확인(공허 GREEN 방지)
    expect(rolesOf("workspace_manage")).toEqual(["ops_admin"]);
  });
});

describe("§team-create-bootstrap T1·T2 — 부트스트랩 예외", () => {
  it("T1. team_create 가 ops_admin 단독이 아니다", () => {
    const roles = rolesOf("team_create");
    expect(roles).not.toBeNull();
    expect(roles).not.toEqual(["ops_admin"]);
    // 신규 가입자(RESEARCHER → requester)가 반드시 포함돼야 한다
    expect(roles).toContain("requester");
  });

  it("T2. workspace_create 와 같은 모양이다", () => {
    expect(rolesOf("team_create")).toEqual(rolesOf("workspace_create"));
  });
});

describe("§team-create-bootstrap T3·T4 — 완화 범위는 생성뿐", () => {
  it("T3. team_manage 는 ops_admin 을 유지한다", () => {
    expect(rolesOf("team_manage")).toEqual(["ops_admin"]);
  });

  /**
   * T4 — 분리했는데 남은 쪽이 비면 그건 분리가 아니라 우회다(호영님).
   * 실측: `team_manage` 는 초대 · 역할변경 · 멤버제거 **3곳**을 계속 지킨다.
   */
  it("T4. team_manage 가 실제로 막는 동작이 남아 있다", () => {
    const API = join(WEB_ROOT, "src", "app", "api");
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of readdirSync(d)) {
        const f = join(d, e);
        if (statSync(f).isDirectory()) walk(f);
        else if (e === "route.ts") files.push(f);
      }
    };
    walk(API);
    // ⚠️ **파일 수가 아니라 호출 지점 수**를 센다 — members/route.ts 하나가
    //    PATCH·DELETE 두 곳을 갖는다. 첫 작성 때 파일로 세어 2 가 나왔다.
    const sites = files.reduce(
      (n, f) => n + (readFileSync(f, "utf8").match(/action:\s*'team_manage'/g)?.length ?? 0),
      0,
    );
    expect(sites).toBeGreaterThanOrEqual(3); // 초대 · 역할변경 · 멤버제거
  });
});

describe("§team-create-bootstrap T5 — 라우트가 실제로 team_create 를 쓴다", () => {
  it("POST /api/team 이 team_create 로 검사한다", () => {
    const route = stripComments(read("src/app/api/team/route.ts"));
    expect(route).toMatch(/action:\s*'team_create'/);
    expect(route).not.toMatch(/action:\s*'team_manage'/);
  });
});
