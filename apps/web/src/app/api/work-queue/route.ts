import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
import { queryWorkQueue } from "@/lib/work-queue";
import { queryWorkQueueGrouped, queryAccountabilityData } from "@/lib/work-queue/work-queue-service";
import { computeAccountabilityMetrics, evaluateEscalations, filterForPersonalView } from "@/lib/work-queue/console-accountability";
import type { TaskStatus } from "@/lib/work-queue";
import type { PersonalWorkloadViewId } from "@/lib/work-queue/console-accountability";

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
    const grouped = searchParams.get("grouped") === "true";

    // 최근 24시간 완료 항목만 포함
    const completedSince = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const taskStatus = taskStatusParam
      ? (taskStatusParam.split(",") as TaskStatus[])
      : undefined;

    // Accountability mode — 메트릭 + 에스컬레이션 반환
    const accountability = searchParams.get("accountability") === "true";
    const personalView = searchParams.get("personalView") as PersonalWorkloadViewId | null;

    // Grouped mode — 콘솔용
    if (grouped) {
      const view = (searchParams.get("view") || "all") as import("@/lib/work-queue/console-assignment").ConsoleView;
      const result = await queryWorkQueueGrouped({
        userId: session.user.id,
        organizationId,
        limit: limit || 100,
        view,
        viewUserId: session.user.id,
      });

      // Enrich with accountability data if requested
      if (accountability) {
        const accData = await queryAccountabilityData({ organizationId });
        const metrics = computeAccountabilityMetrics(accData.items, accData.logs);
        const escalations = evaluateEscalations(accData.items, accData.logs);
        return NextResponse.json({ ...result, accountability: metrics, escalations });
      }

      return NextResponse.json(result);
    }

    // Personal workload view mode
    if (personalView) {
      const accData = await queryAccountabilityData({ organizationId });
      const escalations = evaluateEscalations(accData.items, accData.logs);
      const filtered = filterForPersonalView(accData.items, personalView, session.user.id, escalations);
      return NextResponse.json({ items: filtered, escalations });
    }

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
