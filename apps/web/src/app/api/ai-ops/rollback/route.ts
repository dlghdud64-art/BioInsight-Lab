/**
 * POST /api/ai-ops/rollback
 * docType을 이전 stage로 강등
 */

import { NextRequest, NextResponse } from "next/server";
import { rollbackStage } from "@/lib/ai-pipeline/runtime/doctype-rollout";

export async function POST(request: NextRequest) {
  try {
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

    const userId = request.headers.get("x-user-id") || "system";
    const updated = await rollbackStage(
      body.documentType,
      userId,
      body.reason,
      body.toShadow ?? false
    );

    return NextResponse.json({
      success: true,
      config: updated,
      message: `${body.documentType} rolled back to ${updated.stage}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
