/**
 * POST /api/ai-ops/promote
 * docType을 다음 canary stage로 승격
 */

import { NextRequest, NextResponse } from "next/server";
import { promoteStage, ensureCanaryConfig } from "@/lib/ai-pipeline/runtime/doctype-rollout";
import { canPromote, validateConstraints } from "@/lib/ai-pipeline/runtime/rollout-config";
import { db } from "@/lib/db";

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
    const { documentType, reason } = body;

    // 제약 조건 확인
    const allConfigs = await db.canaryConfig.findMany();
    await ensureCanaryConfig(documentType, userId);
    const updatedConfigs = await db.canaryConfig.findMany();

    const promoteCheck = canPromote(documentType, updatedConfigs);
    if (!promoteCheck.allowed) {
      return NextResponse.json(
        { error: promoteCheck.reason },
        { status: 409 }
      );
    }

    const constraintCheck = validateConstraints(updatedConfigs);
    if (!constraintCheck.valid) {
      return NextResponse.json(
        { error: "Constraint violations", violations: constraintCheck.violations },
        { status: 409 }
      );
    }

    const updated = await promoteStage(documentType, userId, reason);

    return NextResponse.json({
      success: true,
      config: updated,
      message: `${documentType} promoted to ${updated.stage}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
