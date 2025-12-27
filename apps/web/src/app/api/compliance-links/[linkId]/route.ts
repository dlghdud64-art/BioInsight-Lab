import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit/audit-logger";
import { AuditEventType } from "@prisma/client";
import { validateRules } from "@/lib/compliance/rules";

/**
 * PATCH /api/compliance-links/[linkId]
 * Compliance link 수정 (ADMIN 또는 organization ADMIN만)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { linkId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const linkId = params.linkId;

    // 기존 링크 조회
    const existingLink = await db.complianceLinkTemplate.findUnique({
      where: { id: linkId },
    });

    if (!existingLink) {
      return NextResponse.json({
        error: "Compliance link not found"
      }, { status: 404 });
    }

    // 권한 확인: ADMIN 또는 해당 organization의 ADMIN
    const member = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: existingLink.organizationId,
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

    // Rules 검증 (제공된 경우)
    if (rules !== undefined) {
      const validation = validateRules(rules);
      if (!validation.valid) {
        return NextResponse.json({
          error: validation.error
        }, { status: 400 });
      }
    }

    // 변경 전 상태 저장
    const before = {
      title: existingLink.title,
      url: existingLink.url,
      description: existingLink.description,
      tags: existingLink.tags,
      rules: existingLink.rules,
      priority: existingLink.priority,
      enabled: existingLink.enabled,
    };

    // Compliance link 수정
    const updatedLink = await db.complianceLinkTemplate.update({
      where: { id: linkId },
      data: {
        ...(title !== undefined && { title }),
        ...(url !== undefined && { url }),
        ...(description !== undefined && { description }),
        ...(tags !== undefined && { tags }),
        ...(rules !== undefined && { rules }),
        ...(priority !== undefined && { priority }),
        ...(enabled !== undefined && { enabled }),
      },
    });

    // 변경 후 상태
    const after = {
      title: updatedLink.title,
      url: updatedLink.url,
      description: updatedLink.description,
      tags: updatedLink.tags,
      rules: updatedLink.rules,
      priority: updatedLink.priority,
      enabled: updatedLink.enabled,
    };

    // AuditLog 기록
    await createAuditLog({
      organizationId: existingLink.organizationId,
      userId: session.user.id,
      eventType: AuditEventType.SETTINGS_CHANGED,
      entityType: 'COMPLIANCE_LINK',
      entityId: linkId,
      action: 'COMPLIANCE_LINK_UPDATE',
      changes: { before, after },
      metadata: {
        linkId,
        title: updatedLink.title,
      },
      success: true,
    });

    return NextResponse.json(updatedLink);

  } catch (error: any) {
    console.error("Error updating compliance link:", error);

    // 실패 AuditLog (session은 try 블록에서만 접근 가능하므로 생략)

    return NextResponse.json(
      { error: error.message || "Failed to update compliance link" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/compliance-links/[linkId]
 * Compliance link 삭제 (ADMIN 또는 organization ADMIN만)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { linkId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const linkId = params.linkId;

    // 기존 링크 조회
    const existingLink = await db.complianceLinkTemplate.findUnique({
      where: { id: linkId },
    });

    if (!existingLink) {
      return NextResponse.json({
        error: "Compliance link not found"
      }, { status: 404 });
    }

    // 권한 확인: ADMIN 또는 해당 organization의 ADMIN
    const member = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: existingLink.organizationId,
      },
    });

    const isOrgAdmin = member?.role === "ADMIN";
    const isSystemAdmin = session.user.role === "ADMIN";

    if (!isOrgAdmin && !isSystemAdmin) {
      return NextResponse.json({
        error: "Forbidden. Requires admin privileges."
      }, { status: 403 });
    }

    // Compliance link 삭제
    await db.complianceLinkTemplate.delete({
      where: { id: linkId },
    });

    // AuditLog 기록
    await createAuditLog({
      organizationId: existingLink.organizationId,
      userId: session.user.id,
      eventType: AuditEventType.SETTINGS_CHANGED,
      entityType: 'COMPLIANCE_LINK',
      entityId: linkId,
      action: 'COMPLIANCE_LINK_DELETE',
      metadata: {
        linkId,
        title: existingLink.title,
        deletedData: existingLink,
      },
      success: true,
    });

    return NextResponse.json({
      success: true,
      message: "Compliance link deleted successfully"
    });

  } catch (error: any) {
    console.error("Error deleting compliance link:", error);

    // 실패 AuditLog (session은 try 블록에서만 접근 가능하므로 생략)

    return NextResponse.json(
      { error: error.message || "Failed to delete compliance link" },
      { status: 500 }
    );
  }
}
