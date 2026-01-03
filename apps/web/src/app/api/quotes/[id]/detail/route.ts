import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// =====================================================
// 공급자(우리 회사) 정보
// =====================================================

const SUPPLIER_INFO = {
  companyName: "BioInsight Lab",
  businessNumber: "123-45-67890",
  representative: "대표자명",
  address: "서울특별시 강남구 테헤란로 123",
  phone: "02-1234-5678",
  email: "sales@bioinsightlab.com",
  website: "https://bioinsightlab.com",
};

// =====================================================
// GET /api/quotes/[id]/detail
// 견적서 상세 조회 API (공식 견적서 형식)
//
// [Response Data]
// - supplier: 공급자 정보 (우리 회사)
// - customer: 수요자 정보 (유저)
// - quote: 견적 기본 정보
// - items: 품목 리스트
// - totals: 합계, 부가세, 총액
// =====================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. 인증 검증
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "인증이 필요합니다.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // 2. 견적 조회
    const quote = await db.quote.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            productId: true,
            productName: true,
            brand: true,
            catalogNumber: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
            notes: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            organization: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!quote) {
      return NextResponse.json(
        { error: "견적을 찾을 수 없습니다.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // 3. 권한 검증 (본인 또는 조직 멤버)
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
      return NextResponse.json(
        { error: "이 견적에 대한 접근 권한이 없습니다.", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    // 4. 금액 계산
    const subtotal = quote.totalAmount || 0;
    const vatRate = 0.1; // 10% 부가세
    const vatAmount = Math.round(subtotal * vatRate);
    const grandTotal = subtotal + vatAmount;

    // 5. 유효기간 체크
    const now = new Date();
    const isExpired = quote.validUntil ? quote.validUntil < now : false;
    const daysUntilExpiry = quote.validUntil
      ? Math.ceil((quote.validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // 6. 응답 구성
    return NextResponse.json({
      success: true,
      data: {
        // 공급자 정보 (우리 회사)
        supplier: SUPPLIER_INFO,

        // 수요자 정보 (고객)
        customer: {
          name: quote.user?.name || "미등록",
          email: quote.user?.email || "",
          organization: quote.user?.organization || quote.organization?.name || "",
          userId: quote.user?.id,
        },

        // 견적 기본 정보
        quote: {
          id: quote.id,
          quoteNumber: quote.quoteNumber,
          title: quote.title,
          description: quote.description,
          status: quote.status,
          currency: quote.currency,
          createdAt: quote.createdAt,
          updatedAt: quote.updatedAt,
          validUntil: quote.validUntil,
          isExpired,
          daysUntilExpiry,
        },

        // 품목 리스트
        items: quote.items.map((item, index) => ({
          seq: index + 1,
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          brand: item.brand || "-",
          catalogNumber: item.catalogNumber || "-",
          quantity: item.quantity,
          unit: "EA",
          unitPrice: item.unitPrice || 0,
          lineTotal: item.lineTotal || 0,
          notes: item.notes,
        })),

        // 합계 정보
        totals: {
          subtotal, // 공급가액 (부가세 제외)
          vatRate: `${vatRate * 100}%`,
          vatAmount, // 부가세
          grandTotal, // 총액 (부가세 포함)
          currency: quote.currency || "KRW",
          itemCount: quote.items.length,
        },

        // 메타 정보
        meta: {
          printedAt: null, // 출력 시점 (프론트에서 설정)
          version: quote.version || 1,
        },
      },
    });

  } catch (error) {
    console.error("[Quotes/Detail] Error:", error);
    return NextResponse.json(
      { error: "견적 상세 조회 중 오류가 발생했습니다.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
