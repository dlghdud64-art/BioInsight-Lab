import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";
import { OrganizationRole } from "@prisma/client";

// 초대 링크 생성
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { expiresInDays = 7 } = body;

    // 조직 확인
    const organization = await db.organization.findUnique({
      where: { id },
      include: {
        members: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // 관리자 권한 확인
    const membership = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: id,
        role: OrganizationRole.ADMIN,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    // 기존 활성 초대 링크 확인 (선택사항: 하나만 유지)
    // 여기서는 여러 개 허용

    // 초대 토큰 생성
    const token = randomBytes(32).toString("base64url");
    const expiresAt = expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    // 초대 링크 저장 (OrganizationInvite 모델이 없다면 임시로 다른 방식 사용)
    // Prisma 스키마에 OrganizationInvite 모델이 없다면, 여기서는 간단한 토큰 기반 시스템 사용
    // 실제로는 별도 테이블이 필요하지만, 현재는 메모리/캐시 기반으로 구현
    
    // 임시: JSON 파일이나 다른 저장소 사용 (실제로는 DB 모델 필요)
    // 여기서는 응답만 반환하고, 실제 초대 처리는 /api/invite/[token]에서 처리

    return NextResponse.json({
      invite: {
        token,
        organizationId: id,
        expiresAt: expiresAt?.toISOString() || null,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Error creating invite link:", error);
    return NextResponse.json(
      { error: "Failed to create invite link" },
      { status: 500 }
    );
  }
}

// 초대 링크 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // 조직 확인
    const organization = await db.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // 관리자 권한 확인
    const membership = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: id,
        role: OrganizationRole.ADMIN,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    // 실제로는 OrganizationInvite 테이블에서 조회해야 하지만,
    // 현재 스키마에 없으므로 빈 배열 반환
    // TODO: Prisma 스키마에 OrganizationInvite 모델 추가 필요

    return NextResponse.json({
      invites: [],
    });
  } catch (error: any) {
    console.error("Error fetching invite links:", error);
    return NextResponse.json(
      { error: "Failed to fetch invite links" },
      { status: 500 }
    );
  }
}




