/**
 * §invite-flow Phase 3 — 좌석 한도 정본 (생성·수락 **한 함수**)
 *   (PLAN: docs/plans/PLAN_invite-flow.md Phase 3 · 호영님 판정 2026-09-04)
 *
 * 왜 이 파일이 있는가:
 *   좌석 게이지는 `PLAN_LIMITS[plan].maxMembers` 를 화면에 말해 왔는데 **집행 지점이 0** 이었다.
 *   게이지가 말하는 한도와 서버가 막는 한도가 달랐다 — 이 트랙이 계속 없애 온 형태다.
 *
 * 🔑 **정본은 하나다.** 초대 생성 게이트와 수락 게이트가 이 함수를 부른다.
 *    두 곳에서 각자 세면 반드시 갈린다(Cowork QA 요건 3).
 *
 * 🛑 **pending 초대를 좌석에 포함한다** (요건 4 · 근거를 여기 남긴다):
 *    멤버 수만 세면 Free 조직이 초대를 **여러 개 만들어 두고** 전부 수락되는 순간
 *    상한이 뚫린다. 생성 시점에 좌석을 예약하는 셈으로 세야 상한이 실제 상한이 된다.
 *    pending 정의 = `acceptedAt IS NULL AND revokedAt IS NULL AND expiresAt > now()`
 *    (만료·취소된 초대는 좌석을 잡지 않는다 — 잡으면 상한이 영구히 줄어든다).
 *
 * 🛑 **플랜 출처는 `Organization.plan` 이다 — `subscription.plan` 이 아니다.**
 *    이 저장소에는 플랜 출처가 **둘** 있다(2026-09-04 실측):
 *      seats(여기) · 좌석 게이지(organizations/[id]/page.tsx) → `Organization.plan`
 *      enforce-plan-limit(견적·재고 한도)                      → `subscription.plan`
 *    여기서 `Organization.plan` 을 쓰는 이유는 **화면 게이지와 같은 출처**여야 하기 때문이다 —
 *    게이지가 "3명 중 1명" 이라 말하는데 서버가 다른 수로 막으면 그게 이 트랙이 없애온 형태다.
 *    ⚠️ 나중에 `subscription.plan` 으로 "고치지" 말 것. 고치면 게이지와 조용히 갈린다.
 *    두 출처의 단일화는 **후속 트랙**이다(계획서 §선행 부채 — 그 라우트가 두 값을
 *    트랜잭션 없이 순차로 써서 이미 갈릴 수 있다).
 *
 * 🛑 **레이스**: 동시 수락 2건이 마지막 1좌석을 함께 통과할 수 있다. 그래서 수락은
 *    반드시 **트랜잭션 안에서** `tx` 를 넘겨 재검증한다(요건 5). 읽기 전용 사전 검사만으로는
 *    막지 못한다.
 */
import { Prisma, SubscriptionPlan } from "@prisma/client";
import { db } from "@/lib/db";
import { PLAN_LIMITS } from "@/lib/plans";
import { pendingInviteWhere } from "@/lib/organizations/invite-status";

/** 좌석 판정 — 실패는 예외가 아니라 값이다(호출자마다 다르게 말해야 한다). */
export type SeatAvailability =
  | { ok: true; used: number; limit: number | null; plan: SubscriptionPlan }
  | { ok: false; used: number; limit: number; plan: SubscriptionPlan };

type DbClient = typeof db | Prisma.TransactionClient;

/**
 * 이 조직에 좌석이 한 자리 남아 있는가.
 *
 * @param organizationId 대상 조직
 * @param client 트랜잭션 안에서 재검증할 때 `tx` 를 넘긴다. 생략하면 전역 클라이언트.
 */
export async function assertSeatAvailable(
  organizationId: string,
  client: DbClient = db,
): Promise<SeatAvailability> {
  /* 🛑 `lib/db.ts` 가 `any` 라 조회 결과도 `any` 로 흘러나온다 —
   *    그대로 두면 `PLAN_LIMITS[plan]` 이 noImplicitAny 로 build 에서만 터진다
   *    (sentinel·vitest 는 못 잡는다). 여기서 형태를 명시한다. */
  const organization = (await client.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true },
  })) as { plan: SubscriptionPlan } | null;

  /* 조직이 없으면 좌석을 논할 수 없다. 호출자가 404 로 말한다 —
   * 여기서 던지면 "좌석 없음" 과 "조직 없음" 이 같은 실패로 뭉개진다. */
  const plan = organization?.plan ?? SubscriptionPlan.FREE;
  const limit = PLAN_LIMITS[plan].maxMembers;

  const [members, pendingInvites] = await Promise.all([
    client.organizationMember.count({ where: { organizationId } }),
    /* 🔑 술어를 여기서 다시 적지 않는다 — 화면 목록(`GET /invites`)과 **같은 정본**을 쓴다.
     * 복제하면 한쪽만 고쳐져 "좌석은 찼다는데 목록엔 없다" 가 된다. */
    client.organizationInvite.count({ where: pendingInviteWhere(organizationId) }),
  ]);

  const used = members + pendingInvites;

  // null = 무제한. 현재 어떤 플랜도 null 이 아니지만 계약은 유지한다.
  if (limit === null) return { ok: true, used, limit: null, plan };
  if (used < limit) return { ok: true, used, limit, plan };
  return { ok: false, used, limit, plan };
}

/**
 * 좌석 초과 응답 본문 — 생성·수락이 **같은 코드**를 쓴다.
 *
 * 🛑 "권한이 없습니다" 로 끝내지 않는다. 무엇을 하면 되는지까지 말한다
 *    (계획서 판정 2 설계 기준 · 조용한 실패 금지).
 */
export function seatLimitPayload(seat: {
  used: number;
  limit: number;
  plan: SubscriptionPlan;
}) {
  return {
    code: "SEAT_LIMIT" as const,
    limit: seat.limit,
    used: seat.used,
    plan: seat.plan,
    error: `현재 플랜은 멤버 ${seat.limit}명까지입니다 · 팀원을 초대하려면 플랜을 올려 주세요.`,
    upgradeHref: "/dashboard/settings/plans",
  };
}
