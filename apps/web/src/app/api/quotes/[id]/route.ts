import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getQuoteById } from "@/lib/api/quotes";
import { db } from "@/lib/db";
import { createActivityLogServer } from "@/lib/api/activity-logs";
import { ActivityType } from "@prisma/client";
import { sendEmail } from "@/lib/email/sender";
import { generatePurchaseCompleteEmail } from "@/lib/email/templates";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import { markQuoteAsPurchased } from "./markPurchased";

const logger = createLogger("quotes/[id]");

// 특정 견적 조회
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
    const quote = await getQuoteById(id);

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // 본인의 견적만 조회 가능
    if (quote.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 액티비티 로그 기록 (비동기, 실패해도 조회는 성공)
    const ipAddress = request.headers.get("x-forwarded-for") || 
                     request.headers.get("x-real-ip") || 
                     undefined;
    const userAgent = request.headers.get("user-agent") || undefined;
    
    createActivityLogServer({
      db,
      activityType: ActivityType.QUOTE_VIEWED,
      entityType: "quote",
      entityId: quote.id,
      userId: session.user.id,
      organizationId: quote.organizationId || undefined,
      metadata: {
        title: quote.title,
      },
      ipAddress,
      userAgent,
    }).catch((error) => {
      logger.error("Failed to create activity log", error);
    });

    return NextResponse.json({ quote });
  } catch (error) {
    return handleApiError(error, "quotes/GET");
  }
}

// 견적 수정
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
    const { title, description, status } = body;

    const quote = await db.quote.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        organization: true,
      },
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // 본인의 견적만 수정 가능
    if (quote.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const previousStatus = quote.status;
    const isCompletingPurchase = status === "PURCHASED" && previousStatus !== "PURCHASED";

    // 견적 수정
    const updatedQuote = await db.quote.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(status && { status }),
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    // 구매 완료 시 PurchaseRecord 자동 생성 (멱등성 보장)
    if (isCompletingPurchase && quote.items.length > 0) {
      try {
        const scopeKey = request.headers.get("x-guest-key");
        if (!scopeKey) {
          throw new Error("x-guest-key header is required to create purchase records");
        }

        const purchaseResult = await markQuoteAsPurchased({
          quoteId: quote.id,
          scopeKey,
        });

        if (!purchaseResult.alreadyPurchased) {
          logger.info(`Created ${purchaseResult.count} purchase records for quote ${quote.id}`);

          // Send purchase complete email
          try {
            const user = await db.user.findUnique({
              where: { id: session.user.id },
              select: { email: true },
            });

            if (user?.email && purchaseResult.purchaseData) {
              const totalAmount = purchaseResult.purchaseData.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0);
              const currency = purchaseResult.purchaseData[0]?.currency || "KRW";

              const emailTemplate = generatePurchaseCompleteEmail({
                quoteTitle: quote.title,
                totalAmount,
                currency,
                itemCount: purchaseResult.purchaseData.length,
                purchaseDate: new Date(),
                quoteUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/quotes/${quote.id}`,
              });

              await sendEmail({
                to: user.email,
                subject: emailTemplate.subject,
                html: emailTemplate.html,
                text: emailTemplate.text,
              });

              logger.info(`Sent purchase complete email to ${user.email}`);
            }
          } catch (emailError) {
            logger.error("Failed to send purchase complete email", emailError);
          }
        }
      } catch (error) {
        logger.error("Failed to create purchase records", error);
        // PurchaseRecord 생성 실패해도 Quote 업데이트는 성공으로 처리
      }
    }

    // 액티비티 로그 기록
    const ipAddress = request.headers.get("x-forwarded-for") || 
                     request.headers.get("x-real-ip") || 
                     undefined;
    const userAgent = request.headers.get("user-agent") || undefined;
    
    createActivityLogServer({
      db,
      activityType: ActivityType.QUOTE_UPDATED,
      entityType: "quote",
      entityId: quote.id,
      userId: session.user.id,
      organizationId: quote.organizationId || undefined,
      metadata: {
        title: updatedQuote.title,
        changes: {
          title: title ? { from: quote.title, to: title } : undefined,
          description: description ? { from: quote.description, to: description } : undefined,
        },
      },
      ipAddress,
      userAgent,
    }).catch((error) => {
      logger.error("Failed to create activity log", error);
    });

    return NextResponse.json({ quote: updatedQuote });
  } catch (error) {
    return handleApiError(error, "quotes/PATCH");
  }
}

// 견적 삭제
export async function DELETE(
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
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // 본인의 견적만 삭제 가능
    if (quote.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 액티비티 로그 기록 (삭제 전에 기록)
    const ipAddress = request.headers.get("x-forwarded-for") || 
                     request.headers.get("x-real-ip") || 
                     undefined;
    const userAgent = request.headers.get("user-agent") || undefined;
    
    createActivityLogServer({
      db,
      activityType: ActivityType.QUOTE_DELETED,
      entityType: "quote",
      entityId: quote.id,
      userId: session.user.id,
      organizationId: quote.organizationId || undefined,
      metadata: {
        title: quote.title,
      },
      ipAddress,
      userAgent,
    }).catch((error) => {
      logger.error("Failed to create activity log", error);
    });

    await db.quote.delete({
      where: { id },
    });

    logger.info(`Deleted quote ${id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "quotes/DELETE");
  }
}

