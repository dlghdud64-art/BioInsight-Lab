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
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      return NextResponse.json(
        { error: "SDS document not found" },
        { status: 404 }
      );
    }

    if (sdsDocument.extractionStatus !== "done" || !sdsDocument.extractionResult) {
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
            in: [OrganizationRole.ADMIN, OrganizationRole.VIEWER],
          },
        },
      });

      if (!membership && session.user.role !== "ADMIN") {
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

    return NextResponse.json({
      success: true,
      product: updatedProduct,
    });
  } catch (error: any) {
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






