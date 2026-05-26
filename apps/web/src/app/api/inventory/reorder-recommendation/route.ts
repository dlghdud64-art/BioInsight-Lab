/**
 * §11.310b #reorder-recommendation-api — 재발주 추천 데이터 집계 endpoint.
 *
 * 호영님 P1 spec (Q32 = A, 2026-05-26):
 *   재고 운영 도우미 → 재발주안 검토 바텀시트의 "추천 벤더" + "최근 구매" 영역.
 *   PurchaseRecord 집계 (최근 3개월 해당 품목) — 신규 API/lib 없이 기존 모델
 *   에서 직접 Prisma raw query.
 *
 * 입력:
 *   GET /api/inventory/reorder-recommendation?productName=<name>
 *
 * 응답:
 *   {
 *     vendors: [
 *       { vendorName, unitPrice, lastPurchasedAt, count }  // 최대 3, recent 순
 *     ],
 *     recentPurchases: [
 *       { poNumber, purchasedAt, quantity, unitPrice }     // 최대 3, recent 순
 *     ]
 *   }
 *
 * 매칭:
 *   - itemName insensitive contains productName
 *   - purchasedAt >= now() - 3 months
 *   - scopeKey 격리 (caller 의 guestKey 또는 workspaceId)
 *
 * §11.309c 패턴 정합 (auth + db + 단순화):
 *   - auth() 만 (enforceAction 미사용, Q33 정합)
 *   - guestKey 기반 scopeKey derive (기존 PurchaseRecord 패턴)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/mobile-jwt";

export interface ReorderVendorSuggestion {
  vendorName: string;
  unitPrice: number;
  lastPurchasedAt: string;
  count: number;
}

export interface ReorderRecentPurchase {
  poNumber: string;
  purchasedAt: string;
  quantity: number;
  unitPrice: number;
}

export interface ReorderRecommendationResponse {
  vendors: ReorderVendorSuggestion[];
  recentPurchases: ReorderRecentPurchase[];
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const user = await getAuthUser(session as Parameters<typeof getAuthUser>[0], request);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const productName = (searchParams.get("productName") ?? "").trim();

    if (!productName) {
      return NextResponse.json(
        { error: "productName 은 필수입니다." },
        { status: 400 },
      );
    }

    // §11.310b — scopeKey: user.id (guest key 또는 user 직접 매칭).
    // 추후 workspace scope 분리 시 추가 logic. MVP 는 userId scopeKey 만.
    const scopeKey = user.id;

    // §11.310b — 최근 3개월 = now - 90 days
    const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // ── 최근 구매 list (최대 3, purchasedAt desc) ──
    const recentRecords = await db.purchaseRecord.findMany({
      where: {
        scopeKey,
        itemName: { contains: productName, mode: "insensitive" },
        purchasedAt: { gte: threeMonthsAgo },
      },
      orderBy: { purchasedAt: "desc" },
      take: 3,
      select: {
        id: true,
        purchasedAt: true,
        vendorName: true,
        qty: true,
        unitPrice: true,
        amount: true,
        quoteId: true,
      },
    });

    const recentPurchases: ReorderRecentPurchase[] = recentRecords.map((r: {
      id: string;
      purchasedAt: Date;
      vendorName: string | null;
      qty: number;
      unitPrice: number | null;
      amount: number;
      quoteId: string | null;
    }) => ({
      // PO 번호 — quoteId 있으면 그 ID, 없으면 record id (단축)
      poNumber: r.quoteId ?? r.id.slice(0, 8).toUpperCase(),
      purchasedAt: r.purchasedAt.toISOString(),
      quantity: r.qty,
      unitPrice: r.unitPrice ?? Math.floor(r.amount / Math.max(r.qty, 1)),
    }));

    // ── 추천 벤더 (groupBy vendorName, 최근 구매 순 + 단가 평균/최근) ──
    // Prisma groupBy 로 vendor 별 count + 최근 purchasedAt
    const vendorGroups = await db.purchaseRecord.groupBy({
      by: ["vendorName"],
      where: {
        scopeKey,
        itemName: { contains: productName, mode: "insensitive" },
        purchasedAt: { gte: threeMonthsAgo },
      },
      _count: { _all: true },
      _max: { purchasedAt: true, unitPrice: true },
      orderBy: { _max: { purchasedAt: "desc" } },
      take: 3,
    });

    const vendors: ReorderVendorSuggestion[] = vendorGroups.map((g: {
      vendorName: string | null;
      _count: { _all: number };
      _max: { purchasedAt: Date | null; unitPrice: number | null };
    }) => ({
      vendorName: g.vendorName,
      unitPrice: g._max.unitPrice ?? 0,
      lastPurchasedAt: g._max.purchasedAt?.toISOString() ?? "",
      count: g._count._all,
    }));

    const response: ReorderRecommendationResponse = {
      vendors,
      recentPurchases,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[ReorderRecommendation/GET]", error);
    return NextResponse.json(
      { error: "재발주 추천 데이터 조회에 실패했습니다." },
      { status: 500 },
    );
  }
}
