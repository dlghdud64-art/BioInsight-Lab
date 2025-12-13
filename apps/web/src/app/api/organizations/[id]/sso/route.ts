import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, isPrismaAvailable } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import { validateSSOConfig, convertSSOConfigToProvider } from "@/lib/auth/sso-config";
import { createAuditLog } from "@/lib/audit/audit-logger";
import { hasPermission } from "@/lib/permissions/permission-checker";

/**
 * SSO 설정 조회
 */
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
        name: true,
        ssoEnabled: true,
        ssoProvider: true,
        ssoConfig: true,
        ssoMetadataUrl: true,
        ssoEntityId: true,
      },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // 권한 확인
    const orgMember = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: id,
      },
    });

    const hasAccess =
      session.user.role === "ADMIN" ||
      (orgMember && hasPermission(session.user.role as any, orgMember.role, "sso.configure"));

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      ssoEnabled: organization.ssoEnabled,
      ssoProvider: organization.ssoProvider,
      ssoConfig: organization.ssoConfig,
      ssoMetadataUrl: organization.ssoMetadataUrl,
      ssoEntityId: organization.ssoEntityId,
    });
  } catch (error) {
    console.error("Error fetching SSO config:", error);
    return NextResponse.json(
      { error: "Failed to fetch SSO config" },
      { status: 500 }
    );
  }
}

/**
 * SSO 설정 업데이트
 */
export async function PUT(
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
    const {
      ssoEnabled,
      ssoProvider,
      ssoConfig,
      ssoMetadataUrl,
      ssoEntityId,
      ssoCertificate,
    } = body;

    // 조직 확인
    const organization = await db.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // 권한 확인
    const orgMember = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: id,
      },
    });

    const hasAccess =
      session.user.role === "ADMIN" ||
      (orgMember && hasPermission(session.user.role as any, orgMember.role, "sso.configure"));

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // SSO 설정 검증
    if (ssoEnabled) {
      const ssoConfigData = {
        provider: ssoProvider,
        enabled: ssoEnabled,
        metadataUrl: ssoMetadataUrl,
        entityId: ssoEntityId,
        certificate: ssoCertificate,
        ...ssoConfig,
      };

      const validation = validateSSOConfig(ssoConfigData as any);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400 }
        );
      }
    }

    // SSO 설정 업데이트
    const updated = await db.organization.update({
      where: { id },
      data: {
        ssoEnabled: ssoEnabled || false,
        ssoProvider: ssoEnabled ? ssoProvider : null,
        ssoConfig: ssoEnabled ? (ssoConfig || {}) : null,
        ssoMetadataUrl: ssoEnabled ? ssoMetadataUrl : null,
        ssoEntityId: ssoEnabled ? ssoEntityId : null,
        ssoCertificate: ssoEnabled ? ssoCertificate : null,
      },
    });

    // 감사 로그 기록
    const ipAddress = request.headers.get("x-forwarded-for") || 
                     request.headers.get("x-real-ip") || 
                     null;
    const userAgent = request.headers.get("user-agent") || null;

    createAuditLog({
      organizationId: id,
      userId: session.user.id,
      eventType: "SSO_CONFIGURED",
      entityType: "organization",
      entityId: id,
      action: ssoEnabled ? "enable" : "disable",
      metadata: {
        provider: ssoProvider,
      },
      ipAddress,
      userAgent,
    }).catch((error) => {
      console.error("Failed to create audit log:", error);
    });

    return NextResponse.json({
      success: true,
      ssoEnabled: updated.ssoEnabled,
      ssoProvider: updated.ssoProvider,
    });
  } catch (error) {
    console.error("Error updating SSO config:", error);
    return NextResponse.json(
      { error: "Failed to update SSO config" },
      { status: 500 }
    );
  }
}



