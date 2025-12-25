import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { OrganizationRole } from "@prisma/client";

// 보안 설정 조회
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
    const organization = await db.organization.findUnique({
      where: { id },
      select: {
        id: true,
        allowedEmailDomains: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // JSON 필드를 배열로 변환 (null이면 빈 배열)
    const allowedEmailDomains = Array.isArray(organization.allowedEmailDomains)
      ? organization.allowedEmailDomains
      : [];

    return NextResponse.json({
      allowedEmailDomains,
    });
  } catch (error: any) {
    console.error("Error fetching security settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch security settings" },
      { status: 500 }
    );
  }
}

// 보안 설정 저장
export async function PATCH(
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
    const { allowedEmailDomains } = body;

    if (!Array.isArray(allowedEmailDomains)) {
      return NextResponse.json(
        { error: "allowedEmailDomains must be an array" },
        { status: 400 }
      );
    }

    // 관리자 권한 확인
    const adminMembership = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: id,
        role: OrganizationRole.ADMIN,
      },
    });

    if (!adminMembership) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    // 변경 전 값 조회
    const currentOrg = await db.organization.findUnique({
      where: { id },
      select: { allowedEmailDomains: true },
    });

    const beforeDomains = Array.isArray(currentOrg?.allowedEmailDomains)
      ? currentOrg.allowedEmailDomains
      : [];

    // 도메인 형식 검증
    const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;
    for (const domain of allowedEmailDomains) {
      if (typeof domain !== "string" || !domainRegex.test(domain)) {
        return NextResponse.json(
          { error: `Invalid domain format: ${domain}` },
          { status: 400 }
        );
      }
    }

    // Organization 업데이트
    const updated = await db.organization.update({
      where: { id },
      data: { allowedEmailDomains },
    });

    // 감사 로그 기록
    try {
      const { createAuditLog } = await import("@/lib/audit/audit-logger");
      await createAuditLog({
        organizationId: id,
        userId: session.user.id,
        eventType: "SETTINGS_CHANGED",
        entityType: "organization",
        entityId: id,
        action: "update_security_settings",
        changes: {
          before: { allowedEmailDomains: beforeDomains },
          after: { allowedEmailDomains },
        },
        metadata: {
          changedFields: ["allowedEmailDomains"],
        },
      });
    } catch (auditError) {
      // 감사 로그 실패는 무시 (주요 기능은 성공)
      console.error("Failed to create audit log:", auditError);
    }

    return NextResponse.json({
      success: true,
      allowedEmailDomains: Array.isArray(updated.allowedEmailDomains)
        ? updated.allowedEmailDomains
        : [],
    });
  } catch (error: any) {
    console.error("Error updating security settings:", error);
    return NextResponse.json(
      { error: "Failed to update security settings" },
      { status: 500 }
    );
  }
}

