import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { OrganizationRole } from "@prisma/client";
import { z } from "zod";

const applySchema = z.object({
  mode: z.enum(["merge", "overwrite"]), // merge: 기존 값과 병합, overwrite: 덮어쓰기
});

// AI 추출 결과를 제품에 적용
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      // §enforcement-handle-close-sweep (sds) — 'unknown' 유지.
      //   ⚠️ params 로 SDSDocument id 를 받지만 **enum 에 문서 타입이 없다**
      //   (허용값: po·quote·dispatch·approval·order·inventory·receiving·ai_action·
      //    compare_session·email_draft·organization·team·workspace·budget·billing·
      //    governance·purchase_request·purchase_record·product·cart·invite).
      //   즉 정확한 분류가 **선택지에 부재**하다 → §audit-taxonomy-review 상신(enum 확장 검토).
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/api/sds/id/apply',
    });
    if (!enforcement.allowed) return enforcement.deny();


    const { id } = await params;
    const body = await request.json();
    const { mode } = applySchema.parse(body);

    // SDS 문서 확인
    const sdsDocument = await db.sDSDocument.findUnique({
      where: { id },
      include: {
        product: true,
        organization: true,
      },
    });

    if (!sdsDocument) {
      enforcement.fail();
      return NextResponse.json(
        { error: "SDS document not found" },
        { status: 404 }
      );
    }

    if (sdsDocument.extractionStatus !== "done" || !sdsDocument.extractionResult) {
      enforcement.fail();
      return NextResponse.json(
        { error: "Extraction not completed" },
        { status: 400 }
      );
    }

    // 권한 확인
    if (sdsDocument.organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationId: sdsDocument.organizationId,
          role: {
            in: [OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.VIEWER],
          },
        },
      });

      if (!membership && session.user.role !== "ADMIN") {
        enforcement.fail();
        return NextResponse.json(
          { error: "Forbidden: safety_admin or admin role required" },
          { status: 403 }
        );
      }
    }

    const extractionResult = sdsDocument.extractionResult as any;

    // 제품 업데이트
    const updateData: any = {};

    if (mode === "overwrite") {
      // 덮어쓰기: 추출 결과로 완전히 교체
      updateData.hazardCodes = extractionResult.hazardCodes || null;
      updateData.pictograms = extractionResult.pictograms || null;
      updateData.storageCondition = extractionResult.storageCondition || null;
      updateData.ppe = extractionResult.ppe || null;
      updateData.safetyNote = extractionResult.summary || null;
    } else {
      // 병합: 기존 값이 없을 때만 추가
      if (extractionResult.hazardCodes && extractionResult.hazardCodes.length > 0) {
        const existing = (sdsDocument.product.hazardCodes as string[]) || [];
        const merged = Array.from(new Set([...existing, ...extractionResult.hazardCodes]));
        updateData.hazardCodes = merged.length > 0 ? merged : null;
      }

      if (extractionResult.pictograms && extractionResult.pictograms.length > 0) {
        const existing = (sdsDocument.product.pictograms as string[]) || [];
        const merged = Array.from(new Set([...existing, ...extractionResult.pictograms]));
        updateData.pictograms = merged.length > 0 ? merged : null;
      }

      if (extractionResult.storageCondition && !sdsDocument.product.storageCondition) {
        updateData.storageCondition = extractionResult.storageCondition;
      }

      if (extractionResult.ppe && extractionResult.ppe.length > 0) {
        const existing = (sdsDocument.product.ppe as string[]) || [];
        const merged = Array.from(new Set([...existing, ...extractionResult.ppe]));
        updateData.ppe = merged.length > 0 ? merged : null;
      }

      if (extractionResult.summary && !sdsDocument.product.safetyNote) {
        updateData.safetyNote = extractionResult.summary;
      }
    }

    const updatedProduct = await db.product.update({
      where: { id: sdsDocument.productId },
      data: updateData,
    });

    // db.product.update 로 canonical 안전필드를 실제 갱신한다 -> complete().
    enforcement.complete({
      beforeState: { sdsDocumentId: id, productId: sdsDocument.productId },
      afterState: { sdsDocumentId: id, productId: updatedProduct.id, applied: true },
    });

    return NextResponse.json({
      success: true,
      product: updatedProduct,
    });
  } catch (error: any) {
    enforcement?.fail();
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error applying extraction:", error);
    return NextResponse.json(
      { error: "Failed to apply extraction" },
      { status: 500 }
    );
  }
}









