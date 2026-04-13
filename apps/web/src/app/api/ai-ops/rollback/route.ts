/**
 * POST /api/ai-ops/rollback
 * docType을 이전 stage로 강등
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { rollbackStage } from "@/lib/ai-pipeline/runtime/doctype-rollout";
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
      toShadow?: boolean;
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
      sourceSurface: 'ai-ops-rollback-api',
      routePath: '/api/ai-ops/rollback',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const userId = session.user.id;
    const updated = await rollbackStage(
      body.documentType,
      userId,
      body.reason,
      body.toShadow ?? false
    );

    enforcement.complete({});

    return NextResponse.json({
      success: true,
      config: updated,
      message: `${body.documentType} rolled back to ${updated.stage}`,
    });
  } catch (error: unknown) {
    enforcement?.fail();
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
