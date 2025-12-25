import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getQuoteById } from "@/lib/api/quotes";
import { db, isPrismaAvailable } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import { createActivityLogServer } from "@/lib/api/activity-logs";
import { ActivityType } from "@prisma/client";
import { sendEmail } from "@/lib/email/sender";
import { generatePurchaseCompleteEmail } from "@/lib/email/templates";

// 특정 견적 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const guestKey = request.headers.get("x-guest-key");

    // 로그인 또는 guestKey 중 하나는 필요
    if (!session?.user?.id && !guestKey) {
      return NextResponse.json({ error: "Unauthorized: Login or guest key required" }, { status: 401 });
    }

    const { id } = await params;
    const quote = await getQuoteById(id);

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // 본인의 견적만 조회 가능 (userId 또는 guestKey 일치 확인)
    // userId와 guestKey가 모두 없는 경우(공개 quote)는 누구나 접근 가능
    const isOwner = (session?.user?.id && quote.userId === session.user.id) ||
                    (guestKey && quote.guestKey === guestKey) ||
                    (!quote.userId && !quote.guestKey);
    
    if (!isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 액티비티 로그 기록 (비동기, 실패해도 조회는 성공)
    const ipAddress = request.headers.get("x-forwarded-for") || 
                     request.headers.get("x-real-ip") || 
                     undefined;
    const userAgent = request.headers.get("user-agent") || undefined;
    
    if (session?.user?.id) {
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
        console.error("Failed to create activity log:", error);
      });
    }

    return NextResponse.json({ quote });
  } catch (error) {
    console.error("Error fetching quote:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote" },
      { status: 500 }
    );
  }
}

