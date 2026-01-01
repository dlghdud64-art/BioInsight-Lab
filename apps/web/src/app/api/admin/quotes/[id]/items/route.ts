import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ActivityType } from "@prisma/client";
import { createActivityLogServer } from "@/lib/api/activity-logs";

interface ItemUpdate {
  id: string;
  costPrice: number | null;
  unitPrice: number | null;
  adminNotes: string | null;
}

/**
 * 관리자용 견적 품목 수정 API
 * PATCH /api/admin/quotes/[id]/items
 *
 * Body: { items: [{ id, costPrice, unitPrice, adminNotes }] }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: quoteId } = await params;
    const body = await request.json();
    const { items } = body as { items: ItemUpdate[] };

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "Items array is required" },
        { status: 400 }
      );
    }

    // 견적 존재 확인
    const quote = await db.quote.findUnique({
      where: { id: quoteId },
      include: { listItems: true },
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // 상태 확인 (완료/취소된 견적은 수정 불가)
    if (quote.status === "COMPLETED" || quote.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Cannot modify completed or cancelled quote" },
        { status: 400 }
      );
    }

    // 트랜잭션으로 모든 품목 업데이트
    const updatedItems = await db.$transaction(
      items.map((item) =>
        db.quoteListItem.update({
          where: { id: item.id },
          data: {
            unitPrice: item.unitPrice,
            // costPrice와 adminNotes는 스키마에 없으면 raw JSON으로 저장
            raw: {
              ...(quote.listItems.find((li: { id: string; raw?: any }) => li.id === item.id)?.raw as object || {}),
              costPrice: item.costPrice,
              adminNotes: item.adminNotes,
            },
            lineTotal: item.unitPrice
              ? item.unitPrice *
                (quote.listItems.find((li: { id: string; quantity?: number | null }) => li.id === item.id)?.quantity || 1)
              : null,
          },
        })
      )
    );

    // 총액 재계산
    const totalAmount = updatedItems.reduce(
      (sum: number, item) => sum + (item.lineTotal || 0),
      0
    );

    // 견적 총액 업데이트
    await db.quote.update({
      where: { id: quoteId },
      data: { totalAmount },
    });

    // 액티비티 로그 기록
    const ipAddress =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      undefined;
    const userAgent = request.headers.get("user-agent") || undefined;

    createActivityLogServer({
      db,
      activityType: ActivityType.QUOTE_UPDATED,
      entityType: "quote",
      entityId: quoteId,
      userId: session.user.id,
      metadata: {
        action: "admin_price_update",
        itemsUpdated: items.length,
        newTotalAmount: totalAmount,
        updatedBy: session.user.name || session.user.email,
      },
      ipAddress,
      userAgent,
    }).catch((error) => {
      console.error("Failed to create activity log:", error);
    });

    return NextResponse.json({
      success: true,
      message: `${items.length}개 품목이 업데이트되었습니다.`,
      totalAmount,
    });
  } catch (error) {
    console.error("Error updating quote items:", error);
    return NextResponse.json(
      { error: "Failed to update quote items" },
      { status: 500 }
    );
  }
}
