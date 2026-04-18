/**
 * GET /api/admin/shadow-report
 *
 * Shadow 모드 비교 리포트 조회.
 * Query params: from, to, orgId (all optional)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateShadowReport } from "@/lib/ai-pipeline/shadow/report-aggregator";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from")
      ? new Date(searchParams.get("from")!)
      : undefined;
    const to = searchParams.get("to")
      ? new Date(searchParams.get("to")!)
      : undefined;
    const orgId = searchParams.get("orgId") ?? undefined;

    const report = await generateShadowReport({ orgId, from, to });

    return NextResponse.json({ report });
  } catch (error) {
    console.error("[ShadowReport] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate shadow report" },
      { status: 500 },
    );
  }
}
