/**
 * §invite-flow Phase 3-2 — 초대 미리보기 (GET, 토큰만으로 조회)
 *   (PLAN: docs/plans/PLAN_invite-flow.md Phase 3)
 *
 * 이 라우트는 **로그인 전에도** 불린다 — 링크를 받은 사람이 "무엇을 수락하는지" 를
 * 보고 로그인 여부를 정해야 하기 때문이다. 그래서 인증을 요구하지 않는다.
 *
 * 🛑 **PII 최소화 — 판단 기준은 "토큰을 아는 사람 = 링크를 받은 사람 누구나"** 다
 *    (Cowork QA 2026-09-04). 토큰은 전달·전달·유출될 수 있고, 그 사람은 조직 구성원이 아니다.
 *    노출한다: 조직명 · 역할 · 만료 · 상태 (수락 결정에 **필요한 최소**)
 *    노출하지 않는다:
 *      · 초대자 이름·이메일 — 누가 누구를 초대했는지는 조직 내부 정보다.
 *        (초대자를 보여줘야 신뢰가 생긴다는 반론이 있으나, 그건 메일 본문의 몫이다 —
 *         메일은 수신자가 특정돼 있고 이 엔드포인트는 아니다.)
 *      · 초대 대상 이메일 원문 — 토큰만 가진 제3자에게 **타인의 이메일**을 주는 셈이다.
 *        대신 `emailLocked: boolean` 으로 "지정된 사람만 수락 가능" 이라는 **사실만** 말한다.
 *      · 조직 멤버 수·플랜·좌석 — 조직 규모는 영업 정보다. 좌석 초과는 **수락 시점**에
 *        말한다(미리보기에서 말하면 조직 상태를 토큰만으로 정찰할 수 있다).
 *      · organizationId — 내부 식별자를 줄 이유가 없다.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { OrganizationRole } from "@prisma/client";
import { inviteStatusOf } from "@/lib/organizations/invite-status";

interface InviteRow {
  id: string;
  organizationId: string;
  email: string | null;
  role: OrganizationRole;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  organization: { name: string } | null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
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
        organization: { select: { name: true } },
      },
    })) as InviteRow | null;

    /* 🛑 토큰이 없으면 404. 존재 여부를 다른 코드로 흘리지 않는다 —
     *    토큰 대입 공격에 "있음/없음" 을 알려주면 그 자체가 정보다. */
    if (!invite) {
      return NextResponse.json(
        { error: "초대를 찾을 수 없습니다. 링크가 올바른지 확인해 주세요." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      invite: {
        organizationName: invite.organization?.name ?? null,
        role: invite.role,
        expiresAt: invite.expiresAt,
        status: inviteStatusOf(invite),
        /* 이메일 원문 대신 **사실만** — 지정된 사람만 수락할 수 있는가. */
        emailLocked: Boolean(invite.email),
      },
    });
  } catch (error) {
    console.error("[invites/GET]", error);
    return NextResponse.json(
      { error: "초대 정보를 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
