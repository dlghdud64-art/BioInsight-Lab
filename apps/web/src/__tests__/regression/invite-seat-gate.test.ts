/**
 * §invite-flow Phase 3 — 좌석 게이트 (호영님 판정 2026-09-04 · Cowork QA 요건 5항)
 *
 * 게이지는 `PLAN_LIMITS[plan].maxMembers` 를 말해 왔는데 집행 지점이 0 이었다.
 * 판정: **초대 생성부터 차단** — Free 는 `maxMembers: 1` + 가입 시 조직 자동 생성이라
 * 초대하는 순간 좌석이 없다(기본 경로). 마찰을 초대자 쪽으로 당긴다.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "../_helpers/em-dash-scan";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const read = (...seg: string[]) =>
  readFileSync(join(WEB_ROOT, "src", ...seg), "utf8");

const SEATS = read("lib", "organizations", "seats.ts");
const CREATE = read("app", "api", "organizations", "[id]", "invites", "route.ts");
const ORG_ROUTE = read("app", "api", "organizations", "[id]", "route.ts");
const ORG_PAGE = read("app", "dashboard", "organizations", "[id]", "page.tsx");

describe("§invite-flow Phase 3 — 좌석 정본 (assertSeatAvailable)", () => {
  it("요건 3 — 좌석 계산 함수가 하나뿐이고 export 된다", () => {
    expect(SEATS).toMatch(/export async function assertSeatAvailable\(/);
    expect(SEATS).toMatch(/export function seatLimitPayload\(/);
    // 한도는 PLAN_LIMITS 에서만 나온다 — 여기서 숫자를 새로 적으면 게이지와 갈린다
    expect(SEATS).toMatch(/PLAN_LIMITS\[plan\]\.maxMembers/);
  });

  it("요건 4 — pending 초대를 좌석에 센다 (상한 우회 차단)", () => {
    /* 멤버만 세면 초대를 여러 개 만들어 두고 전부 수락되는 순간 상한이 뚫린다.
     * pending 정의: 미수락 · 미취소 · 미만료. 만료·취소는 좌석을 잡지 않는다
     * (잡으면 상한이 영구히 줄어든다). */
    const code = stripComments(SEATS);
    expect(code).toMatch(/organizationMember\.count/);
    expect(code).toMatch(/organizationInvite\.count/);
    /* 승계 (2026-09-05): 술어를 `pendingInviteWhere` 정본으로 뽑았다 — 화면 목록
     * (`GET /invites`)이 같은 조건을 **복제**하고 있어 한쪽만 고쳐질 수 있었기 때문이다.
     * 보호의도(pending = 미수락·미취소·미만료를 좌석에 센다)는 불변이라, 단언을
     * **정본 정의 쪽**으로 옮긴다. 여기서는 좌석이 그 정본을 쓰는지만 본다. */
    expect(code).toMatch(/pendingInviteWhere\(organizationId\)/);
    const STATUS = read("lib", "organizations", "invite-status.ts");
    expect(STATUS).toMatch(
      /acceptedAt: null[\s\S]{0,160}?revokedAt: null[\s\S]{0,160}?expiresAt: \{ gt: now \}/,
    );
    // 🔑 합산이 실제로 일어난다 — 세기만 하고 안 더하면 단언이 공허하다
    expect(code).toMatch(/const used = members \+ pendingInvites/);
  });

  it("요건 5 — 트랜잭션 클라이언트를 받는다 (수락 레이스 재검증용)", () => {
    /* 동시 수락 2건이 마지막 1좌석을 함께 통과할 수 있다.
     * 읽기 전용 사전 검사만으로는 못 막으므로 `tx` 를 넘길 수 있어야 한다. */
    expect(SEATS).toMatch(/client: DbClient = db/);
    expect(SEATS).toMatch(/Prisma\.TransactionClient/);
    // 전역 db 를 함수 안에서 직접 부르면 tx 를 넘겨도 무의미해진다
    const body = SEATS.slice(SEATS.indexOf("export async function assertSeatAvailable"));
    expect(stripComments(body)).not.toMatch(/\bdb\.organization/);
    expect(stripComments(body)).not.toMatch(/\bdb\.organizationMember/);
    expect(stripComments(body)).not.toMatch(/\bdb\.organizationInvite/);
  });

  it("실패 문구가 다음 행동까지 말한다 (조용한 실패 0)", () => {
    // "권한이 없습니다" 로 끝나면 사용자는 다음 행동을 모른다
    expect(SEATS).toMatch(/팀원을 초대하려면 플랜을 올려 주세요/);
    expect(SEATS).toMatch(/upgradeHref: "\/dashboard\/settings\/plans"/);
    expect(SEATS).toMatch(/code: "SEAT_LIMIT" as const/);
  });
});

