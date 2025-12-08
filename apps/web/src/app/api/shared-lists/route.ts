import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, isPrismaAvailable } from "@/lib/db";
import { randomBytes } from "crypto";
import { getAppUrl, isDemoMode } from "@/lib/env";

// 공유 링크 생성
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { quoteId, title, description, expiresInDays } = body;

    // expiresInDays가 0이면 만료 없음 (null)
    const expiresAtValue = expiresInDays && expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    if (!quoteId || !title) {
      return NextResponse.json(
        { error: "quoteId and title are required" },
        { status: 400 }
      );
    }

    // QuoteList 확인
    const quote = await db.quote.findUnique({
      where: { id: quoteId },
      include: {
        items: {
          include: {
            product: {
              include: {
                vendors: {
                  include: {
                    vendor: true,
                  },
                  orderBy: {
                    priceInKRW: "asc",
                  },
                  take: 3, // 최대 3개 벤더 (비교용)
                },
                recommendations: {
                  include: {
                    recommended: {
                      include: {
                        vendors: {
                          include: {
                            vendor: true,
                          },
                          take: 1,
                        },
                      },
                    },
                  },
                  take: 2, // 각 제품당 최대 2개 대체 후보
                },
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!quote) {
      return NextResponse.json(
        { error: "QuoteList not found" },
        { status: 404 }
      );
    }

    // 권한 확인 (본인 또는 조직 멤버)
    if (quote.userId !== session.user.id) {
      const isOrgMember = await db.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationId: quote.organizationId || undefined,
        },
      });

      if (!isOrgMember) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403 }
        );
      }
    }

    // 공유 링크 생성 (난수 토큰)
    const publicId = randomBytes(16).toString("base64url");

    // 만료일 계산
    // expiresInDays가 제공되면 사용, 없으면 기본 30일
    // expiresInDays가 0이면 만료 없음
    const defaultExpiresInDays = 30;
    const expiresAt = expiresAtValue !== undefined
      ? expiresAtValue
      : expiresInDays !== undefined && expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + defaultExpiresInDays * 24 * 60 * 60 * 1000);

    // 스냅샷 데이터 생성
    const snapshot = {
      title: quote.title,
      description: quote.description,
      createdAt: quote.createdAt,
      // 타입 에러 수정: item 파라미터에 타입 명시
      items: quote.items.map((item: any) => ({
        lineNumber: item.lineNumber,
        productName: item.product.name,
        productBrand: item.product.brand,
        catalogNumber: item.product.catalogNumber,
        specification: item.product.specification,
        grade: item.product.grade,
        vendorName: item.vendorName,
        unitPrice: item.unitPrice,
        currency: item.currency,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
        notes: item.notes,
        // 비교 정보: 다른 벤더 가격
        alternativeVendors: item.product.vendors
          // 타입 에러 수정: v 파라미터에 타입 명시
          .filter((v: any) => v.vendor?.name !== item.vendorName)
          .slice(0, 2)
          .map((v: any) => ({
            vendorName: v.vendor?.name,
            price: v.priceInKRW,
            currency: v.currency,
          })),
        // 대체 후보 제품
        alternativeProducts: item.product.recommendations
          .slice(0, 2)
          .map((rec) => ({
            productName: rec.recommended.name,
            productBrand: rec.recommended.brand,
            price: rec.recommended.vendors?.[0]?.priceInKRW,
            currency: rec.recommended.vendors?.[0]?.currency || "KRW",
            reason: rec.reason,
            score: rec.score,
          })),
      })),
      createdBy: {
        id: quote.user.id,
        name: quote.user.name,
        email: quote.user.email,
      },
      // 전체 비교 요약
      comparisonSummary: {
        totalItems: quote.items.length,
        totalAmount: quote.items.reduce((sum, item) => sum + (item.lineTotal || 0), 0),
        vendors: Array.from(
          new Set(
            quote.items
              .map((item) => item.product.vendors.map((v) => v.vendor?.name).filter(Boolean))
              .flat()
          )
        ).slice(0, 5),
        hasAlternatives: quote.items.some(
          (item) =>
            item.product.recommendations.length > 0 ||
            item.product.vendors.length > 1
        ),
      },
    };

    // SharedList 생성
    const sharedList = await db.sharedList.create({
      data: {
        quoteId: quote.id,
        publicId,
        title: title || quote.title,
        description: description || quote.description,
        snapshot: snapshot as any,
        createdBy: session.user.id,
        expiresAt,
        isActive: true,
      },
    });

    return NextResponse.json({
      id: sharedList.id,
      publicId: sharedList.publicId,
      shareUrl: `${getAppUrl()}/share/${sharedList.publicId}`,
      expiresAt: sharedList.expiresAt,
    });
  } catch (error) {
    console.error("Error creating shared list:", error);
    
    // 데모 모드에서는 더미 응답 반환
    if (isDemoMode() || !isPrismaAvailable) {
      const demoPublicId = `demo-${randomBytes(8).toString("hex")}`;
      return NextResponse.json({
        id: `demo-${Date.now()}`,
        publicId: demoPublicId,
        shareUrl: `${getAppUrl()}/share/${demoPublicId}`,
        expiresAt: expiresAtValue,
        demo: true,
        message: "데모 환경에서는 실제 저장되지 않습니다.",
      });
    }
    
    return NextResponse.json(
      { error: "Failed to create shared list" },
      { status: 500 }
    );
  }
}