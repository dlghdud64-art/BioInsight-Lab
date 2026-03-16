/**
 * POST /api/compare-sessions/[id]/inquiry-draft — 공급사 문의 초안 생성
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

    const draft = await generateVendorInquiryDraft({
      diffResult,
      sourceProductName: sourceProductName || "기준 제품",
      targetProductName: targetProductName || "비교 대상",
      vendorName,
      vendorEmail,
    });

    // Activity log
    await createActivityLog({
      activityType: "EMAIL_DRAFT_GENERATED",
      entityType: "COMPARE_SESSION",
      entityId: id,
      taskType: "VENDOR_INQUIRY_DRAFT",
      userId,
      organizationId: compareSession.organizationId,
      metadata: {
        vendorName,
        inquiryFieldCount: draft.inquiryFields.length,
        diffIndex: idx,
      },
    });

    return NextResponse.json({ draft });
  } catch (error) {
    return handleApiError(error, "POST /api/compare-sessions/[id]/inquiry-draft");
  }
}
