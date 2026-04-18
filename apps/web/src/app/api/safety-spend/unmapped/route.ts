import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { OrganizationRole } from "@prisma/client";

/**
 * Unmapped 구매 내역 조회
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // 권한 확인
    if (organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationId,
        },
      });

      const hasAccess =
        session.user.role === "ADMIN" ||
        membership?.role === OrganizationRole.ADMIN ||
        membership?.role === OrganizationRole.APPROVER ||
        membership?.role === OrganizationRole.VIEWER;

      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Unmapped 구매 내역 조회 (productId가 null)
    const where: any = {
      productId: null,
      ...(organizationId && { organizationId }),
    };

    const [records, total] = await Promise.all([
      db.purchaseRecord.findMany({
        where,
        include: {
          vendor: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          purchaseDate: "desc",
        },
        take: limit,
        skip: offset,
      }),
      db.purchaseRecord.count({ where }),
    ]);

    // notes에서 품목명과 CatNo 추출 시도
    const formattedRecords = records.map((record: any) => {
      let productName = record.notes || "";
      let catalogNumber = "";

      // notes에서 품목명과 CatNo 추출 (간단한 파싱)
      if (record.notes) {
        const parts = record.notes.split(" ");
        productName = parts.slice(1).join(" ") || record.notes;
        // CatNo 패턴 찾기 (예: Cat.No: ABC123 또는 ABC-123)
        const catNoMatch = record.notes.match(/[Cc]at[.\s]*[Nn]o[.\s]*:?\s*([A-Z0-9-]+)/i);
        if (catNoMatch) {
          catalogNumber = catNoMatch[1];
        }
      }

      return {
        id: record.id,
        purchaseDate: record.purchaseDate,
        vendor: record.vendor?.name || "알 수 없음",
        productName,
        catalogNumber,
        amount: record.totalAmount,
        currency: record.currency,
        quantity: record.quantity,
        notes: record.notes,
      };
    });

    return NextResponse.json({
      records: formattedRecords,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("Error fetching unmapped records:", error);
    return NextResponse.json(
      { error: "Failed to fetch unmapped records" },
      { status: 500 }
    );
  }
}




