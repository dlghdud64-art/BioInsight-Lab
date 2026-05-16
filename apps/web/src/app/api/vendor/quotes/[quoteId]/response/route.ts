import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createQuoteResponse } from "@/lib/api/vendor-quotes";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/sender";
import { generateQuoteResponseEmail } from "@/lib/email/templates";
import { ActivityType } from "@prisma/client";
import { createActivityLogServer } from "@/lib/api/activity-logs";
import { dispatchNotificationEvent } from "@/lib/notifications/event-dispatcher";
import { sendPushNotification } from "@/lib/notifications/push-sender";

/**
 * §11.229b-5 #vendor-replied-notification-dispatch — 호영님 §11.229b cluster 자연 후속.
 *
 *   vendor 가 quote response 제출 시 견적 요청자 (quote.userId) 에게
 *   VENDOR_REPLIED inApp notification 자동 dispatch. mobile NotificationsScreen
 *   에서 tap 시 buildNotificationHref 가 entityType "QUOTE" → /quotes/{id}
 *   deep-link 자동 진입.
 *
 *   기존 createQuoteResponse + sendEmail + createActivityLogServer 모두 보존.
 *   dispatchNotificationEvent 는 try/catch graceful — mutation 정합 유지.
 *   §11.209d-notification-inapp-server-wiring PURCHASE_APPROVAL_REQUESTED
 *   패턴 정확 reuse.
 *
 * §11.229b-6 #vendor-replied-push-notification — §11.229b-5 자연 후속.
 *
 *   §11.229b-5 inApp 위에 Expo OS-level push 추가 — 3 채널 (email + inApp + OS push).
 *   sendPushNotification(quote.userId, { type "quote_response", id quoteId,
 *   title 한국어, body vendor.name+quote.title 요약 }) 호출.
 *   mobile addNotificationResponseReceivedListener 가 ROUTE_MAP.quote_response.detail
 *   → router.push(/quotes/{id}) deep-link 자동 매핑.
 *   #mobile-push-notification PURCHASE_APPROVAL_REQUESTED push 패턴 정확 reuse.
 */

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

    // §11.229b-5 — VENDOR_REPLIED inApp notification dispatch.
    //   견적 요청자 (quote.userId) 에게 in-app 알림 자동 생성 + queue item.
    //   guest quote (userId null) 는 dispatch skip — anonymous quote 는 notification recipient 0.
    //   mutation 정합 보호: try/catch graceful — 알림 fail 시 mutation 결과 영향 0.
    //   §11.209d-notification-inapp-server-wiring PURCHASE_APPROVAL_REQUESTED 패턴 reuse.
    if (quote?.userId) {
      try {
        await dispatchNotificationEvent({
          eventType: "VENDOR_REPLIED",
          entityType: "QUOTE",
          entityId: quoteId,
          triggeredBy: session.user.id,
          recipients: [
            {
              userId: quote.userId,
              email: quote.user?.email ?? undefined,
            },
          ],
          metadata: {
            quoteTitle: quote.title,
            vendorName: vendor.name,
            totalPrice: response.totalPrice,
            currency: response.currency,
          },
        });
      } catch (notifErr) {
        // graceful — mutation 정합 유지
        console.error("[vendor/response] VENDOR_REPLIED notification 발송 실패 (mutation 정합 유지):", notifErr);
      }

      // §11.229b-6 — Expo OS-level push notification.
      //   §11.229b-5 inApp 위에 OS-level 알림 추가 — 모바일 background 에서도 즉시 인지.
      //   payload type "quote_response" 가 mobile ROUTE_MAP 안 등록됨 → /quotes/{id} deep-link 자동.
      //   guest quote (userId null) 는 위 if 가 이미 skip. best-effort (push fail → mutation 정합 유지).
      //   #mobile-push-notification PURCHASE_APPROVAL_REQUESTED push 패턴 정확 reuse.
      try {
        const priceLabel = response.totalPrice != null
          ? `${response.totalPrice.toLocaleString("ko-KR")} ${response.currency || "KRW"}`
          : "금액 미정";
        await sendPushNotification(quote.userId, {
          title: "공급사 응답 도착",
          body: `${vendor.name} — ${quote.title} (${priceLabel})`,
          data: {
            type: "quote_response",
            id: quoteId,
            vendorName: vendor.name,
          },
        });
      } catch (pushErr) {
        // graceful — mutation 정합 유지
        console.error("[vendor/response] push notification 실패 (mutation 정합 유지):", pushErr);
      }
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

