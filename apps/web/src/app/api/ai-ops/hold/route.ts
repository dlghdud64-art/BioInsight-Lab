/**
 * POST /api/ai-ops/hold
 * 현재 stage 유지 결정 기록
 */

import { NextRequest, NextResponse } from "next/server";
import { holdStage } from "@/lib/ai-pipeline/runtime/doctype-rollout";

export async function POST(request: NextRequest) {
  try {
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

    const userId = request.headers.get("x-user-id") || "system";
    await holdStage(body.documentType, userId, body.reason);

    return NextResponse.json({
      success: true,
      message: `${body.documentType} stage held`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
