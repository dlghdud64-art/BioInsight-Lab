/**
 * §team-org-role-model 작은 안 — ADMIN 데드락 완화 (호영님 승인 2026-08-12)
 *
 * 배경 (실측 확정, PLAN §1-A):
 *   강등·제거·자진사퇴·팀 폐기가 **전부 0** 이었다. 되돌리는 방법이 DB 직접 수정뿐이고,
 *   그건 고객사가 할 수 없는 일이다. 팀 생성자는 조건 없이 ADMIN 이 되므로
 *   **누구나 팀을 만들면 회수 불가능한 ADMIN 이 된다.**
 *
 * 계약:
 *   T1. 자기 자신 강등 허용 — 단 ADMIN 이 2명 이상일 때만
 *   T2. 마지막 ADMIN 은 강등·나가기 모두 거부 (주인 없는 팀이 더 나쁘다)
 *   T3. 남의 ADMIN 은 강등·제거 모두 거부 (기존 의도 보존)
 *   T4. 에러 문구가 **출구를 알린다** — "변경할 수 없습니다" 만으로는 다음 행동을 모른다
 *   T5. 존재하지 않는 역할(OWNER)을 근거로 거부하지 않는다 — TeamRole = ADMIN|MEMBER|VIEWER
 *   T6. 중복 조건(`!== ADMIN && !== ADMIN`) 0
 *
 * ⚠️ 이것은 **완화이지 해결이 아니다.** 이미 퇴사한 사람은 로그인하지 않으므로 여전히
 *   회수 불가다. 큰 안(조직 OWNER 권한)이 필요한 이유이며, 그쪽은 별도 판정 대기다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const ROUTE_REL = "src/app/api/team/[id]/members/route.ts";
const SRC = readFileSync(join(WEB_ROOT, ROUTE_REL), "utf8");

/** 부정 단언은 주석 제거본에 건다 — 설명 주석이 매칭되면 구현자가 주석 삭제로 통과한다. */
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
const CODE = stripComments(SRC);

describe("§team-org-role-model T0 — 수집이 실제로 동작한다", () => {
  it("라우트 소스가 읽히고 PATCH·DELETE 를 모두 담고 있다", () => {
    expect(CODE.length).toBeGreaterThan(2000);
    expect(CODE).toMatch(/export async function PATCH/);
    expect(CODE).toMatch(/export async function DELETE/);
  });
});

describe("§team-org-role-model T1·T2 — 마지막 ADMIN 보호 + 자기 강등 허용", () => {
  it("ADMIN 수를 실제로 센다 (판정 근거가 DB — 상수/가정 아님)", () => {
    const counts = CODE.match(/teamMember\.count\(\{\s*where:\s*\{\s*teamId,\s*role:\s*TeamRole\.ADMIN\s*\}/g);
    // PATCH 1 + DELETE 1
    expect(counts?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("마지막 1명이면 거부 — 강등·나가기 2곳 모두", () => {
    expect(CODE.match(/adminCount <= 1/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(CODE.match(/code: "LAST_TEAM_ADMIN"/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("자기 자신 판정이 있다 (자기 강등·자기 나가기의 전제)", () => {
    expect(CODE).toMatch(/targetMember\.userId === session\.user\.id/);
  });

  it("무조건 거부가 부활하지 않는다 (데드락 재발 차단)", () => {
    // 이전 구현: 대상이 ADMIN 이면 자기 여부·인원수를 보지 않고 400
    expect(CODE).not.toMatch(/ADMIN 역할은 변경할 수 없습니다/);
    expect(CODE).not.toMatch(/Cannot remove yourself/);
  });
});

describe("§team-org-role-model T3 — 남의 ADMIN 은 여전히 불가", () => {
  it("타인 ADMIN 강등·제거 거부 문구가 있다", () => {
    expect(CODE).toMatch(/다른 관리자의 역할은 변경할 수 없습니다/);
    expect(CODE).toMatch(/다른 관리자는 제거할 수 없습니다/);
  });
});

describe("§team-org-role-model T4 — 문구가 출구를 알린다", () => {
  it("마지막 ADMIN 거부 문구에 다음 행동이 있다", () => {
    expect(CODE.match(/다른 관리자를 먼저 지정하세요/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});

describe("§team-org-role-model T5·T6 — 유령 역할 0, 중복 조건 0", () => {
  it("존재하지 않는 OWNER 를 근거로 거부하지 않는다", () => {
    expect(CODE).not.toMatch(/Cannot remove OWNER/);
    expect(CODE).not.toMatch(/Only ADMIN or OWNER/);
    // TeamRole.OWNER 는 enum 에 없다 — 참조 자체가 0 이어야 한다
    expect(CODE).not.toMatch(/TeamRole\.OWNER/);
  });

  it("같은 값 두 번 보는 중복 조건 0", () => {
    expect(CODE).not.toMatch(
      /role !== TeamRole\.ADMIN && \w+\.role !== TeamRole\.ADMIN/,
    );
  });
});
