import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuditLogs } from "@/lib/audit/audit-logger";
import { db, isPrismaAvailable } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import { AuditEventType } from "@prisma/client";

/**
 * 감사 로그 조회 API
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const userId = searchParams.get("userId");
    const eventType = searchParams.get("eventType") as AuditEventType | null;
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    // 권한 확인: 조직 관리자 또는 시스템 관리자만 조회 가능
    if (organizationId) {
      const isOrgAdmin = await db.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationId,
          role: "ADMIN",
        },
      });

      if (!isOrgAdmin && session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (session.user.role !== "ADMIN") {
      // 조직 ID가 없으면 시스템 관리자만 조회 가능
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await getAuditLogs({
      organizationId: organizationId || undefined,
      userId: userId || undefined,
      eventType: eventType || undefined,
      entityType: entityType || undefined,
      entityId: entityId || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      search: search || undefined,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    
    // 데모 모드에서는 더미 응답 반환
    if (isDemoMode() || !isPrismaAvailable) {
      return NextResponse.json({
        logs: [],
        total: 0,
        limit: 100,
        offset: 0,
        demo: true,
      });
    }
    
    return NextResponse.json(
      { error: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}



