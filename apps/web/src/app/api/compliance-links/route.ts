import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { OrganizationRole } from "@prisma/client";

/**
 * Compliance Links API
 * GET: 링크 목록 조회
 * POST: 새 링크 생성
 */

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const includeDisabled = searchParams.get("includeDisabled") === "true";

    // 공통 링크 (organizationId가 null) + 조직별 링크 조회
    const where: any = {
      OR: [{ organizationId: null }, ...(organizationId ? [{ organizationId }] : [])],
    };

    // 관리자 페이지가 아닌 경우 활성화된 링크만 조회
    if (!includeDisabled) {
      where.enabled = true;
    }

    const links = await db.complianceLink.findMany({
      where,
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({ links });
  } catch (error: any) {
    console.error("Error fetching compliance links:", error);
    return NextResponse.json(
      { error: "Failed to fetch compliance links" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'organization_update',
      targetEntityType: 'ai_action',
      // §enforcement-handle-close-sweep (compliance-links) — 'unknown' 유지.
      //   POST 는 ComplianceLink 를 **생성**하므로 핸들 시점에 대상 id 가 없다
      //   (클래스 ②: 대상 미존재). organizationId 는 범위이지 쓰기 대상이 아니다.
      //   ⚠️ enum 에 compliance_link 타입 부재 → §audit-taxonomy-review.
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/api/compliance-links',
    });
    if (!enforcement.allowed) return enforcement.deny();

    // (죽은 재검사 제거: 같은 POST 핸들러 상단에서 이미 401 처리했다)
    const body = await request.json();
    const {
      organizationId,
      title,
      url,
      description,
      priority = 0,
      enabled = true,
      linkType = "official",
      tags,
      rules,
    } = body;

    // 권한 확인 (admin 또는 safety_admin만 생성 가능)
    if (organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationId,
        },
      });

      const hasAccess =
        session.user.role === "ADMIN" ||
        membership?.role === OrganizationRole.ADMIN ||
        membership?.role === OrganizationRole.VIEWER; // VIEWER = safety_admin

      if (!hasAccess) {
        enforcement.fail();
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      // 공통 링크는 시스템 관리자만 생성 가능
      if (session.user.role !== "ADMIN") {
        enforcement.fail();
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // URL 유효성 검증
    try {
      new URL(url);
    } catch {
      // E6: lock 획득 이후 자체 return 하는 catch — 여기서 안 닫으면 이 실패 경로에서만
      //     lock 이 TTL(5분)까지 남는다.
      enforcement.fail();
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    const link = await db.complianceLink.create({
      data: {
        organizationId: organizationId || null,
        title,
        url,
        description,
        priority,
        enabled,
        linkType,
        tags: tags || null,
        rules: rules || null,
      },
    });

    enforcement.complete({
      beforeState: { organizationId: organizationId || null, existingLinkId: null },
      afterState: {
        organizationId: link.organizationId,
        linkId: link.id,
        url: link.url,
        enabled: link.enabled,
      },
    });

    return NextResponse.json({ link }, { status: 201 });
  } catch (error: any) {
    enforcement?.fail();
    console.error("Error creating compliance link:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create compliance link" },
      { status: 500 }
    );
  }
}

