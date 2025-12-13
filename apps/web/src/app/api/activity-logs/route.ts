import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, isPrismaAvailable } from "@/lib/db";
import { isDemoMode } from "@/lib/env";

// 액티비티 로그 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    
    const activityType = searchParams.get("activityType");
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    const organizationId = searchParams.get("organizationId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // 필터 조건 구성
    const where: any = {};
    
    if (session?.user?.id) {
      // 사용자별 필터링 (본인 또는 조직 멤버인 경우)
      if (organizationId) {
        // 조직 멤버 확인
        const isMember = await db.organizationMember.findFirst({
          where: {
            userId: session.user.id,
            organizationId,
          },
        });
        
        if (isMember) {
          where.organizationId = organizationId;
        } else {
          // 본인 활동만 조회
          where.userId = session.user.id;
        }
      } else {
        // 본인 활동만 조회
        where.userId = session.user.id;
      }
    } else {
      // 비로그인 사용자는 조회 불가
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (activityType) {
      where.activityType = activityType;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    // 액티비티 로그 조회
    const [logs, total] = await Promise.all([
      db.activityLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
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
        take: limit,
        skip: offset,
      }),
      db.activityLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    
    // 데모 모드에서는 더미 응답 반환
    if (isDemoMode() || !isPrismaAvailable) {
      return NextResponse.json({
        logs: [],
        total: 0,
        limit: 50,
        offset: 0,
        demo: true,
      });
    }
    
    return NextResponse.json(
      { error: "Failed to fetch activity logs" },
      { status: 500 }
    );
  }
}

// 액티비티 로그 생성 (내부용, 직접 호출하지 않음)
export async function POST(request: NextRequest) {
  let body: any = null;
  try {
    const session = await auth();
    body = await request.json();
    const {
      activityType,
      entityType,
      entityId,
      metadata,
      organizationId,
    } = body;

    if (!activityType || !entityType) {
      return NextResponse.json(
        { error: "activityType and entityType are required" },
        { status: 400 }
      );
    }

    // IP 주소 및 User Agent 추출
    const ipAddress = request.headers.get("x-forwarded-for") || 
                     request.headers.get("x-real-ip") || 
                     null;
    const userAgent = request.headers.get("user-agent") || null;

    // 액티비티 로그 생성
    // organizationId가 제공되지 않은 경우, 사용자의 첫 번째 조직을 찾기
    let finalOrganizationId = organizationId || null;
    if (!finalOrganizationId && session?.user?.id) {
      const userOrg = await db.organizationMember.findFirst({
        where: { userId: session.user.id },
        select: { organizationId: true },
      });
      finalOrganizationId = userOrg?.organizationId || null;
    }

    const activityLog = await db.activityLog.create({
      data: {
        userId: session?.user?.id || null,
        organizationId: finalOrganizationId,
        activityType,
        entityType,
        entityId: entityId || null,
        metadata: metadata || null,
        ipAddress,
        userAgent,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(activityLog, { status: 201 });
  } catch (error) {
    console.error("Error creating activity log:", error);
    
    // 데모 모드에서는 더미 응답 반환
    if (isDemoMode() || !isPrismaAvailable) {
      return NextResponse.json({
        id: `demo-${Date.now()}`,
        activityType: body.activityType,
        entityType: body.entityType,
        demo: true,
      }, { status: 201 });
    }
    
    return NextResponse.json(
      { error: "Failed to create activity log" },
      { status: 500 }
    );
  }
}



