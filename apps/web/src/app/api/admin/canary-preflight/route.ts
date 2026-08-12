/**
 * GET /api/admin/canary-preflight — Launch Preflight Check
 *
 * Query params:
 *   documentType (필수) — Preflight 대상 문서 타입
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { runPreflightCheck } from "@/lib/ai-pipeline/shadow/preflight";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const documentType = request.nextUrl.searchParams.get("documentType");
    if (!documentType) {
      return NextResponse.json({ error: "documentType 파라미터 필수" }, { status: 400 });
    }

    const result = await runPreflightCheck(documentType);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[CanaryPreflight] Error:", error);
    return NextResponse.json({ error: "Preflight check failed" }, { status: 500 });
  }
}
