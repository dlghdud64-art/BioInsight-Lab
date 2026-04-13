/**
 * POST /api/ai-ops/auto-verify
 * docType별 auto-verify 토글
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { toggleAutoVerify } from "@/lib/ai-pipeline/runtime/auto-verify";
import { db } from "@/lib/db";
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
      enabled?: boolean;
      reason?: string;
    };

    if (!body.documentType || body.enabled === undefined || !body.reason) {
      return NextResponse.json(
        { error: "documentType, enabled (boolean), and reason are required" },
        { status: 400 }
      );
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'ai_ops_control',
      targetEntityType: 'ai_action',
      targetEntityId: body.documentType || 'unknown',
      sourceSurface: 'ai-ops-auto-verify-api',
      routePath: '/api/ai-ops/auto-verify',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const userId = session.user.id;

    // Config 존재 확인
    const config = await db.canaryConfig.findUnique({
      where: { documentType: body.documentType },
    });

    if (!config) {
      return NextResponse.json(
        { error: `No CanaryConfig found for ${body.documentType}` },
        { status: 404 }
      );
    }

    // 현재는 QUOTE에서만 허용
    if (body.enabled && body.documentType !== "QUOTE") {
      return NextResponse.json(
        { error: "Auto-verify is currently restricted to QUOTE only" },
        { status: 409 }
      );
    }

    await toggleAutoVerify(
      body.documentType,
      body.enabled,
      userId,
      body.reason
    );

    enforcement.complete({});

    return NextResponse.json({
      success: true,
      message: `Auto-verify ${body.enabled ? "enabled" : "disabled"} for ${body.documentType}`,
    });
  } catch (error: unknown) {
    enforcement?.fail();
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
