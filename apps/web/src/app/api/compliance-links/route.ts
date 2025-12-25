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
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      // 공통 링크는 시스템 관리자만 생성 가능
      if (session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // URL 유효성 검증
    try {
      new URL(url);
    } catch {
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

    return NextResponse.json({ link }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating compliance link:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create compliance link" },
      { status: 500 }
    );
  }
}

