import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";

/**
 * #catalog-spec-backfill ② — 제품 규격(specification) 단일 필드 업데이트.
 *
 * 호영님 결정 (2026-06-11): 조달청 ref 에 spec 부재 → supplier/admin 직접 입력이
 * 충전 소스 ②. /api/products/[id]/safety PATCH 패턴 동형.
 * - 권한: 서버측 role 게이트 (ADMIN·SUPPLIER) — UI 게이트 단독 금지.
 * - 쓰기 대상: specification 단일 필드 한정 (추가 스펙 JSON 은 스코프 밖).
 */

const specUpdateSchema = z.object({
  specification: z.string().trim().max(200).nullable(),
});

export async function PATCH(
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
      targetEntityType: 'product',
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/products/id/specification',
    });
    if (!enforcement.allowed) return enforcement.deny();

    // 서버측 role 게이트 — canonical 카탈로그 필드 쓰기는 ADMIN·SUPPLIER 전용.
    const role = session.user.role;
    if (role !== "ADMIN" && role !== "SUPPLIER") {
      return NextResponse.json(
        { error: "Forbidden: admin or supplier role required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = specUpdateSchema.parse(body);

    const product = await db.product.findUnique({ where: { id } });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const updatedProduct = await db.product.update({
      where: { id },
      data: {
        specification: validatedData.specification ?? null,
      },
    });

    return NextResponse.json({ product: updatedProduct });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error updating product specification:", error);
    return NextResponse.json(
      { error: "Failed to update product specification" },
      { status: 500 }
    );
  }
}
