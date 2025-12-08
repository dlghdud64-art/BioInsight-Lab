import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 프리미엄 추천 영역 노출 설정
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, email: true },
    });

    if (user?.role !== "SUPPLIER") {
      return NextResponse.json({ error: "Only suppliers can access this" }, { status: 403 });
    }

    const vendor = await db.vendor.findFirst({
      where: { email: user.email || undefined },
    });

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    // 프리미엄 플랜 확인
    if (!vendor.isPremium || (vendor.premiumExpiresAt && vendor.premiumExpiresAt < new Date())) {
      return NextResponse.json(
        { error: "Premium plan required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { productVendorId, isPremiumFeatured, premiumPriority } = body;

    if (!productVendorId) {
      return NextResponse.json({ error: "productVendorId is required" }, { status: 400 });
    }

    // ProductVendor가 해당 벤더의 것인지 확인
    const productVendor = await db.productVendor.findUnique({
      where: { id: productVendorId },
      include: { vendor: true },
    });

    if (!productVendor || productVendor.vendorId !== vendor.id) {
      return NextResponse.json({ error: "Product vendor not found" }, { status: 404 });
    }

    const updated = await db.productVendor.update({
      where: { id: productVendorId },
      data: {
        isPremiumFeatured: isPremiumFeatured ?? productVendor.isPremiumFeatured,
        premiumPriority: premiumPriority ?? productVendor.premiumPriority,
      },
    });

    return NextResponse.json({ productVendor: updated });
  } catch (error) {
    console.error("Error updating premium featured:", error);
    return NextResponse.json(
      { error: "Failed to update premium featured" },
      { status: 500 }
    );
  }
}

// 프리미엄 추천 제품 목록 조회 (검색 결과 정렬에 사용)