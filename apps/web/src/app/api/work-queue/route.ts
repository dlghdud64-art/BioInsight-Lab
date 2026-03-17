import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { queryWorkQueue } from "@/lib/work-queue";
import type { TaskStatus } from "@/lib/work-queue";

/**
 * GET /api/work-queue — 대시보드 통합 AI 작업함 조회
 *
 * Query params:
 *   - taskStatus: 쉼표 구분 필터 (e.g. "ACTION_NEEDED,REVIEW_NEEDED")
 *   - limit: 최대 항목 수 (기본 20)
 *   - includeCompleted: "true"면 최근 완료 항목 포함
 *
 * 정렬: FAILED → BLOCKED → ACTION_NEEDED → REVIEW_NEEDED → WAITING_RESPONSE → IN_PROGRESS
 * (동일 상태 내: priority DESC → updatedAt DESC)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const taskStatusParam = searchParams.get("taskStatus");
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const includeCompleted = searchParams.get("includeCompleted") === "true";
    const organizationId = searchParams.get("organizationId") || undefined;
    const entityType = searchParams.get("entityType") || undefined;
    const entityId = searchParams.get("entityId") || undefined;

    // 최근 24시간 완료 항목만 포함
    const completedSince = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const taskStatus = taskStatusParam
      ? (taskStatusParam.split(",") as TaskStatus[])
      : undefined;

    const result = await queryWorkQueue({
      userId: session.user.id,
      organizationId,
      taskStatus,
      limit,
      includeCompleted: entityType ? true : includeCompleted,
      completedSince: entityType ? undefined : completedSince,
      relatedEntityType: entityType,
      relatedEntityId: entityId,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[WorkQueue] Query failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch work queue" },
      { status: 500 }
    );
  }
}
