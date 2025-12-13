import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { testSSOConnection, validateSSOProviderConfig } from "@/lib/auth/sso-providers";
import { hasPermission } from "@/lib/permissions/permission-checker";

/**
 * SSO 연결 테스트 API
 */
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
    const { ssoConfig } = body;

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
    const validation = validateSSOProviderConfig(ssoConfig);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Invalid SSO configuration", errors: validation.errors },
        { status: 400 }
      );
    }

    // SSO 연결 테스트
    const testResult = await testSSOConnection(ssoConfig);

    return NextResponse.json(testResult);
  } catch (error: any) {
    console.error("Error testing SSO connection:", error);
    return NextResponse.json(
      { error: "Failed to test SSO connection", message: error.message },
      { status: 500 }
    );
  }
}

