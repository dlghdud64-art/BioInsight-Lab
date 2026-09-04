/**
 * §invite-flow Phase 3-2 — 수락 라우트 계약 (GET 미리보기 · POST 트랜잭션)
 *
 * 여기서 이 트랙의 전제가 처음 실재화된다 — 2중 소속이 생기고, Phase 1~4 의 활성 조직
 * 거처가 비로소 쓰인다. 그래서 계약을 코드보다 먼저 잠근다.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "../_helpers/em-dash-scan";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const read = (...seg: string[]) =>
  readFileSync(join(WEB_ROOT, "src", ...seg), "utf8");

const NL = String.fromCharCode(10);

/** `{` 부터 짝이 맞는 `}` 까지 — 글자 수로 자르면 다음 블록을 먹거나 못 미친다.
 *  (stripComments 가 주석을 공백으로 남겨 길이가 늘어나므로 고정 폭은 특히 위험하다.) */
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
const PREVIEW = read("app", "api", "invites", "[token]", "route.ts");
const ACCEPT = read("app", "api", "invites", "[token]", "accept", "route.ts");
const STATUS = read("lib", "organizations", "invite-status.ts");

describe("§invite-flow Phase 3-2 — GET 미리보기 (PII 최소)", () => {
  it("수락 결정에 필요한 최소만 응답한다", () => {
    expect(PREVIEW).toMatch(/organizationName:/);
    expect(PREVIEW).toMatch(/role: invite\.role/);
    expect(PREVIEW).toMatch(/status: inviteStatusOf\(invite\)/);
  });

  it("🛑 토큰만 가진 제3자에게 조직 내부 정보를 주지 않는다", () => {
    /* 판단 기준: 토큰을 아는 사람 = 링크를 받은/전달받은 누구나. 조직 구성원이 아니다.
     * 응답 객체 창 안에서 본다 — 파일 전체로 금지하면 select 절까지 걸린다. */
    const start = PREVIEW.indexOf("return NextResponse.json({");
    expect(start).toBeGreaterThan(-1);
    const payloadRaw = stripComments(PREVIEW.slice(start));
    /* 🛑 `emailLocked: Boolean(invite.email)` 은 **정당하다** — 이메일을 내보내는 게 아니라
     *    "지정된 사람만 수락 가능" 이라는 사실만 만든다. 그 줄을 빼고 원문 노출을 본다.
     *    (첫 판본은 이 줄까지 걸어 자기 함정이 됐다 — 구현자가 정당한 줄을 지워 통과시킬 형태다.) */
    const payload = payloadRaw
      .split("\n")
      .filter((l) => !l.includes("emailLocked"))
      .join("\n");

    // 초대자·대상 이메일 원문·조직 id·좌석/플랜은 나가지 않는다
    expect(payload).not.toMatch(/createdByUserId/);
    expect(payload).not.toMatch(/invite\.email\b/);
    expect(payload).not.toMatch(/organizationId/);
    expect(payload).not.toMatch(/\bplan\b/);
    expect(payload).not.toMatch(/maxMembers|seat/i);

    // 대신 "지정된 사람만 수락 가능" 이라는 **사실만** 말한다
    //   (걸러내기 **전** 창에서 본다 — payload 는 이 줄을 뺀 뒤라 여기서 보면 공허하다)
    expect(payloadRaw).toMatch(/emailLocked: Boolean\(invite\.email\)/);
  });

  it("🛑 route.ts 는 핸들러만 export 한다 (next build 계약)", () => {
    /* 2026-09-04 실측 사고: `inviteStatusOf` 를 route.ts 에서 export 했더니 `next build` 가
     * "not a valid Route export field" 로 죽었다. `tsc --noEmit` 은 못 잡는다(타입은 멀쩡).
     * 병렬 세션 빌드가 먼저 깨져 발견됐다 — 그래서 기계로 막는다.
     * 정규식 대신 접두사 목록으로 본다: 이스케이프가 길어질수록 단언이 약해진다. */
    const ALLOWED = [
      "export async function GET(",
      "export async function POST(",
      "export async function PUT(",
      "export async function PATCH(",
      "export async function DELETE(",
      "export const dynamic",
      "export const revalidate",
      "export const runtime",
      "export const dynamicParams",
      "export const maxDuration",
    ];
    for (const [name, src] of [["preview", PREVIEW], ["accept", ACCEPT]] as const) {
      const exports = src.split(NL).filter((l) => l.startsWith("export"));
      // 수집이 실제로 동작하는지 먼저 (공허 GREEN 방지)
      expect(exports.length).toBeGreaterThan(0);
      const bad = exports.filter((l) => !ALLOWED.some((a) => l.startsWith(a)));
      expect(`${name}: ${bad.join(" | ")}`).toBe(`${name}: `);
    }
  });

  it("상태 판정 순서 — 취소가 만료보다 먼저다", () => {
    /* 취소된 초대가 만료도 됐을 때 "만료" 라고 말하면 관리자가 취소한 사실이 사라진다. */
    const fn = STATUS.slice(STATUS.indexOf("export function inviteStatusOf"));
    const revoked = fn.search(/revokedAt\) return "revoked"/);
    const expired = fn.search(/return "expired"/);
    expect(revoked).toBeGreaterThan(-1);
    expect(expired).toBeGreaterThan(-1);
    expect(revoked).toBeLessThan(expired);
  });

  it("없는 토큰은 404 하나로만 답한다 (존재 여부 누설 0)", () => {
    expect(PREVIEW).toMatch(/if \(!invite\)[\s\S]{0,200}?status: 404/);
  });
});

