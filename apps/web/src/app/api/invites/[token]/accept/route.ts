/**
 * §invite-flow Phase 3-2 — 초대 수락 (POST, 트랜잭션)
 *   (PLAN: docs/plans/PLAN_invite-flow.md Phase 3 · 호영님 판정 2026-09-04)
 *
 * 여기서 §invite-flow 의 두 축이 처음으로 **실재화**된다:
 *   ① 2중 소속이 생긴다 → Phase 1~4 가 세운 활성 조직 거처가 비로소 쓰인다.
 *   ② Phase 2-6 의 `hint_forbidden` 403 이 도달 가능해진다(다른 라우트 얘기지만 같은 뿌리).
 *
 * 🛑 **트랜잭션이 필수다.** 반쪽 성공(멤버는 생겼는데 `acceptedAt` 미기록)이 나면 같은 링크로
 *    다시 수락할 수 있고, 그때 좌석이 또 세어진다. 멤버 생성·초대 마감·활성 조직 전환이
 *    한 덩어리여야 한다.
 *
 * 🛑 **좌석은 트랜잭션 안에서 다시 센다** (Cowork QA 요건 5). 동시 수락 2건이 마지막 1좌석을
 *    함께 통과하는 레이스는 사전 검사만으로는 못 막는다.
 *
 * 🔑 **좌석 초과 시 초대를 소각하지 않는다** (요건 2). `acceptedAt` 을 찍지 않고 남겨 두면
 *    관리자가 플랜을 올리거나 자리가 나는 순간 **같은 링크로 다시 수락**할 수 있다.
 *    여기서 초대를 만료시키면 수신자는 아무 잘못 없이 링크를 잃는다.
 */
import { NextRequest, NextResponse } from "next/server";
import { Prisma, OrganizationRole, SubscriptionPlan } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  createAuditLog,
  extractRequestMeta,
  AuditAction,
  AuditEntityType,
} from "@/lib/audit";
import { assertSeatAvailable, seatLimitPayload } from "@/lib/organizations/seats";
import { inviteStatusOf } from "@/lib/organizations/invite-status";

interface InviteRow {
  id: string;
  organizationId: string;
  email: string | null;
  role: OrganizationRole;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
}

/**
 * 좌석 초과를 **트랜잭션 밖으로 던지는** 신호. throw 여야 Prisma 가 롤백한다.
 * 값(payload)을 들고 나가므로 바깥에서 같은 문구로 403 을 만든다.
 */
class SeatLimitAbort extends Error {
  constructor(readonly seat: { used: number; limit: number; plan: SubscriptionPlan }) {
    super("SEAT_LIMIT");
    this.name = "SeatLimitAbort";
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  /* catch 에서도 필요하다 — P2002 실재 확인이 try 밖에서 이뤄진다. */
  let racedUserId = "";
  let racedOrganizationId = "";
  try {
    const session = await auth();
    if (!session?.user?.id) {
      /* 로그인 전이면 화면이 `/auth/signin?callbackUrl=/invite/{token}` 으로 보낸다.
       * 여기서 로그인 URL 을 만들지 않는다 — 라우트가 화면의 이동 경로를 정하면
       * 그 경로가 두 곳에 생긴다. */
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    racedUserId = userId;
    const sessionEmail = (session.user.email ?? "").trim().toLowerCase();
    const { token } = await params;

    const invite = (await db.organizationInvite.findUnique({
      where: { token },
      select: {
        id: true,
        organizationId: true,
        email: true,
        role: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
      },
    })) as InviteRow | null;

    if (!invite) {
      return NextResponse.json(
        { error: "초대를 찾을 수 없습니다. 링크가 올바른지 확인해 주세요." },
        { status: 404 },
      );
    }

    racedOrganizationId = invite.organizationId;

    const status = inviteStatusOf(invite);
    if (status === "revoked" || status === "expired") {
      /* 410 Gone — 존재했으나 더는 유효하지 않다. 404 로 뭉개면 수신자는
       * "링크를 잘못 받았나" 와 "만료됐나" 를 구분하지 못한다. */
      return NextResponse.json(
        {
          code: status === "revoked" ? "INVITE_REVOKED" : "INVITE_EXPIRED",
          error:
            status === "revoked"
              ? "취소된 초대입니다 · 초대한 분에게 새 링크를 요청해 주세요."
              : "만료된 초대입니다 · 초대한 분에게 새 링크를 요청해 주세요.",
        },
        { status: 410 },
      );
    }

    /* 이메일 지정 초대는 그 사람만 수락한다. 대소문자는 무시한다 —
     * 세션 이메일과 초대 이메일의 표기가 달라 거절되면 원인을 알 수 없다. */
    if (invite.email && invite.email.trim().toLowerCase() !== sessionEmail) {
      return NextResponse.json(
        {
          code: "INVITE_EMAIL_MISMATCH",
          error:
            "이 초대는 다른 이메일 주소로 발송되었습니다 · 초대받은 계정으로 로그인해 주세요.",
        },
        { status: 403 },
      );
    }

    const existingMembership = await db.organizationMember.findFirst({
      where: { userId, organizationId: invite.organizationId },
      select: { id: true },
    });

    /* 이미 멤버 — **멱등**. 새 멤버를 만들지 않고 초대만 마감한다.
     * 409 로 막으면 두 번 누른 사용자가 실패 화면을 본다(성공한 상태인데도). */
    if (existingMembership) {
      if (!invite.acceptedAt) {
        await db.organizationInvite.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date(), acceptedByUserId: userId },
        });
      }
      return NextResponse.json({
        ok: true,
        alreadyMember: true,
        organizationId: invite.organizationId,
      });
    }

