/**
 * POST /api/ai-ops/auto-verify
 * docType별 auto-verify 토글
 */

import { NextRequest, NextResponse } from "next/server";
import { toggleAutoVerify } from "@/lib/ai-pipeline/runtime/auto-verify";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
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

    const userId = request.headers.get("x-user-id") || "system";

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

    return NextResponse.json({
      success: true,
      message: `Auto-verify ${body.enabled ? "enabled" : "disabled"} for ${body.documentType}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
