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
  try {
    const session = await auth();
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

    // 권한 확인: safety_admin 또는 admin
    // 현재 사용자가 속한 조직의 역할 확인
    const userOrganizations = await db.organizationMember.findMany({
      where: {
        userId: session.user.id,
        role: {
          in: [OrganizationRole.ADMIN, OrganizationRole.VIEWER], // VIEWER = safety_admin
        },
      },
    });

    if (userOrganizations.length === 0 && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: safety_admin or admin role required" },
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



