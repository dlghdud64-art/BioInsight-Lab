import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { runOcrPipeline } from "@/lib/ocr/run-ocr-pipeline";
import {
  coaFieldsFromLabel,
  extractCoaFields,
  matchCoaToLines,
  type CoaFields,
} from "@/lib/ocr/coa-recognize";

/**
 * §scan-recognition-upgrade P1 — POST /api/receiving-drafts/[id]/coa-recognize
 *
 * COA 이미지 → 추출·라인 대조 결과만 돌려준다. **canonical 저장 0.**
 *   · 여기서 일어나는 쓰기는 runOcrPipeline 내부의 OcrJob/OcrResult 감사 로그뿐.
 *   · draft·item·재고에 대한 쓰기 경로 없음 — 확정은 inspect PATCH(사람 클릭) 단일 경로.
 *   · 원본 파일 자체는 클라이언트가 기존 /api/receiving/documents/[orderId] 로 별도
 *     첨부한다(경로 재사용) — 이 API 는 문서 저장도 하지 않는다.
 *   · 인식 실패 필드 = null (빈값 폴백 — 지어내지 않는다).
 *
 * scope: inspect 라우트와 동일 — 본인 소유 OR 소속 조직, PENDING_REVIEW 만.
 */

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const { id } = await params;

    const draft = await db.receivingDraft.findUnique({
      where: { id },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });
    if (!draft) {
      return NextResponse.json({ error: "입고안을 찾을 수 없습니다." }, { status: 404 });
    }

    const isOwner = draft.userId === userId;
    let isOrgMember = false;
    if (!isOwner && draft.organizationId) {
      const member = await db.organizationMember.findFirst({
        where: { userId, organizationId: draft.organizationId },
        select: { id: true },
      });
      isOrgMember = !!member;
    }
    if (!isOwner && !isOrgMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (draft.status !== "PENDING_REVIEW") {
      return NextResponse.json(
        { error: "검토 대기 상태의 입고안만 인식할 수 있습니다.", status: draft.status },
        { status: 409 },
      );
    }

    const body = (await request.json()) as { imageBase64?: string };
    if (!body?.imageBase64 || typeof body.imageBase64 !== "string") {
      return NextResponse.json(
        { error: "이미지가 필요합니다.", code: "IMAGE_REQUIRED" },
        { status: 400 },
      );
    }

    // 기존 라벨 파이프라인 재사용(3-tier + 캐시 + OcrJob/OcrResult 감사) — 신규 파서 0.
    const pipeline = await runOcrPipeline({
      base64: body.imageBase64,
      type: "LABEL",
      organizationId: draft.organizationId ?? userId,
      userId,
    });

    // 필드 사영 + rawText 앵커 보충(파이프라인이 놓친 필드만 — 값 덮어쓰기 0).
    const fromLabel = coaFieldsFromLabel(pipeline.result);
    const fromRaw: CoaFields | null = pipeline.result.rawText
      ? extractCoaFields(pipeline.result.rawText)
      : null;
    const fields: CoaFields = {
      lot: fromLabel.lot ?? fromRaw?.lot ?? null,
      expiry: fromLabel.expiry ?? fromRaw?.expiry ?? null,
      catalogNo: fromLabel.catalogNo ?? fromRaw?.catalogNo ?? null,
      productName: fromRaw?.productName ?? fromLabel.productName ?? null,
    };

    const perLine = matchCoaToLines(
      fields,
      draft.items.map((it: { id: string; name: string }) => ({ id: it.id, name: it.name })),
    );

    return NextResponse.json({
      jobId: pipeline.jobId,
      fields,
      confidence: pipeline.result.confidence,
      perLine,
    });
  } catch (error) {
    return handleApiError(error, "receiving-drafts/coa-recognize/POST");
  }
}
