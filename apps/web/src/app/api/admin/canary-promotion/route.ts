/**
 * GET  /api/admin/canary-promotion — Promotion Gate 평가 리포트 + Anomaly 분석
 *
 * Query params:
 *   documentType (필수)
 *   from, to — ISO timestamp (기본: 최근 24시간)
 *   includeAnomaly — true이면 Anomaly 분석 포함 (기본 true)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { evaluatePromotionGate } from "@/lib/ai-pipeline/shadow/promotion-gate";
import { analyzeAnomalies } from "@/lib/ai-pipeline/shadow/anomaly-analyzer";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const documentType = searchParams.get("documentType");

    if (!documentType) {
      return NextResponse.json({ error: "documentType 파라미터 필수" }, { status: 400 });
    }

    const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined;
    const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : undefined;
    const includeAnomaly = searchParams.get("includeAnomaly") !== "false";

    const promotionReport = await evaluatePromotionGate({ documentType, from, to });

    let anomalyReport = null;
    if (includeAnomaly) {
      anomalyReport = await analyzeAnomalies({ documentType, from, to });
    }

    // PROMOTE 판정 시 다음 Config 제안
    let suggestedConfig = null;
    if (promotionReport.decision === "PROMOTE") {
      suggestedConfig = {
        envVar: "AI_CANARY_CONFIG",
        value: JSON.stringify({
          docTypes: {
            [documentType]: {
              stage: promotionReport.targetStage,
              allowAutoVerify: false,
            },
          },
        }, null, 2),
        instruction: `AI_CANARY_CONFIG를 위 JSON으로 업데이트하십시오. 또는 POST /api/admin/canary-control { action: "promote", documentType: "${documentType}" }`,
      };
    }

    return NextResponse.json({
      promotion: promotionReport,
      anomaly: anomalyReport,
      suggestedConfig,
    });
  } catch (error) {
    console.error("[CanaryPromotion] Error:", error);
    return NextResponse.json({ error: "Failed to evaluate promotion gate" }, { status: 500 });
  }
}
