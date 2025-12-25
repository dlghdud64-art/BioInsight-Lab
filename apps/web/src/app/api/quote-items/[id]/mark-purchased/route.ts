import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 구매 완료 처리
export async function POST(
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
    const { isPurchased } = body;

    // QuoteListItem 찾기
    const quoteItem = await db.quoteListItem.findUnique({
      where: { id },
      include: {
        quote: true,
        product: true,
      },
    });

    if (!quoteItem) {
      return NextResponse.json({ error: "Quote item not found" }, { status: 404 });
    }

    // 권한 확인 (사용자가 소유한 quote인지)
    if (quoteItem.quote.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 구매 완료 상태 업데이트
    const updated = await db.quoteListItem.update({
      where: { id },
      data: { isPurchased: isPurchased === true },
      include: {
        product: {
          include: {
            vendors: {
              include: {
                vendor: true,
              },
            },
          },
        },
      },
    });

    // 구매 완료 시 PurchaseRecord 생성
    if (isPurchased === true && updated) {
      try {
        // 조직 ID 가져오기
        let organizationId = quoteItem.quote.organizationId || null;
        if (!organizationId) {
          const userOrg = await db.organizationMember.findFirst({
            where: { userId: session.user.id },
            select: { organizationId: true },
          });
          organizationId = userOrg?.organizationId || null;
        }

        // 제품의 첫 번째 벤더 정보 가져오기
        const productVendor = updated.product?.vendors?.[0];
        const vendorId = productVendor?.vendorId || null;

        // PurchaseRecord 생성
        await db.purchaseRecord.create({
          data: {
            organizationId,
            quoteId: quoteItem.quoteId,
            vendorId,
            productId: updated.productId,
            purchaseDate: new Date(),
            quantity: updated.quantity || 1,
            unitPrice: updated.unitPrice || 0,
            currency: updated.currency || "KRW",
            totalAmount: updated.lineTotal || updated.unitPrice || 0,
            category: updated.product?.category || null,
            notes: updated.notes || null,
            importedBy: session.user.id,
          },
        });
      } catch (error) {
        console.error("Error creating purchase record:", error);
        // PurchaseRecord 생성 실패해도 구매 완료 처리는 성공으로 간주
      }
    }

    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    console.error("Error marking item as purchased:", error);
    return NextResponse.json(
      { error: "Failed to mark item as purchased" },
      { status: 500 }
    );
  }
}




