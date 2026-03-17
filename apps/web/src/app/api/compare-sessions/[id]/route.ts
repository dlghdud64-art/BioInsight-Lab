/**
 * GET /api/compare-sessions/[id] — 비교 세션 조회 (linked outcomes 포함)
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createActivityLog } from "@/lib/activity-log";
import { handleApiError } from "@/lib/api-error-handler";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    const userId = session?.user?.id ?? null;

    const compareSession = await db.compareSession.findUnique({
      where: { id },
      include: {
        inquiryDrafts: {
          select: {
            id: true,
            vendorName: true,
            productName: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!compareSession) {
      return NextResponse.json(
        { error: "비교 세션을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 연결된 견적 조회 (Quote.comparisonId → compareSession.id)
    const linkedQuotes = await db.quote.findMany({
      where: { comparisonId: id },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // 최근 활동 시점 계산
    const timestamps = [
      compareSession.createdAt,
      compareSession.updatedAt,
      ...compareSession.inquiryDrafts.map((d: { updatedAt: Date }) => d.updatedAt),
      ...linkedQuotes.map((q: { createdAt: Date }) => q.createdAt),
    ];
    const latestActionAt = new Date(
      Math.max(...timestamps.map((t: Date) => t.getTime()))
    ).toISOString();

    // Activity log: 비교 결과 조회
    await createActivityLog({
      activityType: "COMPARE_RESULT_VIEWED",
      entityType: "COMPARE_SESSION",
      entityId: id,
      userId,
      organizationId: compareSession.organizationId,
    });

    return NextResponse.json({
      session: compareSession,
      linkedQuotes,
      inquiryDrafts: compareSession.inquiryDrafts,
      latestActionAt,
    });
  } catch (error) {
    return handleApiError(error, "GET /api/compare-sessions/[id]");
  }
}
