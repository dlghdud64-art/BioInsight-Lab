/**
 * POST /api/ai-ops/kill-switch
 * AI kill switch 발동/해제
 */

import { NextRequest, NextResponse } from "next/server";
import {
  activateKillSwitch,
  deactivateKillSwitch,
} from "@/lib/ai-pipeline/runtime/doctype-rollout";

export async function POST(request: NextRequest) {
  try {
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

    const userId = request.headers.get("x-user-id") || "system";

    if (body.activate) {
      await activateKillSwitch(
        body.documentType ?? null,
        userId,
        body.reason
      );
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
      return NextResponse.json({
        success: true,
        message: `Kill switch deactivated for ${body.documentType} — restored to SHADOW`,
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
