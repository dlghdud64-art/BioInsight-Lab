import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { OrganizationRole } from "@prisma/client";

const safetyUpdateSchema = z.object({
  msdsUrl: z.string().url().optional().nullable(),
  hazardCodes: z.array(z.string()).optional().nullable(),
  pictograms: z.array(z.string()).optional().nullable(),
  storageCondition: z.string().optional().nullable(),
  ppe: z.array(z.string()).optional().nullable(),
  safetyNote: z.string().optional().nullable(),
});

// 제품 안전 필드 업데이트
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
      routePath: '/products/id/safety',
    });
    if (!enforcement.allowed) return enforcement.deny();

        if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Zod 검증
    const validatedData = safetyUpdateSchema.parse(body);

    // 제품 확인
    const product = await db.product.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // 권한 확인 — **합집합**: global ADMIN · global SUPPLIER · 조직 ADMIN/VIEWER 멤버.
    //   §product-detail-sourcing-v21 §1(2026-08-09): 상세 페이지의 "안전 정보 편집" 버튼이
    //   canEditSpec(ADMIN·SUPPLIER) 게이트로 렌더되는데 이 라우트는 SUPPLIER 를 거부해
    //   **front-only 실패**(버튼은 열리고 저장에서 403)였다. 형제 라우트
    //   `/api/products/[id]/specification` 은 이미 ADMIN·SUPPLIER 를 허용한다.
    //   기존 조직 safety_admin(VIEWER) 경로는 실사용 권한이므로 **유지**하고 SUPPLIER 만 더한다
    //   (단순화하면 현행 담당자가 권한을 잃음 — 호영님 2026-08-09 결정).
    //   ⚠️ 소유권 스코프 없음: SUPPLIER 는 타사 제품도 편집 가능하다. 이는 본 변경이 만든
    //   구멍이 아니라 `specification` 이 이미 가진 동일 구멍의 확장이며,
    //   §supplier-product-ownership-scope 후속 트랙에서 두 라우트를 함께 잠근다.
    const userOrganizations = await db.organizationMember.findMany({
      where: {
        userId: session.user.id,
        role: {
          in: [OrganizationRole.ADMIN, OrganizationRole.VIEWER], // VIEWER = safety_admin
        },
      },
    });

    const globalRole = session.user.role;
    const isPrivilegedGlobalRole = globalRole === "ADMIN" || globalRole === "SUPPLIER";

    if (userOrganizations.length === 0 && !isPrivilegedGlobalRole) {
      return NextResponse.json(
        { error: "Forbidden: admin, supplier or safety_admin role required" },
        { status: 403 }
      );
    }

    // 안전 필드 업데이트
    const updatedProduct = await db.product.update({
      where: { id },
      data: {
        msdsUrl: validatedData.msdsUrl ?? undefined,
        hazardCodes: validatedData.hazardCodes ? validatedData.hazardCodes : undefined,
        pictograms: validatedData.pictograms ? validatedData.pictograms : undefined,
        storageCondition: validatedData.storageCondition ?? undefined,
        ppe: validatedData.ppe ? validatedData.ppe : undefined,
        safetyNote: validatedData.safetyNote ?? undefined,
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
    console.error("Error updating product safety:", error);
    return NextResponse.json(
      { error: "Failed to update product safety" },
      { status: 500 }
    );
  }
}









