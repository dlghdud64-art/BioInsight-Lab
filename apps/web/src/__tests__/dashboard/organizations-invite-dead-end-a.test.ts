/**
 * §invite-dead-end a — 조직 상세 초대 진입점 정직화 sentinel (호영님 승인 2026-08-31)
 *
 * 잠그는 것: **끝이 끊긴 초대 버튼을 활성으로 두지 않는다.**
 *
 * 실측 (2026-08-31 · 코드 + prod www.labaxis.co.kr):
 *   ① 초대 모달 → POST /api/organizations/[id]/members — 그 라우트에 POST 핸들러 0
 *      (GET·PATCH·DELETE 만). "초대 메일 발송" = dead button.
 *   ② 초대 재발송 → /members/resend-invite — 라우트 자체 0.
 *   ③ 실제 초대 API(/invites)는 토큰만 만들고 수락 화면 /invite/[token] 이 없다(prod 404).
 *      §onboarding-blocker #7 의도된 미완 — invite-accept-pairing 이 "수락 화면 없는 동안
 *      초대 UI 렌더 금지" 를 settings/workspace 에 강제하는데, 조직 상세는 그 짝에서 빠져 있었다.
 *
 * 처방 (a): 진입점 3곳 disabled + 사유 1줄. 모달·mutation 보존(b 트랙 복원용).
 * b 트랙(수락 화면 + OrganizationMember 생성 + 좌석 게이트)이 서면 INVITE_AVAILABLE 을
 * 올리고 이 파일을 승계한다 — I0 이 그 순간을 알린다.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const ORG_DETAIL = "src/app/dashboard/organizations/[id]/page.tsx";
const MEMBERS_ROUTE = "src/app/api/organizations/[id]/members/route.ts";
const ACCEPT_PAGES = ["src/app/invite/[token]/page.tsx", "src/app/invite/[token]/page.ts"];
const acceptScreenExists = ACCEPT_PAGES.some((p) => existsSync(join(REPO_ROOT, p)));

/* ══════════════════════════════════════════════════════════════════════════════
 * 승계 (2026-09-05, §invite-flow Phase 4) — a 는 **해제**됐다.
 *
 * a 의 처방("진입점 3곳 disabled + 사유")은 끝이 끊긴 버튼을 막는 임시 조치였고,
 * 계약은 "b 트랙이 서면 플래그를 올리고 이 파일을 승계한다" 였다. b 3전제가 모두 섰다:
 *   수락 화면(3-3) · OrganizationMember 생성 트랜잭션(3-2) · 좌석 게이트(3-1)
 * 그리고 모달이 부르던 dead 라우트를 `/invites` 로 옮겼다.
 *
 * 🛑 플래그만 `true` 로 두면 `disabled={!INVITE_AVAILABLE}` 구문이 남아 **단언이 공허해진다**
 *   (게이팅이 있다고 말하는데 값이 무력화된 상태). 그래서 게이팅·사유 상수를 **걷어냈고**,
 *   이 파일의 단언도 "무엇을 막는가" 에서 **"무엇이 이어졌는가"** 로 축을 옮긴다.
 *   옛 단언을 그대로 두고 통과시키는 것이 이 저장소가 금지하는 형태다.
 * ══════════════════════════════════════════════════════════════════════════════ */

describe("§invite-dead-end a 승계 — 초대가 끝까지 이어진다", () => {
  it("역방향 — 잠금 잔재 0 (게이팅·사유 상수가 남아 있으면 공허한 단언이 산다)", () => {
    const code = read(ORG_DETAIL);
    expect(code).not.toMatch(/const INVITE_AVAILABLE\s*=/);
    expect(code).not.toMatch(/INVITE_UNAVAILABLE_REASON/);
  });

  it("🔑 초대 모달이 **실재하는 라우트**를 부른다 (dead 라우트 복귀 0)", () => {
    const code = stripComments(read(ORG_DETAIL));
    const fn = code.slice(code.indexOf("const inviteMemberMutation"));
    expect(fn.length).toBeGreaterThan(0);
    expect(fn).toMatch(/\/api\/organizations\/\$\{params\.id\}\/invites`/);
    /* 🛑 근거 ① — `POST /members` 는 핸들러가 없다. 되돌리면 dead button 이 부활한다. */
    const body = fn.slice(0, fn.indexOf("onSuccess"));
    expect(body).not.toMatch(/\/members`/);
    // 라우트가 받는 입력 계약 그대로
    expect(fn).toMatch(/email: data\.userEmail/);
  });

  it("좌석 초과를 '초대 실패' 로 뭉개지 않는다 (원인·다음 행동이 다르다)", () => {
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/SEAT_LIMIT[\s\S]{0,160}?남은 좌석이 없습니다/);
  });

  it("🛑 '초대 완료' 라고 말하지 않는다 — 메일을 보내지 않았다", () => {
    /* 실제로 일어난 일은 "링크가 만들어졌다" 이고 관리자가 전달해야 끝난다.
     * 그래서 링크를 **화면에 남긴다** — 토스트로만 알리면 닫는 순간 전달이 불가능해진다. */
    const code = stripComments(read(ORG_DETAIL));
    expect(code).not.toMatch(/title: "초대 완료"/);
    expect(code).toMatch(/setCreatedInviteUrl\(url \?\? null\)/);
    expect(code).toMatch(/open=\{!!createdInviteUrl\}/);
    expect(code).toMatch(/아직 메일을 보내지 않았습니다/);
  });

  it("모달·mutation 보존 (지운 게 아니라 옮긴 것이다)", () => {
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/const inviteMemberMutation = useMutation/);
    expect(code).toMatch(/<DialogTitle className="text-slate-900">멤버 초대<\/DialogTitle>/);
  });
});

