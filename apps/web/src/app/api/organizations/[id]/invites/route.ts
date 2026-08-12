import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";
import { OrganizationRole } from "@prisma/client";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

// 초대 링크 생성
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { expiresInDays = 7, role = OrganizationRole.VIEWER, email } = body;

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'organization_invite',
      targetEntityType: 'organization',
      targetEntityId: id,
      sourceSurface: 'organization-invite-api',
      routePath: '/api/organizations/[id]/invites',
    });
    if (!enforcement.allowed) return enforcement.deny();

    // 조직 존재 확인
    const organization = await db.organization.findUnique({ where: { id } });
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // 권한 확인 (OWNER 또는 ADMIN)
    const membership = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: id,
        role: { in: [OrganizationRole.OWNER, OrganizationRole.ADMIN] },
      },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    // role 유효성 검증 (OWNER는 초대 불가)
    const validRoles: string[] = Object.values(OrganizationRole).filter(
      (r) => r !== OrganizationRole.OWNER
    );
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `유효하지 않은 역할입니다. 가능한 역할: ${validRoles.join(", ")}` },
        { status: 400 }
      );
    }

    // 만료 일시 계산
    const expiresAt = new Date(
      Date.now() + Math.max(1, Number(expiresInDays)) * 24 * 60 * 60 * 1000
    );

    // 토큰 생성 + DB 저장
    const token = randomBytes(32).toString("base64url");
    const invite = await db.organizationInvite.create({
      data: {
        organizationId: id,
        token,
        email: email || null,
        role: role as OrganizationRole,
        expiresAt,
        createdByUserId: session.user.id,
      },
    });

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/invite/${token}`;

    enforcement.complete({});

    return NextResponse.json({ invite: { ...invite, inviteUrl } });
  } catch (error) {
    enforcement?.fail();
    console.error("[OrgInvites/POST]", error);
    return NextResponse.json({ error: "초대 링크 생성에 실패했습니다." }, { status: 500 });
  }
}

// 초대 링크 목록 조회
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // 권한 확인 (OWNER 또는 ADMIN)
    const membership = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: id,
        role: { in: [OrganizationRole.OWNER, OrganizationRole.ADMIN] },
      },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    // 활성(미수락 + 미취소 + 미만료) 초대 목록
    const now = new Date();
    const invites = await db.organizationInvite.findMany({
      where: {
        organizationId: id,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const invitesWithUrl = invites.map((inv: any) => ({
      ...inv,
      inviteUrl: `${appUrl}/invite/${inv.token}`,
    }));

    return NextResponse.json({ invites: invitesWithUrl });
  } catch (error) {
    console.error("[OrgInvites/GET]", error);
    return NextResponse.json({ error: "초대 목록 조회에 실패했습니다." }, { status: 500 });
  }
}

// 초대 링크 취소 (revoke)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const inviteId = searchParams.get("inviteId");

    if (!inviteId) {
      return NextResponse.json({ error: "inviteId가 필요합니다." }, { status: 400 });
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'organization_invite',
      targetEntityType: 'organization',
      targetEntityId: id,
      sourceSurface: 'organization-invite-api',
      routePath: '/api/organizations/[id]/invites',
    });
    if (!enforcement.allowed) return enforcement.deny();

    // 권한 확인 (OWNER 또는 ADMIN)
    const membership = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: id,
        role: { in: [OrganizationRole.OWNER, OrganizationRole.ADMIN] },
      },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const invite = await db.organizationInvite.findFirst({
      where: { id: inviteId, organizationId: id },
    });
    if (!invite) {
      return NextResponse.json({ error: "초대 링크를 찾을 수 없습니다." }, { status: 404 });
    }

    await db.organizationInvite.update({
      where: { id: inviteId },
      data: { revokedAt: new Date() },
    });

    enforcement.complete({});

    return NextResponse.json({ success: true });
  } catch (error) {
    enforcement?.fail();
    console.error("[OrgInvites/DELETE]", error);
    return NextResponse.json({ error: "초대 취소에 실패했습니다." }, { status: 500 });
  }
}
