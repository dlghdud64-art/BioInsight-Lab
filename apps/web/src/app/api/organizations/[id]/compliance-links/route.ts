import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit/audit-logger";
import { AuditEventType } from "@prisma/client";
import { validateRules } from "@/lib/compliance/rules";

/**
 * GET /api/organizations/[id]/compliance-links
 * 특정 organization의 compliance link 목록 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = params.id;

    // 권한 확인: 해당 organization의 멤버인지 확인
    const member = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId,
      },
    });

    if (!member && session.user.role !== "ADMIN") {
      return NextResponse.json({
        error: "Forbidden. Not a member of this organization."
      }, { status: 403 });
    }

    const links = await db.complianceLinkTemplate.findMany({
      where: {
        organizationId,
      },
      orderBy: {
        priority: 'asc',
      },
    });

    return NextResponse.json({
      links,
      total: links.length,
    });

  } catch (error: any) {
    console.error("Error fetching organization compliance links:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch compliance links" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organizations/[id]/compliance-links
 * 새로운 compliance link 생성 (ADMIN 또는 organization ADMIN만)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = params.id;

    // 권한 확인: ADMIN 또는 organization의 ADMIN
    const member = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId,
      },
    });

    const isOrgAdmin = member?.role === "ADMIN";
    const isSystemAdmin = session.user.role === "ADMIN";

    if (!isOrgAdmin && !isSystemAdmin) {
      return NextResponse.json({
        error: "Forbidden. Requires admin privileges."
      }, { status: 403 });
    }

    const body = await request.json();
    const { title, url, description, tags, rules, priority, enabled } = body;

    // 필수 필드 검증
    if (!title || !url) {
      return NextResponse.json({
        error: "title and url are required"
      }, { status: 400 });
    }

    // Rules 검증
    if (rules) {
      const validation = validateRules(rules);
      if (!validation.valid) {
        return NextResponse.json({
          error: validation.error
        }, { status: 400 });
      }
    }

    // Compliance link 생성
    const link = await db.complianceLinkTemplate.create({
      data: {
        organizationId,
        title,
        url,
        description: description || null,
        tags: tags || null,
        rules: rules || null,
        priority: priority !== undefined ? priority : 100,
        enabled: enabled !== undefined ? enabled : true,
      },
    });

    // AuditLog 기록
    await createAuditLog({
      organizationId,
      userId: session.user.id,
      eventType: AuditEventType.SETTINGS_CHANGED,
      entityType: 'COMPLIANCE_LINK',
      entityId: link.id,
      action: 'COMPLIANCE_LINK_CREATE',
      metadata: {
        linkId: link.id,
        title: link.title,
      },
      success: true,
    });

    return NextResponse.json(link, { status: 201 });

  } catch (error: any) {
    console.error("Error creating compliance link:", error);

    // 실패 AuditLog (session은 try 블록에서만 접근 가능하므로 생략)

    return NextResponse.json(
      { error: error.message || "Failed to create compliance link" },
      { status: 500 }
    );
  }
}
