/**
 * GET /api/ai-ops/status
 * 전체 docType별 canary 현황 조회
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { CanaryConfig } from "@prisma/client";

export async function GET() {
  try {
    const configs: CanaryConfig[] = await db.canaryConfig.findMany({
      orderBy: { documentType: "asc" },
    });

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h

    const summaries = await Promise.all(
      configs.map(async (config: CanaryConfig) => {
        const logs = await db.aiProcessingLog.findMany({
          where: { documentType: config.documentType, createdAt: { gte: since } },
          select: {
            processingPath: true,
            confidence: true,
            fallbackReason: true,
          },
        });

        type LogRow = (typeof logs)[number];
        const total = logs.length;
        const aiCount = logs.filter((l: LogRow) => l.processingPath === "AI").length;
        const fallbackCount = logs.filter((l: LogRow) => l.processingPath === "FALLBACK").length;
        const shadowCount = logs.filter((l: LogRow) => l.processingPath === "SHADOW").length;
        const confidences = logs
          .map((l: LogRow) => l.confidence)
          .filter((c: number | null): c is number => c !== null);

        return {
          ...config,
          stats24h: {
            total,
            aiCount,
            fallbackCount,
            shadowCount,
            avgConfidence:
              confidences.length > 0
                ? Math.round((confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length) * 1000) / 1000
                : null,
            fallbackRate: total > 0 ? Math.round((fallbackCount / total) * 1000) / 1000 : 0,
          },
        };
      })
    );

    const globalKillSwitch = configs.every((c: CanaryConfig) => c.killSwitchActive);

    return NextResponse.json({
      configs: summaries,
      globalKillSwitch: configs.length > 0 && globalKillSwitch,
      totalDocTypes: configs.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