describe("§invite-flow Phase 3-2 — POST 수락", () => {
  const CODE = stripComments(ACCEPT);

  it("🔑 요건 5 — 좌석을 트랜잭션 **안에서** 다시 센다", () => {
    /* 사전 검사만으로는 동시 수락 레이스를 막지 못한다. `tx` 를 넘겨야 재검증이다. */
    expect(CODE).toMatch(/db\.\$transaction\(async \(tx: Prisma\.TransactionClient\)/);
    expect(CODE).toMatch(
      /\$transaction\([\s\S]{0,400}?assertSeatAvailable\(invite\.organizationId, tx\)/,
    );
    // 사전 검사도 있다(트랜잭션 비용 절약) — 그러나 그것만 있으면 안 된다
    expect(CODE).toMatch(/assertSeatAvailable\(invite\.organizationId\)/);
  });

  it("🔑 요건 2 — 좌석 초과 시 초대를 소각하지 않는다 (같은 링크 재수락 가능)", () => {
    /* `acceptedAt` 을 찍지 않고 트랜잭션을 되돌린다. 좌석이 생기면 다시 수락할 수 있어야 한다.
     * 🛑 좌석 차단 분기 안에서 초대를 건드리면(update/delete) 링크가 죽는다. */
    const txStart = CODE.indexOf("$transaction");
    const blockStart = CODE.indexOf("if (!seat.ok)", txStart);
    expect(blockStart).toBeGreaterThan(-1);
    const blocked = blockFrom(CODE, blockStart);
    expect(blocked.startsWith("{")).toBe(true);
    expect(blocked).not.toMatch(/acceptedAt/);
    expect(blocked).not.toMatch(/organizationInvite\.(update|delete)/);
    /* 승계 (2026-09-04): `return null` → `throw`. Prisma 는 정상 반환을 **커밋**하므로
     * 롤백을 실제로 하려면 throw 여야 한다. 보호의도(초대를 소각하지 않는다)는 불변이다. */
    expect(blocked).toMatch(/throw new SeatLimitAbort\(seat\)/);
    // 그리고 그 사실이 403 으로 나간다
    expect(CODE).toMatch(/error instanceof SeatLimitAbort[\s\S]{0,200}?status: 403/);
  });

  it("🛑 좌석 차단은 **throw** 다 — return 은 Prisma 가 커밋한다", () => {
    /* Prisma interactive transaction 은 콜백이 정상 반환하면 **커밋**한다.
     * 롤백은 throw 여야 일어난다. 지금은 이 분기 위에 쓰기가 없어 피해가 없지만,
     * `return null` 로 두면 "되돌린다" 는 주석이 거짓이 되고 다음 사람이 그 주석을 믿고
     * 이 위로 쓰기를 옮긴다. 규칙을 어길 수 없게 만든다(Cowork QA 권장 (a)). */
    const txStart = CODE.indexOf("$transaction");
    const blockStart = CODE.indexOf("if (!seat.ok)", txStart);
    expect(blockStart).toBeGreaterThan(-1);
    const blocked = blockFrom(CODE, blockStart);
    expect(blocked.startsWith("{")).toBe(true);
    expect(blocked).toMatch(/throw new SeatLimitAbort\(seat\)/);
    expect(blocked).not.toMatch(/return null/);
    // 밖에서 그 신호를 받아 403 으로 바꾼다
    expect(CODE).toMatch(
      /error instanceof SeatLimitAbort[\s\S]{0,200}?seatLimitPayload\(error\.seat\)[\s\S]{0,60}?status: 403/,
    );
  });

  it("🛑 P2002 경합 — 성공한 액션을 실패로 말하지 않는다", () => {
    /* `@@unique([userId, organizationId])` + 검사↔트랜잭션 사이의 창 때문에, "수락" 을
     * 두 번 빠르게 누르면 두 번째가 P2002 로 죽어 **멤버가 됐는데 실패 화면**을 본다.
     * 🔑 그렇다고 곧바로 ok 로 바꾸지 않는다 — **실재를 다시 확인**하고 멱등 응답으로 보낸다.
     *   확인 없이 ok 를 주면 근거 없는 성공 주장이다. */
    expect(CODE).toMatch(
      /Prisma\.PrismaClientKnownRequestError[\s\S]{0,120}?error\.code === "P2002"/,
    );
    const p2002 = CODE.slice(CODE.indexOf('error.code === "P2002"'));
    expect(p2002).toMatch(/organizationMember\.findFirst/);
    // 확인이 **성공 응답보다 앞**이다
    const verify = p2002.search(/organizationMember\.findFirst/);
    const okResp = p2002.search(/alreadyMember: true/);
    expect(verify).toBeGreaterThan(-1);
    expect(okResp).toBeGreaterThan(-1);
    expect(verify).toBeLessThan(okResp);
    // 확인에 실패하면 500 으로 남는다 (성공으로 삼키지 않는다)
    expect(p2002).toMatch(/if \(raced\)[\s\S]{0,300}?\}[\s\S]{0,200}?status: 500/);
  });

  it("트랜잭션이 4가지를 한 덩어리로 한다 (반쪽 성공 0)", () => {
    const tx = CODE.slice(CODE.indexOf("$transaction"));
    expect(tx).toMatch(/tx\.organizationMember\.create/);
    expect(tx).toMatch(/tx\.organizationInvite\.update[\s\S]{0,200}?acceptedAt/);
    expect(tx).toMatch(/tx\.user\.update[\s\S]{0,200}?activeOrganizationId/);
    expect(tx).toMatch(/createAuditLog\([\s\S]{0,600}?tx,/);
  });

  it("실패 상태가 서로 다른 코드로 갈린다 (뭉개기 0)", () => {
    expect(CODE).toMatch(/INVITE_REVOKED[\s\S]{0,600}?status: 410/);
    expect(CODE).toMatch(/INVITE_EXPIRED/);
    expect(CODE).toMatch(/INVITE_EMAIL_MISMATCH[\s\S]{0,400}?status: 403/);
    expect(CODE).toMatch(/INVITE_ALREADY_USED[\s\S]{0,300}?status: 409/);
  });

  it("이미 멤버면 멱등이다 (두 번 눌러도 실패 화면 0)", () => {
    /* 409 로 막으면 성공한 상태인데도 실패로 보인다. */
    const blk = CODE.slice(CODE.indexOf("if (existingMembership)"));
    expect(blk).toMatch(/alreadyMember: true/);
    expect(blk.slice(0, 400)).not.toMatch(/status: 409/);
  });

  it("이메일 대조는 대소문자를 무시한다", () => {
    expect(CODE).toMatch(/invite\.email\.trim\(\)\.toLowerCase\(\) !== sessionEmail/);
    expect(CODE).toMatch(/session\.user\.email[\s\S]{0,40}?\.trim\(\)\.toLowerCase\(\)/);
  });

  it("문구가 다음 행동까지 말한다 (조용한 실패 0)", () => {
    expect(ACCEPT).toMatch(/초대한 분에게 새 링크를 요청해 주세요/);
    expect(ACCEPT).toMatch(/초대받은 계정으로 로그인해 주세요/);
  });
});