    if (status === "accepted") {
      /* 이미 수락됐는데 이 사용자는 멤버가 아니다 = **다른 사람이 쓴 링크**다. */
      return NextResponse.json(
        {
          code: "INVITE_ALREADY_USED",
          error: "이미 사용된 초대입니다 · 초대한 분에게 새 링크를 요청해 주세요.",
        },
        { status: 409 },
      );
    }

    // 사전 검사 — 트랜잭션을 여는 비용을 아끼고, 실패 문구를 같은 코드로 만든다.
    const preSeat = await assertSeatAvailable(invite.organizationId);
    if (!preSeat.ok) {
      return NextResponse.json(seatLimitPayload(preSeat), { status: 403 });
    }

    const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      /* 🔑 여기서 **다시** 센다. 사전 검사와 이 지점 사이에 다른 수락이 끼어들 수 있다.
       * `tx` 를 넘겨야 같은 트랜잭션의 시점으로 센다 — 전역 db 로 세면 재검증이 아니다. */
      const seat = await assertSeatAvailable(invite.organizationId, tx);
      if (!seat.ok) {
        /* 🛑 초대를 **소각하지 않는다** — `acceptedAt` 미기록으로 두고 트랜잭션을 되돌린다.
         * 좌석이 생기면 같은 링크로 다시 수락할 수 있어야 한다(요건 2).
         *
         * 🔑 **`return null` 이 아니라 throw 다.** Prisma interactive transaction 은
         *    콜백이 **정상 반환하면 커밋한다** — 롤백은 throw 여야 일어난다.
         *    지금은 이 분기 위에 쓰기가 없어 `return null` 로도 피해가 없지만, 그러면
         *    "되돌린다" 는 주석이 **거짓**이 되고 다음 사람이 그 주석을 믿고 이 위로 쓰기를
         *    옮긴다. 규칙을 어길 수 없게 만드는 쪽을 택한다(Cowork QA 권장 (a)). */
        throw new SeatLimitAbort(seat);
      }

      const member = await tx.organizationMember.create({
        data: {
          userId,
          organizationId: invite.organizationId,
          role: invite.role,
        },
        select: { id: true },
      });

      await tx.organizationInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date(), acceptedByUserId: userId },
      });

      /* 수락한 조직을 **활성 조직으로** 세운다 — 수락하고 나서 다른 조직 화면이 열리면
       * 사용자는 수락이 안 된 줄 안다. Phase 1 의 거처가 여기서 처음 쓰인다. */
      await tx.user.update({
        where: { id: userId },
        data: { activeOrganizationId: invite.organizationId },
      });

      /* 🛑 감사 기록의 축을 **DDL 없이** 맞춘다.
       *    `AuditEntityType` 에 초대 값이 없고 `AuditAction` 은 CREATE|UPDATE|DELETE 뿐이다.
       *    enum 에 값을 더하는 것은 **prod DDL** 이라 별도 승인 건이다(계획서 §Phase 3 조건) —
       *    그것 때문에 이 묶음을 멈추지 않는다. 실제로 일어난 일은 "조직에 멤버가 생겼다" 이므로
       *    ORGANIZATION/CREATE 로 적고, 초대 맥락은 `newData.kind` 로 남긴다.
       *    entityId 는 **조직**이다 — entityType 과 축을 맞춘다(초대 id 를 넣으면 조회가 어긋난다).
       *    ⏳ 초대 전용 enum 값은 다음 DDL 묶음 후보로 계획서에 등재. */
      await createAuditLog(
        {
          userId,
          organizationId: invite.organizationId,
          action: AuditAction.CREATE,
          entityType: AuditEntityType.ORGANIZATION,
          entityId: invite.organizationId,
          newData: {
            kind: "INVITE_ACCEPTED",
            inviteId: invite.id,
            role: invite.role,
            memberId: member.id,
          },
          ...extractRequestMeta(request),
        },
        tx,
      );

      return { memberId: member.id };
    });

    return NextResponse.json({
      ok: true,
      alreadyMember: false,
      organizationId: invite.organizationId,
    });
  } catch (error) {
    /* 좌석 초과 — 트랜잭션은 **롤백됐다**(초대는 그대로 살아 있다). */
    if (error instanceof SeatLimitAbort) {
      return NextResponse.json(seatLimitPayload(error.seat), { status: 403 });
    }

    /* 🛑 P2002 — **성공한 액션을 실패로 말하지 않는다** (Cowork QA 결함 1).
     *
     * `OrganizationMember` 에 `@@unique([userId, organizationId])` 가 있고,
     * 위 `existingMembership` 검사와 트랜잭션 사이에 **창**이 있다. 수신자가 "수락" 을 빠르게
     * 두 번 누르면 두 요청이 모두 `null` 을 보고, 하나가 커밋한 뒤 다른 하나가 P2002 로 죽는다.
     * 그대로 두면 **멤버가 됐는데 실패 화면**을 본다 — placeholder success 의 거울상이다.
     *
     * 🔑 그렇다고 P2002 를 곧바로 성공으로 바꾸지 않는다. **실재를 다시 확인**하고 나서
     *    멱등 응답으로 보낸다 — 확인 없이 ok 를 주면 그건 근거 없는 성공 주장이다. */
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced = await db.organizationMember.findFirst({
        where: { userId: racedUserId, organizationId: racedOrganizationId },
        select: { id: true },
      });
      if (raced) {
        return NextResponse.json({
          ok: true,
          alreadyMember: true,
          organizationId: racedOrganizationId,
        });
      }
    }

    console.error("[invites/accept/POST]", error);
    return NextResponse.json(
      { error: "초대 수락에 실패했습니다." },
      { status: 500 },
    );
  }
}
