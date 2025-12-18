import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createQuoteResponse } from "@/lib/api/vendor-quotes";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/sender";
import { generateQuoteResponseEmail } from "@/lib/email/templates";
import { ActivityType } from "@prisma/client";
import { createActivityLogServer } from "@/lib/api/activity-logs";

// 견적 응답 생성/업데이트
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 사용자가 SUPPLIER 역할인지 확인
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "SUPPLIER") {
      return NextResponse.json(
        { error: "Only suppliers can respond to quotes" },
        { status: 403 }
      );
    }

    // 벤더 찾기
    const vendor = await db.vendor.findFirst({
      where: {
        email: session.user.email || undefined,
      },
    });

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor not found for this user" },
        { status: 404 }
      );
    }

    const { quoteId } = await params;
    const body = await request.json();
    const { totalPrice, currency, message, validUntil } = body;

    const response = await createQuoteResponse(vendor.id, quoteId, {
      totalPrice: totalPrice ? parseFloat(totalPrice) : undefined,
      currency,
      message,
      validUntil: validUntil ? new Date(validUntil) : undefined,
    });

    // 견적 정보 조회 (이메일 발송용)
    const quote = await db.quote.findUnique({
      where: { id: quoteId },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    // 견적 요청자에게 이메일 발송
    if (quote?.user?.email) {
      try {
        const emailTemplate = generateQuoteResponseEmail({
          quoteTitle: quote.title,
          vendorName: vendor.name,
          totalPrice: response.totalPrice,
          currency: response.currency || "KRW",
          message: response.message,
          quoteUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/quotes/${quoteId}`,
          responseDate: response.createdAt,
        });

        await sendEmail({
          to: quote.user.email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          text: emailTemplate.text,
        });
      } catch (emailError) {
        // 이메일 발송 실패는 로깅만 하고 응답은 정상 반환
        console.error("Failed to send quote response email:", emailError);
      }
    }

    // 액티비티 로그 기록: 벤더 견적 응답 생성
    try {
      await createActivityLogServer({
        db,
        activityType: ActivityType.QUOTE_CREATED,
        entityType: "quote_response_vendor",
        entityId: response.id,
        userId: session.user.id,
        metadata: {
          quoteId,
          vendorId: vendor.id,
          totalPrice: response.totalPrice,
          currency: response.currency,
          validUntil: response.validUntil,
        },
      });
    } catch (logError) {
      console.error("Failed to create activity log for vendor quote response:", logError);
    }

    return NextResponse.json({ response }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating quote response:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create quote response" },
      { status: 500 }
    );
  }
}

