/**
 * POST /api/compare-sessions — 비교 세션 생성 + structured diff 계산
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getProductsByIds } from "@/lib/api/products";
import { computeMultiProductDiff } from "@/lib/compare-workspace/compare-engine";
import { createActivityLog } from "@/lib/activity-log";
import { handleApiError } from "@/lib/api-error-handler";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;

    const body = await request.json();
    const { productIds, organizationId } = body;

    if (!Array.isArray(productIds) || productIds.length < 2) {
      return NextResponse.json(
        { error: "최소 2개 제품 ID가 필요합니다." },
        { status: 400 }
      );
    }

    if (productIds.length > 5) {
      return NextResponse.json(
        { error: "최대 5개까지 비교할 수 있습니다." },
        { status: 400 }
      );
    }

    // 제품 조회
    const products = await getProductsByIds(productIds);
    if (!products || products.length < 2) {
      return NextResponse.json(
        { error: "비교할 수 있는 제품이 2개 이상 필요합니다." },
        { status: 404 }
      );
    }

    // CompareSession 생성
    const compareSession = await db.compareSession.create({
      data: {
        productIds: productIds,
        userId,
        organizationId: organizationId ?? null,
      },
    });

    // Structured diff 계산
    const diffResults = computeMultiProductDiff(products, compareSession.id);

    // diff 결과 저장
    await db.compareSession.update({
      where: { id: compareSession.id },
      data: { diffResult: diffResults as any },
    });

    // Activity log
    await createActivityLog({
      activityType: "PRODUCT_COMPARED",
      entityType: "COMPARE_SESSION",
      entityId: compareSession.id,
      userId,
      organizationId: organizationId ?? null,
      metadata: {
        productIds,
        productCount: products.length,
        totalDifferences: diffResults.reduce((sum, d) => sum + d.totalDifferences, 0),
      },
    });

    return NextResponse.json({
      session: {
        id: compareSession.id,
        productIds: compareSession.productIds,
        diffResult: diffResults,
        createdAt: compareSession.createdAt,
      },
      products: products.map((p: any) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        catalogNumber: p.catalogNumber,
      })),
    });
  } catch (error) {
    return handleApiError(error, "POST /api/compare-sessions");
  }
}
