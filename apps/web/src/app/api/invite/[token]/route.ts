import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

/**
 * GET /api/invite/[token]
 * 초대 링크 정보 조회 (수락 페이지에서 초대 정보 미리보기)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const invite = await db.organizationInvite.findUnique({
      where: { token },
      include: {
        organization: { select: { id: true, name: true, description: true } },
      },
    });

    if (!invite) {
      return NextResponse.json({ error: "유효하지 않은 초대 링크입니다." }, { status: 404 });
    }

    // 만료 여부
    if (new Date() > invite.expiresAt) {
      return NextResponse.json(
        { error: "만료된 초대 링크입니다.", expired: true },
        { status: 410 }
      );
    }

    // 이미 수락됨
    if (invite.acceptedAt) {
      return NextResponse.json(
        { error: "이미 사용된 초대 링크입니다.", accepted: true },
        { status: 410 }
      );
    }

    // 취소됨
    if (invite.revokedAt) {
      return NextResponse.json(
        { error: "취소된 초대 링크입니다.", revoked: true },
        { status: 410 }
      );
    }

    return NextResponse.json({
      invite: {
        id: invite.id,
        organizationId: invite.organizationId,
        organizationName: invite.organization.name,
        role: invite.role,
        email: invite.email,
        expiresAt: invite.expiresAt,
      },
    });
  } catch (error) {
    console.error("[Invite/GET]", error);
    return NextResponse.json({ error: "초대 정보 조회에 실패했습니다." }, { status: 500 });
  }
}

/**
 * POST /api/invite/[token]
 * 초대 수락 — 로그인한 유저를 조직 멤버로 추가
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { token } = await params;

    const invite = await db.organizationInvite.findUnique({ where: { token } });

    if (!invite) {
      return NextResponse.json({ error: "유효하지 않은 초대 링크입니다." }, { status: 404 });
    }

    // 만료 검증
    if (new Date() > invite.expiresAt) {
      return NextResponse.json(
        { error: "만료된 초대 링크입니다." },
        { status: 410 }
      );
    }

    // 이미 수락됨
    if (invite.acceptedAt) {
      return NextResponse.json(
        { error: "이미 사용된 초대 링크입니다." },
        { status: 410 }
      );
    }

    // 취소됨
    if (invite.revokedAt) {
      return NextResponse.json(
        { error: "취소된 초대 링크입니다." },
        { status: 410 }
      );
    }

    // 이메일 지정 초대: 본인 이메일과 일치 확인
    if (invite.email) {
      const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: { email: true },
      });
      if (!user || user.email.toLowerCase() !== invite.email.toLowerCase()) {
        return NextResponse.json(
          { error: "이 초대는 다른 이메일 주소로 발급되었습니다." },
          { status: 403 }
        );
      }
    }

    // 이미 조직 멤버인지 확인
    const existing = await db.organizationMember.findFirst({
      where: { userId: session.user.id, organizationId: invite.organizationId },
    });
    if (existing) {
      return NextResponse.json(
        { error: "이미 해당 조직의 멤버입니다." },
        { status: 409 }
      );
    }

    // 트랜잭션: 멤버 추가 + 초대 수락 표시
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.organizationMember.create({
        data: {
          userId: session.user.id,
          organizationId: invite.organizationId,
          role: invite.role,
        },
      });

      await tx.organizationInvite.update({
        where: { id: invite.id },
        data: {
          acceptedAt: new Date(),
          acceptedByUserId: session.user.id,
        },
      });
    });

    return NextResponse.json({
      success: true,
      organizationId: invite.organizationId,
      role: invite.role,
    });
  } catch (error) {
    console.error("[Invite/POST]", error);
    return NextResponse.json({ error: "초대 수락에 실패했습니다." }, { status: 500 });
  }
}
