import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

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
      "msdsUrl",
      "safetyNote",
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