describe("§invite-flow Phase 3 — 초대 생성 게이트", () => {
  it("좌석이 없으면 초대 링크를 만들지 않는다 (생성 차단)", () => {
    const code = stripComments(CREATE);
    expect(code).toMatch(/assertSeatAvailable\(id\)/);
    expect(code).toMatch(
      /if \(!seat\.ok\)[\s\S]{0,200}?seatLimitPayload\(seat\)[\s\S]{0,80}?status: 403/,
    );
  });

  it("🔑 게이트가 create **앞**에 있다 (뒤에 있으면 링크가 이미 생겼다)", () => {
    const code = stripComments(CREATE);
    const gate = code.search(/assertSeatAvailable\(/);
    const create = code.search(/organizationInvite\.create\(/);
    // 찾았다는 사실을 먼저 — `-1 < n` 공허 통과 형태를 §2-8 에서 겪었다
    expect(gate).toBeGreaterThan(-1);
    expect(create).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(create);
  });

  it("lock 획득 이후 자체 return 이라 핸들을 닫는다 (§11.21)", () => {
    expect(stripComments(CREATE)).toMatch(
      /if \(!seat\.ok\) \{\s*enforcement\.fail\(\);/,
    );
  });

  it("좌석 계산을 여기서 따로 하지 않는다 (정본 우회 0)", () => {
    /* 라우트가 자기 나름대로 세면 수락 쪽과 갈린다 — 요건 3 의 역방향 잠금. */
    const code = stripComments(CREATE);
    expect(code).not.toMatch(/maxMembers/);
    expect(code).not.toMatch(/organizationMember\.count/);
  });
});

describe("§invite-flow smoke 후속 — 게이지와 게이트가 같은 수를 쓴다", () => {
  /* 🔴 prod 실측(Cowork QA 2026-09-05): 게이지는 `members` 만 세고 게이트는
   * `members + pending 초대` 를 세어, `1 / 3 좌석`(여유 2) 바로 옆에서
   * `남은 좌석이 없습니다` 가 떴다 — **같은 화면 안에서 두 숫자가 서로를 부정**했다.
   * 좌석 정본을 `seats.ts` 하나로 모은 판단이 게이트에는 적용됐고 게이지에는 안 걸렸다. */

  it("🔑 서버가 좌석 수를 준다 (게이트와 **같은 함수**)", () => {
    expect(ORG_ROUTE).toMatch(/assertSeatAvailable\(id\)/);
    expect(ORG_ROUTE).toMatch(
      /seat: \{ used: seat\.used, limit: seat\.limit, plan: seat\.plan \}/,
    );
  });

  it("🔑 게이지 분자가 **서버 값**이다 (멤버 수 아님)", () => {
    const code = stripComments(ORG_PAGE);
    expect(code).toMatch(/const seatUsed = seat\?\.used \?\? totalMembers;/);
    expect(code).toMatch(/\{seatUsed\} \/ \{seatLimit \?\? "무제한"\} 좌석/);
    // 초과 판정도 같은 값 (하나만 바꾸면 게이지와 색이 갈린다)
    expect(code).toMatch(/seatOver = seatLimit !== null && seatLimit > 0 && seatUsed > seatLimit/);
  });

  it("🛑 화면이 좌석을 **다시 계산하지 않는다** (출처가 넷이 되지 않게)", () => {
    /* `totalMembers + pendingInvites.length` 를 화면에서 더하면 그 순간 네 번째 정본이
     * 생기고, 다음에 pending 정의가 바뀔 때 또 갈린다(Cowork QA 조건). */
    const code = stripComments(ORG_PAGE);
    expect(code).not.toMatch(/totalMembers \+ pendingInvites/);
    expect(code).not.toMatch(/pendingInvites\.length \+ totalMembers/);
  });

  it("🔑 좌석 수는 **전 멤버**가 받는다 (초대 목록 경로 아님)", () => {
    /* 초대 목록은 ADMIN/OWNER 전용이라 거기서 끌면 비관리자 게이지가 그대로 갈린다.
     * 조직 상세는 멤버십으로만 게이트되므로 축이 맞는다. */
    const code = stripComments(ORG_PAGE);
    /* 승계 (2026-09-07, §invite-invalidation): 쿼리키를 `lib/organizations/org-query-keys.ts`
     * 정본으로 모았다(화면에 원시 리터럴 0). 🔑 **보호의도 불변** — 이 단언이 지키는 것은
     * 키 **문자열의 위치**가 아니라 "그 쿼리가 이 화면에 실재한다" 는 사실이다.
     * 4원칙 ⑤ 판별: 구현이 계약을 어긴 게 아니라 **검사가 구현을 못 따라간** 쪽이다. */
    expect(code).toMatch(/queryKey: orgQueryKeys\.seat\(params\.id\)/);
    const q = code.slice(code.indexOf("queryKey: orgQueryKeys.seat(params.id)"));
    expect(q.slice(0, 400)).not.toMatch(/enabled:.*isAdmin/);
  });
});
