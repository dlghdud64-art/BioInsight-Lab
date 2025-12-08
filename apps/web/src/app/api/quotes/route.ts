import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createQuote } from "@/lib/api/quotes";
import { sendQuoteConfirmationToUser, sendQuoteNotificationToVendors } from "@/lib/email";
import { db, isPrismaAvailable } from "@/lib/db";
import { isDemoMode } from "@/lib/env";

// 견적 요청 생성
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      message,
      deliveryDate,
      deliveryLocation,
      specialNotes,
      productIds,
      quantities,
      notes,
      organizationId,
    } = body;

    if (!title || !productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: "Title and productIds are required" },
        { status: 400 }
      );
    }

    // 견적 생성
    const quote = await createQuote({
      userId: session.user.id,
      organizationId,
      title,
      message,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
      deliveryLocation,
      specialNotes,
      productIds,
      quantities,
      notes,
    });

    // 관련 벤더 이메일 수집
    const productVendors = await db.productVendor.findMany({
      where: {
        productId: {
          in: productIds,
        },
      },
      include: {
        vendor: true,
      },
    });

    const vendorEmails = Array.from(
      new Set(
        productVendors
          // 타입 에러 수정: pv 파라미터에 타입 명시
          .map((pv: any) => pv.vendor.email)
          // 타입 에러 수정: email 파라미터에 타입 명시
          .filter((email: any): email is string => !!email)
      )
    );

    const vendorIds = Array.from(
      // 타입 에러 수정: pv 파라미터에 타입 명시
      new Set(productVendors.map((pv: any) => pv.vendor.id))
    );

    // 리드당 과금 처리 (비동기, 실패해도 견적은 생성됨)
    if (vendorIds.length > 0) {
      fetch("/api/vendor/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: quote.id,
          vendorIds,
        }),
      }).catch((error) => {
        console.error("Failed to process billing:", error);
      });
    }

    // 이메일 발송 (비동기, 실패해도 견적은 생성됨)
    Promise.all([
      sendQuoteConfirmationToUser(
        session.user.email || "",
        session.user.name || "사용자",
        quote.title,
        quote.id
      ),
      vendorEmails.length > 0 && sendQuoteNotificationToVendors(vendorEmails as string[], quote.title, quote.id),
    ]).catch((error) => {
      console.error("Failed to send quote emails:", error);
    });

    return NextResponse.json({ quote }, { status: 201 });
  } catch (error) {
    console.error("Error creating quote:", error);
    
    // 데모 모드에서는 더미 응답 반환
    if (isDemoMode() || !isPrismaAvailable) {
      return NextResponse.json({
        quote: {
          id: `demo-${Date.now()}`,
          title: body.title || "Demo Quote",
          userId: session?.user?.id || "demo-user",
          createdAt: new Date().toISOString(),
          demo: true,
        },
        message: "데모 환경에서는 실제 저장되지 않습니다.",
      }, { status: 201 });
    }
    
    return NextResponse.json(
      { error: "Failed to create quote" },
      { status: 500 }
    );
  }
}

// 사용자의 견적 목록 조회