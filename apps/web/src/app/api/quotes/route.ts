import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createQuote } from "@/lib/api/quotes";
import { sendQuoteConfirmationToUser, sendQuoteNotificationToVendors, sendQuoteReceivedEmail } from "@/lib/email";
import { db, isPrismaAvailable } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import { createActivityLogServer } from "@/lib/api/activity-logs";
import { ActivityType } from "@prisma/client";
import { generateShareToken } from "@/lib/api/share-token";

// 견적 요청 생성
export async function POST(request: NextRequest) {
  // body와 session을 try 블록 밖에서 선언하여 catch 블록에서도 접근 가능하도록 수정
  let body: any = {};
  let session: any = null;
  try {
    session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    body = await request.json();
    const {
      title,
      message,
      vendorMessages, // 벤더별 개별 메시지: { [vendorId]: string }
      deliveryDate,
      deliveryLocation,
      specialNotes,
      items, // 새로운 형식: [{ productId, vendorId, quantity, notes }]
      productIds, // 기존 형식 (하위 호환성)
      quantities,
      notes,
      organizationId: clientOrganizationId,
    } = body;

    // 서버 세션 기반 organizationId 결정 (클라이언트 값 직접 신뢰 금지 → P2003 방지)
    let serverOrgId: string | null = null;
    const clientOrgId = (typeof clientOrganizationId === "string" ? clientOrganizationId.trim() : null) || null;
    if (clientOrgId) {
      // findUnique with compound key 대신 findFirst 사용 (db가 any 타입 → 런타임 안전성 확보)
      const membership = await db.organizationMember.findFirst({
        where: { userId: session.user.id, organizationId: clientOrgId },
        select: { organizationId: true },
      });
      serverOrgId = membership?.organizationId ?? null;
      if (!serverOrgId) {
        console.warn(
          `[quotes/POST] organizationId 검증 실패: 클라이언트 값(${clientOrgId})으로 사용자(${session.user.id}) 멤버십 없음.`
        );
      }
    }
    if (!serverOrgId) {
      const firstMembership = await db.organizationMember.findFirst({
        where: { userId: session.user.id },
        orderBy: { createdAt: "asc" },
        select: { organizationId: true },
      });
      serverOrgId = firstMembership?.organizationId ?? null;
    }

    // items가 있으면 새로운 형식, 없으면 기존 형식
    const quoteItems = items || (productIds ? productIds.map((pid: string, idx: number) => ({
      productId: pid,
      vendorId: null, // 기존 형식은 vendorId 없음
      quantity: quantities?.[pid] || 1,
      notes: notes?.[pid] || "",
    })) : []);

    if (!title || quoteItems.length === 0) {
      return NextResponse.json(
        { error: "Title and items are required" },
        { status: 400 }
      );
    }

    // 벤더별로 그룹화
    const vendorGroups = new Map<string, typeof quoteItems>();
    quoteItems.forEach((item: any) => {
      const vendorId = item.vendorId || "unknown";
      if (!vendorGroups.has(vendorId)) {
        vendorGroups.set(vendorId, []);
      }
      vendorGroups.get(vendorId)!.push(item);
    });

    // 각 벤더별로 견적 생성
    const quotes = [];
    for (const [vendorId, items] of vendorGroups.entries()) {
      const productIds = items.map((item: any) => item.productId);
      const quantities = Object.fromEntries(items.map((item: any) => [item.productId, item.quantity || 1]));
      const itemNotes = Object.fromEntries(items.map((item: any) => [item.productId, item.notes || ""]));
      const vendorIds = Object.fromEntries(items.map((item: any) => [item.productId, item.vendorId]).filter(([_, vid]: [string, any]) => vid));
      
      // 벤더별 제목 생성
      const vendorTitle = vendorId !== "unknown" 
        ? `${title} (${items.length}건)`
        : title;

      // 벤더별 메시지 생성 (개별 메시지가 있으면 우선 사용)
      const vendorProductCount = items.length;
      const vendorTotalAmount = items.reduce((sum: number, item: any) => sum + (item.lineTotal || 0), 0);
      
      let vendorMessage = "";
      if (vendorMessages && vendorMessages[vendorId]) {
        // 벤더별 개별 메시지가 있으면 사용 (이미 공통 메시지와 합쳐져 있음)
        vendorMessage = vendorMessages[vendorId];
        // 품목 정보 추가
        vendorMessage += `\n\n품목 수: ${vendorProductCount}개\n예상 금액: ₩${vendorTotalAmount.toLocaleString("ko-KR")}`;
      } else if (message) {
        // 공통 메시지만 있는 경우
        vendorMessage = message.replace(/\d+건/g, `${vendorProductCount}건`)
                 .replace(/품목 수: \d+개/g, `품목 수: ${vendorProductCount}개`)
                 .replace(/예상 금액: ₩[\d,]+/g, `예상 금액: ₩${vendorTotalAmount.toLocaleString("ko-KR")}`)
                 .replace(/예상 총액: ₩[\d,]+/g, `예상 금액: ₩${vendorTotalAmount.toLocaleString("ko-KR")}`);
      } else {
        // 기본 메시지
        vendorMessage = `안녕하세요.\n\n아래 품목 ${vendorProductCount}건에 대한 견적을 요청드립니다.\n\n품목 수: ${vendorProductCount}개\n예상 금액: ₩${vendorTotalAmount.toLocaleString("ko-KR")}\n\n빠른 견적 부탁드립니다.\n감사합니다.`;
      }

      const quote = await createQuote({
        userId: session.user.id,
        organizationId: serverOrgId ?? undefined,
        title: vendorTitle,
        message: vendorMessage,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : undefined,
        deliveryLocation,
        specialNotes,
        productIds,
        quantities,
        notes: itemNotes,
        vendorIds,
      });
      
      quotes.push(quote);
    }

    // 첫 번째 견적을 메인으로 사용 (하위 호환성)
    const quote = quotes[0];

    // 관련 벤더 이메일 수집
    const vendorIds = Array.from(vendorGroups.keys()).filter(id => id !== "unknown");
    const productVendors = await db.productVendor.findMany({
      where: {
        vendorId: {
          in: vendorIds,
        },
        productId: {
          in: quoteItems.map((item: any) => item.productId),
        },
      },
      include: {
        vendor: true,
      },
    });

    const vendorEmails = Array.from(
      new Set(
        productVendors
          .map((pv: any) => pv.vendor.email)
          .filter((email: any): email is string => !!email)
      )
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
    // 1. 기존 SendGrid 기반 이메일 (하위 호환성)
    Promise.all([
      sendQuoteConfirmationToUser(
        session.user.email || "",
        session.user.name || "사용자",
        quote.title,
        quote.id
      ),
      vendorEmails.length > 0 && sendQuoteNotificationToVendors(vendorEmails as string[], quote.title, quote.id),
    ]).catch((error) => {
      console.error("Failed to send quote emails (SendGrid):", error);
    });

    // 2. 새로운 Resend + React Email 기반 이메일 발송
    const totalAmount = quoteItems.reduce((sum: number, item: any) => sum + (item.lineTotal || 0), 0);
    sendQuoteReceivedEmail({
      to: session.user.email || "",
      customerName: session.user.name || "고객",
      quoteNumber: quote.id.slice(-8).toUpperCase(),
      requestDate: new Date().toLocaleDateString("ko-KR"),
      itemCount: quoteItems.length,
      totalAmount: totalAmount > 0 ? `₩${totalAmount.toLocaleString("ko-KR")}` : undefined,
    }).catch((error) => {
      console.error("Failed to send quote received email (Resend):", error);
    });

    // 액티비티 로그 기록 (비동기, 실패해도 견적은 생성됨)
    const ipAddress = request.headers.get("x-forwarded-for") || 
                     request.headers.get("x-real-ip") || 
                     undefined;
    const userAgent = request.headers.get("user-agent") || undefined;
    
    createActivityLogServer({
      db,
      activityType: ActivityType.QUOTE_CREATED,
      entityType: "quote",
      entityId: quote.id,
      userId: session.user.id,
      organizationId: serverOrgId || quote.organizationId || undefined,
      metadata: {
        title: quote.title,
        itemCount: quote.items?.length || 0,
        totalAmount: quote.items?.reduce((sum: number, item: any) => sum + (item.lineTotal || 0), 0) || 0,
      },
      ipAddress,
      userAgent,
    }).catch((error) => {
      console.error("Failed to create activity log:", error);
    });

    // 견적 생성 성공 후 공유 링크 자동 생성 (비동기 실패 허용)
    let shareToken: string | null = null;
    let shareUrl: string | null = null;
    try {
      const token = generateShareToken();
      const share = await db.quoteShare.create({
        data: {
          quoteId: quote.id,
          shareToken: token,
          enabled: true,
        },
      });
      shareToken = share.shareToken;
      shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/share/${share.shareToken}`;
    } catch (shareErr) {
      // 공유 링크 생성 실패는 견적 생성 자체를 실패로 처리하지 않음
      console.error("[quotes/POST] QuoteShare 생성 실패 (견적은 정상 생성됨):", shareErr);
    }

    return NextResponse.json({ quote, shareToken, shareUrl }, { status: 201 });
  } catch (error: any) {
    // 상세 에러 로깅 (Prisma 에러 코드/메타 포함)
    console.error("[quotes/POST] Error creating quote:", {
      message: error?.message,
      code: error?.code,          // Prisma: P2002, P2003 등
      meta: error?.meta,          // Prisma: 실패 필드명 등
      stack: error?.stack,
    });

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

    // 클라이언트에 의미있는 에러 메시지 반환
    let clientMessage = "견적 생성에 실패했습니다.";
    if (error?.code === "P2003" || error?.message?.includes("Foreign key")) {
      clientMessage = "존재하지 않는 제품 또는 조직 정보가 포함되어 있습니다.";
    } else if (error?.code === "P2002") {
      clientMessage = "이미 동일한 견적이 존재합니다.";
    } else if (error?.message?.includes("organizationId") || error?.message?.includes("userId")) {
      clientMessage = "조직 또는 사용자 정보가 올바르지 않습니다.";
    } else if (error?.message?.includes("No valid products")) {
      clientMessage = error.message;
    }

    return NextResponse.json(
      {
        error: clientMessage,
        // 디버깅용: 실제 에러 메시지 포함 (추후 확인 후 제거)
        _debug: { message: error?.message, code: error?.code },
      },
      { status: 500 }
    );
  }
}

// 사용자의 견적 목록 조회