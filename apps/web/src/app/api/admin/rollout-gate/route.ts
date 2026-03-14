/**
 * GET /api/admin/rollout-gate
 *
 * Go/No-Go 게이트 판정 + Active Rollout 후보 문서 타입 조회.
 * Query params: from, to, orgId (all optional)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { evaluateRolloutGate } from "@/lib/ai-pipeline/shadow/rollout-gate";

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

    const result = await evaluateRolloutGate({ orgId, from, to });

    return NextResponse.json({ gate: result });
  } catch (error) {
    console.error("[RolloutGate] Error:", error);
    return NextResponse.json(
      { error: "Failed to evaluate rollout gate" },
      { status: 500 },
    );
  }
}