// 견적 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const guestKey = request.headers.get("x-guest-key");

    // 로그인 또는 guestKey 중 하나는 필요
    if (!session?.user?.id && !guestKey) {
      return NextResponse.json({ error: "Unauthorized: Login or guest key required" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, description, status, message, items } = body;

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

    // 본인의 견적만 수정 가능 (userId 또는 guestKey 일치 확인)
    // userId와 guestKey가 모두 없는 경우(공개 quote)는 누구나 수정 가능
    const isOwner = (session?.user?.id && quote.userId === session.user.id) ||
                    (guestKey && quote.guestKey === guestKey) ||
                    (!quote.userId && !quote.guestKey);
    
    if (!isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const previousStatus = quote.status;
    const isCompletingPurchase = status === "COMPLETED" && previousStatus !== "COMPLETED";

    // items 업데이트가 있으면 기존 items 삭제 후 새로 생성
    if (items && Array.isArray(items)) {
      // Quote.items는 QuoteListItem을 사용하므로 QuoteListItem을 업데이트
      await db.quoteListItem.deleteMany({
        where: { quoteId: id },
      });

      // productId가 DB에 없으면 null로 저장하고 snapshot(name/vendor/brand)로 보존
      const requestedIds = Array.from(
        new Set(items.map((it: any) => it.productId).filter((v: any) => !!v))
      );
      const existing =
        requestedIds.length > 0
          ? await db.product.findMany({
              where: { id: { in: requestedIds } },
              select: { id: true },
            })
          : [];
      const existingSet = new Set(existing.map((p: any) => p.id));

      // createMany 대신 개별 create로 snapshot 저장
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const quantity = item.quantity || 1;
        const unitPrice = item.unitPrice || 0;
        const lineTotal = item.lineTotal || unitPrice * quantity;
        
        // productSnapshot 생성 (서버에서 계산, 클라 값 신뢰하지 않음)
        const snapshot = {
          productName: item.productName || item.name || null,
          vendorName: item.vendorName || item.vendor || null,
          brand: item.brand || null,
          catalogNumber: item.catalogNumber || null,
          quantity,
          unitPrice,
          currency: item.currency || "KRW",
          lineTotal,
          notes: item.notes || null,
          timestamp: new Date().toISOString(),
        };
        
        await db.quoteListItem.create({
          data: {
            quoteId: id,
            productId: item.productId && existingSet.has(item.productId) ? item.productId : null,
            name: item.productName || item.name || null,
            vendor: item.vendorName || item.vendor || null,
            brand: item.brand || null,
            lineNumber: item.lineNumber || idx + 1,
            quantity,
            unitPrice,
            currency: item.currency || "KRW",
            lineTotal,
            notes: item.notes || null,
            snapshot,
          },
        });
      }
    }

    // 견적 수정
    const updatedQuote = await db.quote.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(message !== undefined && { description: message }), // message는 description으로 저장
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

    // 구매 완료 시 PurchaseRecord 자동 생성 (로그인 사용자만)
    if (session?.user?.id && isCompletingPurchase && quote.items.length > 0) {
      try {
        // 조직 ID 가져오기
        let finalOrganizationId = quote.organizationId || null;
        if (!finalOrganizationId && session?.user?.id) {
          const userOrg = await db.organizationMember.findFirst({
            where: { userId: session.user.id },
            select: { organizationId: true },
          });
          finalOrganizationId = userOrg?.organizationId || null;
        }

        // 각 아이템에 대해 PurchaseRecord 생성
        const purchaseRecords = await Promise.all(
          quote.items.map(async (item: { productId: string; quantity: number; unitPrice: number | null; currency: string | null; notes: string | null; product: { category: string } | null }) => {
            // 제품의 첫 번째 벤더 정보 가져오기
            const productVendor = await db.productVendor.findFirst({
              where: { productId: item.productId },
              include: { vendor: true },
            });

            // 제품의 위험 정보 스냅샷 생성
            const product = await db.product.findUnique({
              where: { id: item.productId },
              select: {
                hazardCodes: true,
                pictograms: true,
                msdsUrl: true,
              },
            });

            const hazardSnapshot = product
              ? {
                  hazardCodes: product.hazardCodes || [],
                  pictograms: product.pictograms || [],
                  msdsUrl: product.msdsUrl || null,
                }
              : null;

            return db.purchaseRecord.create({
              data: {
                quoteId: quote.id,
                organizationId: finalOrganizationId,
                projectName: quote.description || null,
                vendorId: productVendor?.vendorId || null,
                productId: item.productId,
                matchType: "QUOTE",
                hazardSnapshot,
                purchaseDate: new Date(),
                quantity: item.quantity,
                unitPrice: item.unitPrice || productVendor?.priceInKRW || 0,
                currency: item.currency || productVendor?.currency || "KRW",
                totalAmount: (item.unitPrice || productVendor?.priceInKRW || 0) * item.quantity,
                category: item.product?.category || null,
                notes: item.notes || null,
                importedBy: session.user.id,
              },
            });
          })
        );

        console.log(`Created ${purchaseRecords.length} purchase records for quote ${quote.id}`);

        // 구매 완료 이메일 발송
        try {
          const user = await db.user.findUnique({
            where: { id: session.user.id },
            select: { email: true },
          });

          if (user?.email) {
            const totalAmount = purchaseRecords.reduce((sum, record) => sum + record.totalAmount, 0);
            const currency = purchaseRecords[0]?.currency || "KRW";
            
            const emailTemplate = generatePurchaseCompleteEmail({
              quoteTitle: quote.title,
              totalAmount,
              currency,
              itemCount: purchaseRecords.length,
              purchaseDate: new Date(),
              quoteUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/quotes/${quote.id}`,
            });

            await sendEmail({
              to: user.email,
              subject: emailTemplate.subject,
              html: emailTemplate.html,
              text: emailTemplate.text,
            });
          }
        } catch (emailError) {
          // 이메일 발송 실패는 로깅만 하고 계속 진행
          console.error("Failed to send purchase complete email:", emailError);
        }
      } catch (error) {
        console.error("Failed to create purchase records:", error);
        // PurchaseRecord 생성 실패해도 Quote 업데이트는 성공으로 처리
      }
    }

    // 액티비티 로그 기록
    const ipAddress = request.headers.get("x-forwarded-for") || 
                     request.headers.get("x-real-ip") || 
                     undefined;
    const userAgent = request.headers.get("user-agent") || undefined;
    
    if (session?.user?.id) {
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
        console.error("Failed to create activity log:", error);
      });
    }

    return NextResponse.json({ quote: updatedQuote });
  } catch (error) {
    console.error("Error updating quote:", error);
    return NextResponse.json(
      { error: "Failed to update quote" },
      { status: 500 }
    );
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
      console.error("Failed to create activity log:", error);
    });

    // 견적 삭제
    await db.quote.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting quote:", error);
    return NextResponse.json(
      { error: "Failed to delete quote" },
      { status: 500 }
    );
  }
}

