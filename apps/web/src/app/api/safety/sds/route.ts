import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { OrganizationRole } from "@prisma/client";

// SDS 문서 목록 조회 (안전 관리자용)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    // 권한 확인: safety_admin 또는 admin
    if (organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationId,
          role: {
            in: [OrganizationRole.ADMIN, OrganizationRole.VIEWER], // VIEWER = safety_admin
          },
        },
      });

      if (!membership && session.user.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Forbidden: safety_admin or admin role required" },
          { status: 403 }
        );
      }
    }

    // SDS 문서 조회
    const where: any = {};
    if (organizationId) {
      where.OR = [
        { organizationId },
        { organizationId: null }, // 공용 문서도 포함
      ];
    }

    const documents = await db.sDSDocument.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            catalogNumber: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ documents });
  } catch (error: any) {
    console.error("Error fetching SDS documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch SDS documents" },
      { status: 500 }
    );
  }
}






