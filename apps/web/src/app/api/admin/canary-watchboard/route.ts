/**
 * GET  /api/admin/canary-watchboard — 실시간 카나리 관제 지표
 * GET  /api/admin/canary-watchboard?summary=true — 24h Run Summary
 *
 * Query params:
 *   documentType (필수) — 대상 문서 타입
 *   from, to — ISO timestamp (기본: 최근 1시간)
 *   orgId — 조직 필터 (선택)
 *   summary — true일 경우 Run Summary 반환
 *   periodHours — summary 기간 (기본 24)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWatchboardMetrics, generateCanaryRunSummary } from "@/lib/ai-pipeline/shadow/watchboard";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const documentType = searchParams.get("documentType");

    if (!documentType) {
      return NextResponse.json({ error: "documentType 파라미터 필수" }, { status: 400 });
    }

    // Summary 모드
    if (searchParams.get("summary") === "true") {
      const periodHours = searchParams.get("periodHours")
        ? parseInt(searchParams.get("periodHours")!, 10)
        : 24;

      const summary = await generateCanaryRunSummary(documentType, periodHours);
      return NextResponse.json(summary);
    }

    // 실시간 Watchboard 모드
    const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined;
    const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : undefined;
    const orgId = searchParams.get("orgId") ?? undefined;

    const metrics = await getWatchboardMetrics({ documentType, from, to, orgId });
    return NextResponse.json(metrics);
  } catch (error) {
    console.error("[CanaryWatchboard] Error:", error);
    return NextResponse.json({ error: "Failed to get watchboard metrics" }, { status: 500 });
  }
}
