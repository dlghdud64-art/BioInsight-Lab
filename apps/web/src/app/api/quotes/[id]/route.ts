import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getQuoteById } from "@/lib/api/quotes";
import { db } from "@/lib/db";
import { getScope, getScopeKey } from "@/lib/auth/scope";
import { createActivityLogServer } from "@/lib/api/activity-logs";
import { ActivityType, Prisma } from "@prisma/client";
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

    // 팀 기반 권한 체크: 본인 또는 같은 조직 멤버면 조회 가능
    const isOwner = quote.userId === session.user.id;
    let isTeamMember = false;

    if (!isOwner && quote.organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationId: quote.organizationId,
        },
      });
      isTeamMember = !!membership;
    }

    if (!isOwner && !isTeamMember) {
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
    const { title, description, status, budgetId } = body;

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

    // 팀 기반 권한 체크: 본인 또는 같은 조직 멤버면 수정 가능
    const isOwner = quote.userId === session.user.id;
    let isTeamMember = false;

    if (!isOwner && quote.organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationId: quote.organizationId,
        },
      });
      isTeamMember = !!membership;
    }

    if (!isOwner && !isTeamMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const previousStatus = quote.status;
    const isCompletingPurchase =
      (status === "PURCHASED" || status === "COMPLETED") &&
      previousStatus !== "PURCHASED" &&
      previousStatus !== "COMPLETED";

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
        // getScope 실패(워크스페이스 없는 유저) 시 userId를 scopeKey로 폴백
        let scopeKey = session.user.id;
        let purchaseWorkspaceId: string | null = null;
        try {
          const scope = await getScope(request);
          scopeKey = getScopeKey(scope);
          purchaseWorkspaceId = scope.type === "workspace" ? (scope.workspaceId ?? null) : null;
        } catch {
          // 워크스페이스/게스트키 없는 유저: userId를 scopeKey로 사용
          logger.info(`No workspace scope for user ${session.user.id}, using userId as scopeKey`);
        }

        const purchaseResult = await markQuoteAsPurchased({
          quoteId: quote.id,
          scopeKey,
          workspaceId: purchaseWorkspaceId,
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

        revalidatePath("/dashboard/purchases");
        revalidatePath("/dashboard");
        revalidatePath(`/quotes/${id}`);

        // 예산 차감 로직: 클라이언트가 선택한 budgetId로 명시적 차감
        if (!purchaseResult.alreadyPurchased) {
          const purchaseTotalAmount = purchaseResult.purchaseData
            ? purchaseResult.purchaseData.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0)
            : 0;

          logger.info(`[PURCHASE] purchaseTotalAmount: ${purchaseTotalAmount}, budgetId: ${budgetId ?? "none"}`);

          if (purchaseTotalAmount > 0 && budgetId) {
            // 1. 예산 조회
            const targetBudget = await db.userBudget.findUnique({
              where: { id: budgetId },
            });

            if (!targetBudget) {
              return NextResponse.json(
                { error: "선택한 예산을 찾을 수 없습니다." },
                { status: 400 }
              );
            }

            // 2. 보안 검증: 본인 예산 또는 소속 조직 예산인지 이중 확인
            const isOwnerBudget = targetBudget.userId === session.user.id;
            let isOrgBudget = false;
            if (!isOwnerBudget && targetBudget.organizationId) {
              const membership = await db.organizationMember.findFirst({
                where: {
                  userId: session.user.id,
                  organizationId: targetBudget.organizationId,
                },
              });
              isOrgBudget = !!membership;
            }

            if (!isOwnerBudget && !isOrgBudget) {
              return NextResponse.json(
                { error: "해당 예산에 접근 권한이 없습니다." },
                { status: 403 }
              );
            }

            // 3. 잔액 검증 (부족 시 400)
            if (targetBudget.remainingAmount < purchaseTotalAmount) {
              return NextResponse.json(
                { error: "예산 잔액이 부족합니다." },
                { status: 400 }
              );
            }

            // 4. 트랜잭션: 예산 차감 + 거래 내역 기록 (원자성 보장)
            await db.$transaction(async (tx: Prisma.TransactionClient) => {
              const budgetBefore = targetBudget.remainingAmount;
              const budgetAfter = budgetBefore - purchaseTotalAmount;

              await tx.userBudget.update({
                where: { id: targetBudget.id },
                data: {
                  usedAmount: { increment: purchaseTotalAmount },
                  remainingAmount: { decrement: purchaseTotalAmount },
                },
              });

              await tx.userBudgetTransaction.create({
                data: {
                  budgetId: targetBudget.id,
                  type: "DEBIT",
                  amount: purchaseTotalAmount,
                  description: `견적 구매 완료: ${quote.title}`,
                  balanceBefore: budgetBefore,
                  balanceAfter: budgetAfter,
                },
              });
            });

            revalidatePath("/dashboard/budget");
            logger.info(`Budget deducted: ${purchaseTotalAmount} from budget ${targetBudget.id}`);
          }
        }
      } catch (error) {
        // 구매 처리(PurchaseRecord 생성 또는 예산 차감) 실패 → 500 반환
        console.error("[PURCHASE_ERROR] 구매/예산 처리 실패 quoteId:", id, error);
        return NextResponse.json(
          { error: "구매 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
          { status: 500 }
        );
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

    // 견적 상태 변경 후 모든 관련 페이지 캐시 강제 무효화
    // (isCompletingPurchase 여부와 무관하게 모든 PATCH에 적용)
    revalidatePath("/dashboard", "layout");  // 레이아웃 포함 전체 대시보드 캐시 제거
    revalidatePath("/dashboard/quotes");
    revalidatePath("/dashboard/purchases");
    revalidatePath("/dashboard/budget");
    revalidatePath("/quotes");
    revalidatePath(`/quotes/${id}`);

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

    // 팀 기반 권한 체크: 본인 또는 같은 조직 멤버면 삭제 가능
    const isOwner = quote.userId === session.user.id;
    let isTeamMember = false;

    if (!isOwner && quote.organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationId: quote.organizationId,
        },
      });
      isTeamMember = !!membership;
    }

    if (!isOwner && !isTeamMember) {
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

