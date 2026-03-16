/**
 * POST /api/compare-sessions/[id]/inquiry-draft — 공급사 문의 초안 생성 + 영속
 * GET  /api/compare-sessions/[id]/inquiry-draft — 저장된 초안 목록 조회
 * PATCH /api/compare-sessions/[id]/inquiry-draft — 초안 상태 업데이트
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { generateVendorInquiryDraft } from "@/lib/compare-workspace/vendor-inquiry-draft";
import { createActivityLog } from "@/lib/activity-log";
import { handleApiError } from "@/lib/api-error-handler";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    const userId = session?.user?.id ?? null;

    const body = await request.json();
    const {
      sourceProductName,
      targetProductName,
      vendorName,
      vendorEmail,
      diffIndex,
    } = body;

    if (!vendorName) {
      return NextResponse.json(
        { error: "공급사 이름이 필요합니다." },
        { status: 400 }
      );
    }

    const compareSession = await db.compareSession.findUnique({
      where: { id },
    });

    if (!compareSession) {
      return NextResponse.json(
        { error: "비교 세션을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const diffResults = compareSession.diffResult as any[];
    if (!diffResults || !Array.isArray(diffResults)) {
      return NextResponse.json(
        { error: "비교 결과가 없습니다." },
        { status: 400 }
      );
    }

    const idx = diffIndex ?? 0;
    const diffResult = diffResults[idx];
    if (!diffResult) {
      return NextResponse.json(
        { error: "해당 비교 결과를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const generated = await generateVendorInquiryDraft({
      diffResult,
      sourceProductName: sourceProductName || "기준 제품",
      targetProductName: targetProductName || "비교 대상",
      vendorName,
      vendorEmail,
    });

    // 초안 영속화
    const draft = await db.compareInquiryDraft.create({
      data: {
        compareSessionId: id,
        vendorName,
        vendorEmail: vendorEmail ?? null,
        productName: generated.productName,
        subject: generated.subject,
        body: generated.body,
        inquiryFields: generated.inquiryFields,
        status: "GENERATED",
        diffIndex: idx,
        userId,
        organizationId: compareSession.organizationId,
      },
    });

    // Activity log
    await createActivityLog({
      activityType: "EMAIL_DRAFT_GENERATED",
      entityType: "COMPARE_INQUIRY_DRAFT",
      entityId: draft.id,
      taskType: "VENDOR_INQUIRY_DRAFT",
      userId,
      organizationId: compareSession.organizationId,
      metadata: {
        compareSessionId: id,
        vendorName,
        inquiryFieldCount: generated.inquiryFields.length,
        diffIndex: idx,
      },
    });

    return NextResponse.json({ draft });
  } catch (error) {
    return handleApiError(error, "POST /api/compare-sessions/[id]/inquiry-draft");
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const drafts = await db.compareInquiryDraft.findMany({
      where: { compareSessionId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ drafts });
  } catch (error) {
    return handleApiError(error, "GET /api/compare-sessions/[id]/inquiry-draft");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    const userId = session?.user?.id ?? null;

    const body = await request.json();
    const { draftId, status } = body;

    if (!draftId || !status) {
      return NextResponse.json(
        { error: "draftId와 status가 필요합니다." },
        { status: 400 }
      );
    }

    const validStatuses = ["GENERATED", "COPIED", "SENT"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status는 ${validStatuses.join(", ")} 중 하나여야 합니다.` },
        { status: 400 }
      );
    }

    const draft = await db.compareInquiryDraft.update({
      where: { id: draftId },
      data: { status },
    });

    await createActivityLog({
      activityType: "QUOTE_DRAFT_REVIEWED",
      entityType: "COMPARE_INQUIRY_DRAFT",
      entityId: draftId,
      afterStatus: status,
      userId,
      metadata: { compareSessionId: id },
    });

    return NextResponse.json({ draft });
  } catch (error) {
    return handleApiError(error, "PATCH /api/compare-sessions/[id]/inquiry-draft");
  }
}
