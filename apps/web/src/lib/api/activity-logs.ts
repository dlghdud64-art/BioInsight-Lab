import { ActivityType } from "@prisma/client";

/**
 * 액티비티 로그 생성 헬퍼 함수
 */
export async function createActivityLog(params: {
  activityType: ActivityType;
  entityType: string;
  entityId?: string;
  metadata?: any;
  organizationId?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    const response = await fetch("/api/activity-logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      console.error("Failed to create activity log:", await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating activity log:", error);
    return null;
  }
}

/**
 * 서버 사이드에서 직접 액티비티 로그 생성 (API 라우트 내부에서 사용)
 */
export async function createActivityLogServer(params: {
  activityType: ActivityType;
  entityType: string;
  entityId?: string;
  metadata?: any;
  organizationId?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  db: any; // Prisma Client
}) {
  try {
    const { db, ...data } = params;
    
    const activityLog = await db.activityLog.create({
      data: {
        userId: data.userId || null,
        organizationId: data.organizationId || null,
        activityType: data.activityType,
        entityType: data.entityType,
        entityId: data.entityId || null,
        metadata: data.metadata || null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
      },
    });

    return activityLog;
  } catch (error) {
    console.error("Error creating activity log (server):", error);
    return null;
  }
}



