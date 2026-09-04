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
    expect(code).toMatch(
      /acceptedAt: null[\s\S]{0,160}?revokedAt: null[\s\S]{0,160}?expiresAt: \{ gt: new Date\(\) \}/,
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
