import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 구매내역 조회 (페이지네이션 지원)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const period = searchParams.get("period") || "month";
    const vendorId = searchParams.get("vendorId");
    const category = searchParams.get("category");
    const organizationId = searchParams.get("organizationId");

    // 기간 계산
    let dateStart: Date;
    let dateEnd: Date = new Date();

    switch (period) {
      case "month":
        dateStart = new Date();
        dateStart.setMonth(dateStart.getMonth() - 1);
        break;
      case "quarter":
        dateStart = new Date();
        dateStart.setMonth(dateStart.getMonth() - 3);
        break;
      case "year":
        dateStart = new Date();
        dateStart.setFullYear(dateStart.getFullYear() - 1);
        break;
      default:
        dateStart = new Date();
        dateStart.setMonth(dateStart.getMonth() - 1);
    }

    // 필터 조건
    const where: any = {
      purchaseDate: {
        gte: dateStart,
        lte: dateEnd,
      },
    };

    if (vendorId) {
      where.vendorId = vendorId;
    }

    if (category) {
      where.category = category;
    }

    // 조직 필터 (사용자의 조직만)
    if (organizationId) {
      where.organizationId = organizationId;
    } else {
      // 사용자의 조직 ID 가져오기
      const userOrg = await db.organizationMember.findFirst({
        where: { userId: session.user.id },
        select: { organizationId: true },
      });
      if (userOrg?.organizationId) {
        where.organizationId = userOrg.organizationId;
      }
    }

    // 총 개수 조회
    const total = await db.purchaseRecord.count({ where });

    // 페이지네이션 적용하여 조회
    const records = await db.purchaseRecord.findMany({
      where,
      include: {
        vendor: true,
        product: true,
        organization: true,
      },
      orderBy: {
        purchaseDate: "desc",
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return NextResponse.json({
      records,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching purchases:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchases" },
      { status: 500 }
    );
  }
}




