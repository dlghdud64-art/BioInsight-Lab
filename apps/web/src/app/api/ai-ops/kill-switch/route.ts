/**
 * POST /api/ai-ops/kill-switch
 * AI kill switch 발동/해제
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  activateKillSwitch,
  deactivateKillSwitch,
} from "@/lib/ai-pipeline/runtime/doctype-rollout";
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
      activate?: boolean;
      reason?: string;
    };

    if (body.activate === undefined || !body.reason) {
      return NextResponse.json(
        { error: "activate (boolean) and reason are required" },
        { status: 400 }
      );
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'ai_ops_control',
      targetEntityType: 'ai_action',
      targetEntityId: body.documentType || 'global',
      sourceSurface: 'ai-ops-kill-switch-api',
      routePath: '/api/ai-ops/kill-switch',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const userId = session.user.id;

    if (body.activate) {
      await activateKillSwitch(
        body.documentType ?? null,
        userId,
        body.reason
      );
      enforcement.complete({});
      return NextResponse.json({
        success: true,
        message: body.documentType
          ? `Kill switch activated for ${body.documentType}`
          : "Global kill switch activated",
      });
    } else {
      if (!body.documentType) {
        return NextResponse.json(
          { error: "documentType required to deactivate kill switch" },
          { status: 400 }
        );
      }
      await deactivateKillSwitch(body.documentType, userId, body.reason);
      enforcement.complete({});
      return NextResponse.json({
        success: true,
        message: `Kill switch deactivated for ${body.documentType} — restored to SHADOW`,
      });
    }
  } catch (error: unknown) {
    enforcement?.fail();
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
