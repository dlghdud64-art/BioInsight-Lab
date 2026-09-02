import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, isPrismaAvailable } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import { resolveOrganizationIdForMutation } from "@/lib/organizations/active-org";

// 액티비티 로그 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    
    const activityType = searchParams.get("activityType");
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");
    const organizationId = searchParams.get("organizationId");
    const taskType = searchParams.get("taskType");
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

    if (taskType) {
      where.taskType = taskType;
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
  let enforcement: InlineEnforcementHandle | undefined;
  let body: any = {};
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'ai_action',
      // §enforcement-handle-close-sweep (기타) — 'unknown' 유지.
      //   생성 대상 ActivityLog 는 핸들 이후에 만들어진다(클래스 ②).
      //   body 의 entityId 는 로그가 *가리키는* 대상이지 쓰기 대상이 아니다.
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/api/activity-logs',
    });
    if (!enforcement.allowed) return enforcement.deny();

    body = await request.json();
    const {
      activityType,
      entityType,
      entityId,
      metadata,
      organizationId,
    } = body;

    if (!activityType || !entityType) {
      enforcement.fail();
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

    /* §invite-flow Phase 2-5 — 로그가 붙을 조직은 **요청이 명시한 조직**을 우선한다.
     * 쓰기라 관대한 resolver 를 쓰지 않는다: 명시했는데 멤버십이 없으면 조용히 활성 조직에
     * 기록하지 않고 403 이다(다른 조직의 감사 기록이 되는 것을 막는다).
     * 명시가 없으면 활성 조직, 조직이 0 이면 **null 유지** — 기존 동작 그대로다
     * (ActivityLog.organizationId 는 nullable 이고 개인 활동 로그가 정당하다).
     *
     * 🛑 세션 분기(`if (session?.user?.id)`)를 두지 않는다. 위 401 가드로 이미 보장되고,
     *    분기를 두면 그 else 가 **body organizationId 를 무검증으로 채택**하는 형태가 된다 —
     *    지금은 도달 불가지만 401 가드가 느슨해지는 순간 방금 닫은 구멍이 조용히 다시 열린다
     *    (Cowork QA 지적 2026-09-02). 죽은 분기가 우회로를 품고 있으면 그건 시한폭탄이다. */
    const orgResolution = await resolveOrganizationIdForMutation({
      userId: session.user.id,
      hint: typeof organizationId === "string" ? organizationId : null,
    });
    if (!orgResolution.ok && orgResolution.reason === "hint_forbidden") {
      enforcement.fail();
      return NextResponse.json(
        { error: "요청한 조직에 대한 권한이 없습니다." },
        { status: 403 },
      );
    }
    const finalOrganizationId: string | null = orgResolution.ok
      ? orgResolution.organizationId
      : null;

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

    enforcement.complete({
      beforeState: { activityLogId: null },
      afterState: {
        activityLogId: activityLog.id,
        activityType,
        entityType,
        entityId: entityId || null,
      },
    });

    return NextResponse.json(activityLog, { status: 201 });
  } catch (error) {
    // 데모 모드 분기도 이 catch 안에서 return 하므로 최상단에서 한 번만 닫는다.
    enforcement?.fail();
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



