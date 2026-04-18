/**
 * POST /api/ai-ops/hold
 * 현재 stage 유지 결정 기록
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { holdStage } from "@/lib/ai-pipeline/runtime/doctype-rollout";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = (await request.json()) as {
      documentType?: string;
      reason?: string;
    };

    if (!body.documentType || !body.reason) {
      return NextResponse.json(
        { error: "documentType and reason are required" },
        { status: 400 }
      );
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'ai_ops_control',
      targetEntityType: 'ai_action',
      targetEntityId: body.documentType || 'unknown',
      sourceSurface: 'ai-ops-hold-api',
      routePath: '/api/ai-ops/hold',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const userId = session.user.id;
    await holdStage(body.documentType, userId, body.reason);

    enforcement.complete({});

    return NextResponse.json({
      success: true,
      message: `${body.documentType} stage held`,
    });
  } catch (error: unknown) {
    enforcement?.fail();
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
