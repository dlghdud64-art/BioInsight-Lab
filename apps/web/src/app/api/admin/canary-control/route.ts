/**
 * GET  /api/admin/canary-control — 문서 타입별 카나리 현황 + per-doc-type metrics
 * POST /api/admin/canary-control — Promote / Pause / Rollback 제어
 *
 * POST body:
 *   { action: "promote" | "pause" | "rollback", documentType: string, targetStage?: CanaryStage }
 *
 * 카나리 설정은 AI_CANARY_CONFIG 환경변수(JSON)로 관리.
 * 이 엔드포인트는 현황 조회 + 제어 가이드를 제공하며,
 * 실제 환경변수 변경은 Vercel Dashboard 또는 CI에서 수행.
 */

import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { loadCanaryConfig, validatePromotion } from "@/lib/ai-pipeline/shadow/canary-config";
import { getPerDocTypeMetrics } from "@/lib/ai-pipeline/shadow/canary-metrics";
import { db } from "@/lib/db";
import { CANARY_STAGES } from "@/lib/ai-pipeline/shadow/types";
import type { CanaryStage } from "@/lib/ai-pipeline/shadow/types";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const orgId = searchParams.get("orgId") ?? undefined;
    const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined;
    const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : undefined;

    const canaryConfig = loadCanaryConfig();
    const metrics = await getPerDocTypeMetrics({ orgId, from, to });

    // 최근 Halt 이벤트
    const haltLogs = (await db.$queryRawUnsafe(
      `SELECT "id", "documentType", "previousStage", "haltedToStage", "reason", "triggerCategory", "createdAt"
       FROM "CanaryHaltLog"
       ORDER BY "createdAt" DESC
       LIMIT 20`,
    )) as Record<string, unknown>[];

    return NextResponse.json({
      config: canaryConfig,
      metrics,
      recentHalts: haltLogs,
      promotionGuide: {
        stages: CANARY_STAGES,
        rule: "한 단계씩만 승격 가능 (OFF → SHADOW_ONLY → ACTIVE_5 → ACTIVE_25 → ACTIVE_50 → ACTIVE_100). 강등은 어디서든 OFF/SHADOW_ONLY 가능.",
        envVar: "AI_CANARY_CONFIG",
        example: {
          docTypes: {
            VENDOR_QUOTE: { stage: "ACTIVE_5", allowAutoVerify: false },
            INVOICE: { stage: "SHADOW_ONLY", allowAutoVerify: false },
          },
        },
      },
    });
  } catch (error) {
    console.error("[CanaryControl] Error:", error);
    return NextResponse.json({ error: "Failed to get canary status" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'ai_action',
      targetEntityId: 'unknown',
      sourceSurface: 'admin_dashboard',
      routePath: '/admin/canary-control',
    });
    if (!enforcement.allowed) return enforcement.deny();

        if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, documentType, targetStage } = body as {
      action: string;
      documentType: string;
      targetStage?: string;
    };

    if (!action || !documentType) {
      return NextResponse.json({ error: "action, documentType 필수" }, { status: 400 });
    }

    const canaryConfig = loadCanaryConfig();
    const currentConfig = canaryConfig.docTypes[documentType];
    const currentStage = currentConfig?.stage ?? "OFF";

    let resolvedTarget: CanaryStage;

    switch (action) {
      case "promote": {
        // 현재 단계에서 한 단계 승격
        const currentIdx = CANARY_STAGES.indexOf(currentStage);
        if (currentIdx >= CANARY_STAGES.length - 1) {
          return NextResponse.json({ error: `이미 최고 단계 (${currentStage})` }, { status: 400 });
        }
        resolvedTarget = CANARY_STAGES[currentIdx + 1];
        break;
      }
      case "pause":
        resolvedTarget = "SHADOW_ONLY";
        break;
      case "rollback":
        resolvedTarget = "OFF";
        break;
      default:
        return NextResponse.json({ error: `알 수 없는 action: ${action}` }, { status: 400 });
    }

    // targetStage 명시된 경우 override
    if (targetStage && CANARY_STAGES.includes(targetStage as CanaryStage)) {
      resolvedTarget = targetStage as CanaryStage;
    }

    // 승격 유효성 검증
    const validation = validatePromotion(currentStage, resolvedTarget);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.reason }, { status: 400 });
    }

    // 새 JSON config 생성
    const newDocTypes = { ...canaryConfig.docTypes };
    newDocTypes[documentType] = {
      stage: resolvedTarget,
      allowAutoVerify: currentConfig?.allowAutoVerify ?? false,
    };

    const newConfig = JSON.stringify({ docTypes: newDocTypes }, null, 2);

    return NextResponse.json({
      action,
      documentType,
      currentStage,
      targetStage: resolvedTarget,
      newConfig,
      instruction: `AI_CANARY_CONFIG 환경변수를 아래 JSON으로 업데이트하세요:\n${newConfig}`,
    });
  } catch (error) {
    console.error("[CanaryControl] Error:", error);
    return NextResponse.json({ error: "Failed to process canary control" }, { status: 500 });
  }
}
