import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 견적 응답 업데이트 (협상용)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; responseId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: quoteId, responseId } = await params;
    const body = await request.json();
    const { totalPrice, currency, message, validUntil } = body;

    // 견적 응답 조회
    const existingResponse = await db.quoteResponse.findUnique({
      where: { id: responseId },
      include: {
        vendor: true,
        quote: true,
      },
    });

    if (!existingResponse) {
      return NextResponse.json({ error: "Response not found" }, { status: 404 });
    }

    // 권한 확인: 벤더 본인만 수정 가능
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, role: true },
    });

    if (user?.role !== "SUPPLIER" || existingResponse.vendor.email !== user.email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 협상 이력 저장 (ActivityLog에 기록)
    await db.activityLog.create({
      data: {
        userId: session.user.id,
        activityType: "QUOTE_UPDATED", // 기존 ActivityType 사용
        entityType: "quote_response",
        entityId: responseId,
        metadata: {
          quoteId,
          previousPrice: existingResponse.totalPrice,
          newPrice: totalPrice,
          previousCurrency: existingResponse.currency,
          newCurrency: currency,
          negotiation: true,
        },
      },
    });

    // 견적 응답 업데이트
    const updatedResponse = await db.quoteResponse.update({
      where: { id: responseId },
      data: {
        totalPrice: totalPrice !== undefined ? totalPrice : existingResponse.totalPrice,
        currency: currency || existingResponse.currency,
        message: message !== undefined ? message : existingResponse.message,
        validUntil: validUntil ? new Date(validUntil) : existingResponse.validUntil,
      },
      include: {
        vendor: true,
      },
    });

    return NextResponse.json(updatedResponse);
  } catch (error: any) {
    console.error("Error updating quote response:", error);
    return NextResponse.json(
      { error: "Failed to update response" },
      { status: 500 }
    );
  }
}

// 협상 이력 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; responseId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { responseId } = await params;

    // 협상 이력 조회 (ActivityLog에서)
    const negotiationHistory = await db.activityLog.findMany({
      where: {
        entityType: "quote_response",
        entityId: responseId,
        activityType: "QUOTE_UPDATED",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ history: negotiationHistory });
  } catch (error: any) {
    console.error("Error fetching negotiation history:", error);
    return NextResponse.json(
      { error: "Failed to fetch negotiation history" },
      { status: 500 }
    );
  }
}

