/**
 * §invite-invalidation (2026-09-07) — 정본을 모았으면 **무효화 책임도** 함께 온다.
 *
 * 🔴 prod 실측: `87d7941b` 이 좌석 게이지를 서버 값(`assertSeatAvailable`)으로 모았는데
 *    다시 읽을 시점을 안 걸어, 초대를 만들거나 취소해도 게이지가 옛 수에 멈췄다.
 *    사용자에겐 "취소했습니다" 토스트 + 그대로인 목록으로 보인다 →
 *    한 번 더 누른다 = **이미 revoke 된 초대를 다시 취소하는 요청**.
 *
 * 🛑 처방은 호출부에 대상을 나열하는 게 아니라 **정본 하나를 부르게** 하는 것이다
 *    (Cowork QA 조건). 나열하면 세 번째 mutation 에서 또 빠진다.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "../_helpers/em-dash-scan";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(WEB_ROOT, "src", rel), "utf8");

/** `{` 부터 짝이 맞는 `}` 까지 — 고정 폭·다음 키워드로 자르면 창이 어긋난다. */
function blockFrom(src: string, fromIdx: number): string {
  const open = src.indexOf("{", fromIdx);
  if (open === -1) return "";
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return "";
}

const KEYS = read("lib/organizations/org-query-keys.ts");
const PAGE = read("app/dashboard/organizations/[id]/page.tsx");

describe("§invite-invalidation — 쿼리키 정본", () => {
  it("🔑 키가 한 곳에서만 만들어진다 (화면에 원시 리터럴 0)", () => {
    /* 리터럴이 화면에 남아 있으면 "한 곳" 이 아니다 — 다음 사람이 그걸 복사한다. */
    const code = stripComments(PAGE);
    expect(code).not.toMatch(/\["organization-members"/);
    expect(code).not.toMatch(/\["organization-invites"/);
    expect(code).not.toMatch(/\["organization-seat"/);
    expect(code).toMatch(/orgQueryKeys\.(members|invites|seat)\(params\.id\)/);
  });

  it("🔑 초대 mutation 둘 다 **정본 무효화 함수**를 부른다", () => {
    /* 생성·취소 각각의 onSuccess 블록 안에서 확인한다 —
     * 파일 어딘가에 한 번 있는 것으로는 "둘 다" 를 증명하지 못한다. */
    const code = stripComments(PAGE);
    /* 🛑 창을 "다음 const" 로 자르면 안 된다 — mutation 본문 안에 `const` 가 있어
     * 창이 onSuccess 앞에서 끊긴다(첫 판본이 그래서 오탐했다).
     * CLAUDE.md 4원칙 ⑤: 창은 **블록 경계**로 연다. */
    for (const anchor of ["const inviteMemberMutation", "const revokeInviteMutation"]) {
      const start = code.indexOf(anchor);
      expect(`${anchor}: ${start > -1}`).toBe(`${anchor}: true`);
      const body = blockFrom(code, code.indexOf("useMutation({", start));
      expect(`${anchor}: ${/invalidateInviteScoped\(queryClient, params\.id\)/.test(body)}`).toBe(
        `${anchor}: true`,
      );
    }
  });

  it("🔑 그 함수가 **좌석**을 포함한다 (이번 결함의 핵심)", () => {
    const code = stripComments(KEYS);
    const fn = code.slice(code.indexOf("export function invalidateInviteScoped"));
    expect(fn.length).toBeGreaterThan(0);
    expect(fn).toMatch(/orgQueryKeys\.invites\(organizationId\)/);
    expect(fn).toMatch(/orgQueryKeys\.seat\(organizationId\)/);
  });

  it("🛑 무관한 축(members)은 함께 무효화하지 않는다", () => {
    /* 초대는 멤버를 만들지 않는다(수락이 만든다). 무관한 축을 끼우면
     * "왜 이게 다시 도나" 를 다음 사람이 추적하게 된다. */
    const code = stripComments(KEYS);
    const fn = code.slice(code.indexOf("export function invalidateInviteScoped"));
    expect(fn).not.toMatch(/orgQueryKeys\.members/);
  });

  it("키 정본이 세 축을 모두 노출한다 — 이름까지 고정", () => {
    /* 상수 참조 단언의 공허한 통과를 피한다(CLAUDE.md §상수를 참조하는 단언). */
    expect(KEYS).toMatch(/members: \(organizationId: string\)/);
    expect(KEYS).toMatch(/invites: \(organizationId: string\)/);
    expect(KEYS).toMatch(/seat: \(organizationId: string\)/);
    expect(KEYS).toMatch(/"organization-members"/);
    expect(KEYS).toMatch(/"organization-invites"/);
    expect(KEYS).toMatch(/"organization-seat"/);
  });
});
