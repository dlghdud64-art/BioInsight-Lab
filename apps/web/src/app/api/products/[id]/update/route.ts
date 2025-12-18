import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ActivityType } from "@prisma/client";
import { createActivityLogServer } from "@/lib/api/activity-logs";

// 제품 정보 업데이트 API (관리자 또는 제품 소유자만 가능)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // TODO: 권한 체크 (관리자 또는 제품 소유자만 업데이트 가능)
    // 현재는 모든 인증된 사용자가 업데이트 가능하도록 설정
    // 실제 운영 시에는 권한 체크 로직 추가 필요

    const { id } = await params;
    const body = await request.json();

    // 업데이트 가능한 필드만 허용
    const allowedFields = [
      "name",
      "nameEn",
      "description",
      "descriptionEn",
      "descriptionTranslated",
      "category",
      "brand",
      "modelNumber",
      "catalogNumber",
      "grade",
      "specification",
      "regulatoryCompliance",
      "specifications",
      "datasheetUrl",
      "imageUrl",
      // 안전·규제 정보
      "msdsUrl",
      "safetyNote",
      // 구조화된 안전 필드 (P2)
      "hazardCodes",
      "pictograms",
      "storageCondition",
      "ppe",
    ];

    const updateData: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // 제품 존재 여부 확인
    const existingProduct = await db.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // 제품 업데이트
    const updatedProduct = await db.product.update({
      where: { id },
      data: updateData,
    });

    // 안전 필드 변경 시 액티비티 로그 기록
    const safetyFields = ["msdsUrl", "safetyNote", "hazardCodes", "pictograms", "storageCondition", "ppe"] as const;
    const safetyChanged = safetyFields.some((field) => body[field] !== undefined);

    if (safetyChanged) {
      try {
        const beforeSafety: Record<string, any> = {};
        const afterSafety: Record<string, any> = {};

        for (const field of safetyFields) {
          beforeSafety[field] = (existingProduct as any)[field] ?? null;
          afterSafety[field] = (updatedProduct as any)[field] ?? null;
        }

        await createActivityLogServer({
          db,
          activityType: ActivityType.QUOTE_UPDATED,
          entityType: "product_safety",
          entityId: id,
          userId: session.user.id,
          metadata: {
            before: beforeSafety,
            after: afterSafety,
          },
        });
      } catch (logError) {
        console.error("Failed to create activity log for product safety update:", logError);
      }
    }

    return NextResponse.json({
      success: true,
      product: updatedProduct,
    });
  } catch (error: any) {
    console.error("Error updating product:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update product" },
      { status: 500 }
    );
  }
}

