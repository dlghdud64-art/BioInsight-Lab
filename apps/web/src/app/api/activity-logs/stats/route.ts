import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, isPrismaAvailable } from "@/lib/db";
import { isDemoMode } from "@/lib/env";

// 액티비티 로그 통계 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const period = searchParams.get("period") || "month"; // day, week, month, year

    // 기간 계산
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case "day":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // 필터 조건
    const where: any = {
      createdAt: {
        gte: startDate,
      },
    };

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
        where.userId = session.user.id;
      }
    } else {
      where.userId = session.user.id;
    }

    // 액티비티 타입별 통계
    const activityTypeStats = await db.activityLog.groupBy({
      by: ["activityType"],
      where,
      _count: {
        id: true,
      },
    });

    // 일별 통계 (최근 30일)
    const dailyStats = await db.activityLog.findMany({
      where: {
        ...where,
        createdAt: {
          gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      select: {
        createdAt: true,
        activityType: true,
      },
    });

    // 일별로 그룹화
    const dailyGrouped: Record<string, number> = {};
    dailyStats.forEach((log: { createdAt: Date }) => {
      const date = log.createdAt.toISOString().split("T")[0];
      if (!dailyGrouped[date]) {
        dailyGrouped[date] = 0;
      }
      dailyGrouped[date]++;
    });

    // 엔티티 타입별 통계
    const entityTypeStats = await db.activityLog.groupBy({
      by: ["entityType"],
      where,
      _count: {
        id: true,
      },
    });

    // 총 활동 수
    const totalActivities = await db.activityLog.count({ where });

    // 최근 활동 추이 (시간대별)
    const hourlyStats = await db.activityLog.findMany({
      where: {
        ...where,
        createdAt: {
          gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 최근 7일
        },
      },
      select: {
        createdAt: true,
      },
    });

    // 시간대별로 그룹화
    const hourlyGrouped: Record<number, number> = {};
    hourlyStats.forEach((log: { createdAt: Date }) => {
      const hour = log.createdAt.getHours();
      if (!hourlyGrouped[hour]) {
        hourlyGrouped[hour] = 0;
      }
      hourlyGrouped[hour]++;
    });

    return NextResponse.json({
      total: totalActivities,
      period,
      startDate: startDate.toISOString(),
      activityTypeStats: activityTypeStats.map((stat: { activityType: string; _count: { id: number } }) => ({
        type: stat.activityType,
        count: stat._count.id,
      })),
      entityTypeStats: entityTypeStats.map((stat: { entityType: string; _count: { id: number } }) => ({
        type: stat.entityType,
        count: stat._count.id,
      })),
      dailyStats: Object.entries(dailyGrouped)
        .map(([date, count]) => ({ date, count }))
        .sort((a: any, b: any) => a.date.localeCompare(b.date)),
      hourlyStats: Object.entries(hourlyGrouped)
        .map(([hour, count]) => ({ hour: parseInt(hour), count }))
        .sort((a: any, b: any) => a.hour - b.hour),
    });
  } catch (error) {
    console.error("Error fetching activity log stats:", error);

    if (isDemoMode() || !isPrismaAvailable) {
      return NextResponse.json({
        total: 0,
        period: "month",
        startDate: new Date().toISOString(),
        activityTypeStats: [],
        entityTypeStats: [],
        dailyStats: [],
        hourlyStats: [],
        demo: true,
      });
    }

    return NextResponse.json(
      { error: "Failed to fetch activity log stats" },
      { status: 500 }
    );
  }
}

