import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { QuoteStatus, ActivityType } from "@prisma/client";
import { sendQuoteCompletedEmail, sendQuoteRejectedEmail } from "@/lib/email";
import { createActivityLogServer } from "@/lib/api/activity-logs";

// 허용되는 상태 전환
const ALLOWED_STATUS_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  [QuoteStatus.PENDING]: [QuoteStatus.PARSED, QuoteStatus.SENT, QuoteStatus.COMPLETED, QuoteStatus.CANCELLED],
  [QuoteStatus.PARSED]: [QuoteStatus.SENT, QuoteStatus.COMPLETED, QuoteStatus.CANCELLED],
  [QuoteStatus.SENT]: [QuoteStatus.RESPONDED, QuoteStatus.COMPLETED, QuoteStatus.CANCELLED],
  [QuoteStatus.RESPONDED]: [QuoteStatus.COMPLETED, QuoteStatus.PURCHASED, QuoteStatus.CANCELLED],
  [QuoteStatus.COMPLETED]: [QuoteStatus.PURCHASED, QuoteStatus.CANCELLED],
  [QuoteStatus.PURCHASED]: [],
  [QuoteStatus.CANCELLED]: [QuoteStatus.PENDING], // 취소된 견적 재활성화 가능
};

// 상태 한글 레이블
const STATUS_LABELS: Record<QuoteStatus, string> = {
  [QuoteStatus.PENDING]: "대기 중",
  [QuoteStatus.PARSED]: "파싱 완료",
  [QuoteStatus.SENT]: "발송됨",
  [QuoteStatus.RESPONDED]: "응답 완료",
  [QuoteStatus.COMPLETED]: "완료",
  [QuoteStatus.PURCHASED]: "구매 완료",
  [QuoteStatus.CANCELLED]: "취소됨",
};

/**
 * 견적 상태 업데이트 API
 * PATCH /api/quotes/[id]/status
 *
 * Body: { status: "COMPLETED" | "REJECTED" | ... , reason?: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    // 관리자 권한 확인 (선택적으로 추가)
    // 현재는 인증된 사용자면 허용
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, reason } = body;

    // 유효한 상태인지 확인
    if (!status || !Object.values(QuoteStatus).includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Allowed values: " + Object.values(QuoteStatus).join(", ") },
        { status: 400 }
      );
    }

    // 기존 견적 조회
    const quote = await db.quote.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        items: true,
        listItems: true,
      },
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // 상태 전환 유효성 검사
    const currentStatus = quote.status as QuoteStatus;
    const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];

    if (!allowedTransitions.includes(status)) {
      return NextResponse.json(
        {
          error: `Cannot transition from ${STATUS_LABELS[currentStatus]} to ${STATUS_LABELS[status as QuoteStatus]}`,
          allowedTransitions: allowedTransitions.map(s => ({ status: s, label: STATUS_LABELS[s] })),
        },
        { status: 400 }
      );
    }

    // 이전 상태 저장 (로그용)
    const previousStatus = quote.status;

    // 상태 업데이트
    const updatedQuote = await db.quote.update({
      where: { id },
      data: {
        status,
        updatedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        items: true,
        listItems: true,
      },
    });

    // 액티비티 로그 기록
    const ipAddress = request.headers.get("x-forwarded-for") ||
                     request.headers.get("x-real-ip") ||
                     undefined;
    const userAgent = request.headers.get("user-agent") || undefined;

    createActivityLogServer({
      db,
      activityType: ActivityType.QUOTE_STATUS_CHANGED,
      entityType: "quote",
      entityId: id,
      userId: session.user.id,
      organizationId: quote.organizationId || undefined,
      metadata: {
        previousStatus,
        newStatus: status,
        reason,
        changedBy: session.user.name || session.user.email,
      },
      ipAddress,
      userAgent,
    }).catch((error) => {
      console.error("Failed to create activity log:", error);
    });

    // 이메일 알림 발송 (비동기)
    const userEmail = quote.user?.email;
    const userName = quote.user?.name || "고객";
    const quoteNumber = quote.id.slice(-8).toUpperCase();
    const itemCount = (quote.listItems?.length || 0) + (quote.items?.length || 0);
    const totalAmount = quote.totalAmount
      ? `₩${quote.totalAmount.toLocaleString("ko-KR")}`
      : undefined;

    if (userEmail) {
      // 상태별 이메일 발송
      if (status === QuoteStatus.COMPLETED) {
        sendQuoteCompletedEmail({
          to: userEmail,
          customerName: userName,
          quoteNumber,
          completedDate: new Date().toLocaleDateString("ko-KR"),
          itemCount,
          totalAmount,
        }).catch((error) => {
          console.error("Failed to send quote completed email:", error);
        });
      } else if (status === QuoteStatus.CANCELLED && reason) {
        // 취소 시 거절 이메일 발송 (사유가 있는 경우)
        sendQuoteRejectedEmail({
          to: userEmail,
          customerName: userName,
          quoteNumber,
          reason,
        }).catch((error) => {
          console.error("Failed to send quote rejected email:", error);
        });
      }
    }

    return NextResponse.json({
      success: true,
      quote: updatedQuote,
      message: `견적 상태가 "${STATUS_LABELS[status as QuoteStatus]}"(으)로 변경되었습니다.`,
      transition: {
        from: { status: previousStatus, label: STATUS_LABELS[previousStatus as QuoteStatus] },
        to: { status, label: STATUS_LABELS[status as QuoteStatus] },
      },
    });
  } catch (error) {
    console.error("Error updating quote status:", error);
    return NextResponse.json(
      { error: "Failed to update quote status" },
      { status: 500 }
    );
  }
}

/**
 * 견적 상태 조회 API
 * GET /api/quotes/[id]/status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const quote = await db.quote.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const currentStatus = quote.status as QuoteStatus;
    const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];

    return NextResponse.json({
      id: quote.id,
      status: quote.status,
      label: STATUS_LABELS[currentStatus],
      allowedTransitions: allowedTransitions.map(s => ({
        status: s,
        label: STATUS_LABELS[s]
      })),
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching quote status:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote status" },
      { status: 500 }
    );
  }
}
