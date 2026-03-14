/**
 * POST /api/ingestion — Package A 파이프라인 진입점
 *
 * source_type: EMAIL | ATTACHMENT | UPLOAD | SYSTEM
 * 멱등성: source_ref가 동일하면 기존 IngestionEntry 반환
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ShadowRuntimeGateway } from "@/lib/ai-pipeline/shadow";
import type { IngestionInput } from "@/lib/ai-pipeline/types";

const gateway = new ShadowRuntimeGateway();

export async function POST(request: NextRequest) {
  try {
    // 1. 인증
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. 요청 파싱
    const body = await request.json();
    const {
      sourceType,
      sourceRef,
      filename,
      mimeType,
      rawText,
      metadata,
    } = body;

    // Validation
    if (!sourceType || !["EMAIL", "ATTACHMENT", "UPLOAD", "SYSTEM"].includes(sourceType)) {
      return NextResponse.json(
        { error: "sourceType 필수 (EMAIL | ATTACHMENT | UPLOAD | SYSTEM)" },
        { status: 400 },
      );
    }
    if (!rawText || typeof rawText !== "string" || rawText.trim().length === 0) {
      return NextResponse.json({ error: "rawText 필수 (비어있을 수 없음)" }, { status: 400 });
    }

    // 3. 사용자/조직 조회
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        organizationMembers: {
          take: 1,
          include: { organization: { select: { id: true } } },
        },
      },
    });
    const organizationId = user?.organizationMembers?.[0]?.organization?.id;
    if (!organizationId) {
      return NextResponse.json({ error: "조직 정보를 찾을 수 없습니다" }, { status: 403 });
    }

    // 4. 멱등성: sourceRef 기준 중복 체크
    if (sourceRef) {
      const existing = await db.ingestionEntry.findFirst({
        where: { organizationId, sourceRef },
        select: { id: true, documentType: true, verificationStatus: true, workQueueTaskId: true },
      });
      if (existing) {
        return NextResponse.json(
          {
            ingestionEntryId: existing.id,
            status: "already_processed",
            documentType: existing.documentType,
            verificationStatus: existing.verificationStatus,
            workQueueTaskId: existing.workQueueTaskId,
          },
          { status: 200 },
        );
      }
    }

    // 5. 파이프라인 실행
    const input: IngestionInput = {
      organizationId,
      sourceType,
      sourceRef,
      filename,
      mimeType,
      rawText,
      uploaderId: session.user.id,
      metadata,
    };

    const result = await gateway.execute(input);

    // 6. 응답
    const statusCode = result.failedStage ? 207 : 201;
    return NextResponse.json(
      {
        ingestionEntryId: result.ingestionEntryId,
        completedStages: result.completedStages,
        failedStage: result.failedStage ?? null,
        error: result.error ?? null,
        summary: result.summary,
        totalDurationMs: result.totalDurationMs,
      },
      { status: statusCode },
    );
  } catch (error: unknown) {
    console.error("[Ingestion API] Unhandled error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
