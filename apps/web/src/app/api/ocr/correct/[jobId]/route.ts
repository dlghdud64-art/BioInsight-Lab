/**
 * §11.290 Phase 4d #ocr-correct-route — POST /api/ocr/correct/[jobId]
 *
 * OcrJob.id 기반 사용자 보정 결과 저장. confidence 낮은 spot 을 사용자가
 * 직접 편집한 결과를 OcrResult 에 새 record 로 INSERT. status SUCCESS 로
 * 전환.
 *
 * 호영님 P1 spec (2026-05-23):
 *   Phase 4c-2 완료 후 Phase 4d 진입. correct endpoint NEW skeleton.
 *
 * Lock:
 *   - auth check + 401
 *   - organizationId 격리 (multi-tenant)
 *   - STORAGE_PROVIDER 미설정 시 503 graceful
 *   - request body: { correctedFields: Partial<LabelParseResult> }
 *
 * Phase 5 실제 wiring placeholder:
 *   1. OcrResult INSERT (provider=manual override, confidence=1.0)
 *   2. OcrJob.finalResultId update (사용자 보정 결과로 swap)
 *   3. OcrJob.status = SUCCESS (NEEDS_REVIEW → SUCCESS)
 *   4. parsedFields 가 InventoryItem / PurchaseOrder prefill 에 활용
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { jobId: string } },
) {
  // (1) auth check
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "인증이 필요합니다." },
      { status: 401 },
    );
  }

  // (2) STORAGE_PROVIDER 미설정 시 503 graceful response
  if (!process.env.STORAGE_PROVIDER) {
    return NextResponse.json(
      {
        error: "OCR 수동 보정은 Vercel env 설정 후 활성됩니다. (Phase 5 진행 중)",
        state: "blocked",
        statusLabel: "보정 제출 차단",
        actionLabel: "수동 보정 제출",
        nextAction: "환경 설정 확인 후 수동 보정을 다시 제출하세요.",
        phase: "Phase 5 SDK install 대기",
      },
      { status: 503 },
    );
  }

  // (3) jobId path + correctedFields body 검증
  const { jobId } = params;
  if (!jobId) {
    return NextResponse.json(
      {
        error: "jobId 가 필요합니다.",
        state: "blocked",
        statusLabel: "대상 없음",
        nextAction: "보정할 OCR 항목을 다시 선택하세요.",
      },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const { correctedFields } = body as {
    correctedFields?: Record<string, unknown>;
  };

  if (!correctedFields || typeof correctedFields !== "object") {
    return NextResponse.json(
      {
        error: "correctedFields body 가 필요합니다.",
        state: "blocked",
        statusLabel: "보정값 없음",
        nextAction: "수정한 필드를 확인한 뒤 다시 제출하세요.",
      },
      { status: 400 },
    );
  }

  // (4) OcrJob lookup + organizationId 격리 (multi-tenant)
  const job = await db.ocrJob.findFirst({
    where: {
      id: jobId,
      organizationId: session.user.id,
    },
  });

  if (!job) {
    return NextResponse.json(
      {
        error: "OCR job 을 찾을 수 없습니다.",
        state: "blocked",
        statusLabel: "대상 없음",
        nextAction: "보정할 OCR 항목을 다시 선택하세요.",
      },
      { status: 404 },
    );
  }

  // (5) Phase 5 실제 wiring placeholder — 현재는 lookup + body 검증만 + 503
  return NextResponse.json(
    {
      error: "수동 보정 저장 wiring 은 Phase 5 SDK install 후 별도 batch 에서 활성됩니다.",
      jobId: job.id,
      currentStatus: job.status,
      receivedFields: Object.keys(correctedFields),
      state: "blocked",
      statusLabel: "보정 제출 차단",
      actionLabel: "수동 보정 제출",
      nextAction: "환경 설정 완료 후 수동 보정을 제출하세요.",
      phase: "Phase 5 SDK install 대기",
    },
    { status: 503 },
  );
}
