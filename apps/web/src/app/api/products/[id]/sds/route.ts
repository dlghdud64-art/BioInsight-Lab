import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 제품의 SDS 문서 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

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

    // 사용자가 속한 조직 확인 (로그인한 경우)
    let organizationIds: string[] | null = null;
    if (session?.user?.id) {
      const memberships = await db.organizationMember.findMany({
        where: {
          userId: session.user.id,
        },
        select: {
          organizationId: true,
        },
      });
      organizationIds = memberships.map((m) => m.organizationId);
    }

    // SDS 문서 조회
    // 공용(vendor) 또는 사용자의 조직에 속한 문서만 조회
    const where: any = {
      productId: id,
      OR: [
        { organizationId: null }, // 공용 문서
        ...(organizationIds && organizationIds.length > 0
          ? [{ organizationId: { in: organizationIds } }]
          : []),
      ],
    };

    const sdsDocuments = await db.sDSDocument.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ sdsDocuments });
  } catch (error: any) {
    console.error("Error fetching SDS documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch SDS documents" },
      { status: 500 }
    );
  }
}