describe("§invite-flow Phase 4 후속 — 대기 축의 출처가 OrganizationInvite 다", () => {
  it("🔑 pendingCount 가 초대 목록에서 나온다 (멤버 필터 금지)", () => {
    /* `members` GET 응답에 `status` 필드가 **없다** → `m.status === "Pending"` 은 영구 false.
     * 초대를 만들 수 없던 동안에는 그 0 이 사실이라 정합했지만, 진입점을 연 뒤에는
     * "만든 초대가 화면 어디에도 없다" 가 된다. */
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/const pendingCount = pendingInvites\.length;/);
    expect(code).not.toMatch(/const pendingCount = members\.filter/);
  });

  it("목록을 GET /invites 에서 읽는다", () => {
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/queryKey: \["organization-invites", params\.id\]/);
    expect(code).toMatch(/\/api\/organizations\/\$\{params\.id\}\/invites`\)/);
  });

  it("🔑 링크 재복사 + 취소가 배선돼 있다 (전달 창을 닫아도 되찾을 수 있다)", () => {
    /* 이 배선 전에는 생성 직후 전달 창을 닫으면 링크를 다시 볼 방법이 없었고,
     * 잘못 만든 초대를 취소할 방법도 없었다(`DELETE /invites` 는 실재하는데 호출부 0). */
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/writeText\(invite\.inviteUrl\)/);
    expect(code).toMatch(/method: "DELETE"[\s\S]{0,80}?\}/);
    expect(code).toMatch(/invites\?inviteId=\$\{encodeURIComponent\(inviteId\)\}/);
    expect(code).toMatch(/revokeInviteMutation\.mutate\(invite\.id\)/);
  });

  it("🛑 멤버 탭에 '초대 대기' 칩이 없다 (수와 목록이 다른 테이블을 보면 안 된다)", () => {
    /* 칩 수만 초대에서 끌어오고 필터는 멤버를 보면 **"대기 3인데 목록 0"** 이 된다.
     * 대기 목록의 자리는 승인·초대 탭이다. */
    const code = stripComments(read(ORG_DETAIL));
    expect(code).toMatch(/\(\["all", "active"\] as const\)/);
    expect(code).not.toMatch(/pending: pendingCount/);
    expect(code).not.toMatch(/memberStatusFilter === "pending"/);
  });

  it("🔑 pending 술어가 정본 하나다 (좌석 계산과 목록이 갈리지 않는다)", () => {
    /* 갈리면 "좌석은 찼다는데 목록엔 없다" 가 된다 — 사용자가 게이트를 확인할 수 없다. */
    const SEATS = read("src/lib/organizations/seats.ts");
    const ROUTE = read("src/app/api/organizations/[id]/invites/route.ts");
    expect(SEATS).toMatch(/pendingInviteWhere\(organizationId\)/);
    expect(ROUTE).toMatch(/where: pendingInviteWhere\(id\)/);
    // 술어를 다시 적은 곳이 없다 (복제 부활 시 RED)
    expect(stripComments(SEATS)).not.toMatch(/acceptedAt: null/);
    expect(stripComments(ROUTE)).not.toMatch(/acceptedAt: null/);
  });
});

describe("근거 실재 — 해제 후에도 남아 있는 축", () => {
  it("members 라우트에 POST 핸들러가 없다 (근거 ① — 되살리면 재판정)", () => {
    const route = stripComments(read(MEMBERS_ROUTE));
    expect(route).not.toMatch(/export async function POST/);
  });

  it("resend-invite 라우트가 없다 (근거 ② 유효)", () => {
    expect(
      existsSync(join(REPO_ROOT, "src/app/api/organizations/[id]/members/resend-invite")),
    ).toBe(false);
  });

  it("🔑 그래서 재발송 버튼은 **도달 불가**다 — status Pending 생산자 0", () => {
    /* 플래그를 걷어내도 재발송이 되살아나지 않는 이유. 이 값의 생산자가 생기는 순간
     * 재발송이 도달 가능해지므로 그때 라우트를 함께 만들어야 한다 — 여기서 알린다. */
    const producers = [
      "src/app/api/organizations/[id]/members/route.ts",
    ].filter((rel) => /status:\s*"Pending"/.test(read(rel)));
    expect(producers).toEqual([]);
  });

  it("수락 화면이 실재한다 (b 전제 — 지우면 링크가 다시 죽는다)", () => {
    expect(acceptScreenExists).toBe(true);
  });
});
