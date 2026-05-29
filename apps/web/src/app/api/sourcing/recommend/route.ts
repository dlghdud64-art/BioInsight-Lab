/**
 * GET /api/sourcing/recommend?productId=<id>
 *
 * §11.318 Phase 1c — 대체품/벤더 추천 API.
 *
 * 결정(호영님 2026-05-29):
 *   - 1차 데이터 = PurchaseRecord(실거래) only → 환각 0.
 *   - 납기 = QuoteListItem.leadTime 파싱 best-effort.
 *     없으면 leadTimeDays=null + source="unknown"("미확인", 지어내기 0).
 *   - 데이터 없으면 hasData=false, 빈 상태 + 견적 유도. 추정 전략 미생성.
 *
 * ⚠️ 환각 차단: 이 API 는 PurchaseRecord 실거래만 집계. 없으면 빈 상태.
 *   AI 추정치·자유 텍스트 전략·근거 없는 가격·납기 생성 금지.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/mobile-jwt";
import {
  buildSourcingRecommendation,
  type PurchaseRecordLike,
  type LeadTimeIndex,
  type RecommendTarget,
} from "@/lib/compare-workspace/sourcing-recommendation";

/** QuoteListItem.leadTime 문자열에서 숫자(일) 추출. 불가시 null. */
function parseLeadTimeDays(leadTime: string | null): number | null {
  if (!leadTime) return null;
  const m = leadTime.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const user = await getAuthUser(session as Parameters<typeof getAuthUser>[0], request);
    if (!user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const productId = (searchParams.get("productId") ?? "").trim();

    if (!productId) {
      return NextResponse.json({ error: "productId 는 필수입니다." }, { status: 400 });
    }

    // ── 1. Product 조회 → RecommendTarget 구성 ──
    const product = await db.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        catalogNumber: true,
        category: true, // ProductCategory enum → toString()
      },
    });

    if (!product) {
      return NextResponse.json({ error: "제품을 찾을 수 없습니다." }, { status: 404 });
    }

    const categoryStr = product.category ? product.category.toString() : null;

    const target: RecommendTarget = {
      catalogNumber: product.catalogNumber ?? null,
      itemName: product.name,
      category: categoryStr,
    };

    // ── 2. PurchaseRecord 조회 (scopeKey = user.id, 같은 카테고리/itemName/catalogNumber) ──
    //   같은 catalogNumber(정확 매칭) + itemName 포함 + 같은 category 전체 → 대체품 후보 포함.
    const scopeKey = user.id;

    const orConditions: object[] = [
      // itemName 포함 (본 제품 + 유사품)
      { itemName: { contains: product.name, mode: "insensitive" } },
    ];
    if (product.catalogNumber) {
      orConditions.push({
        catalogNumber: { equals: product.catalogNumber, mode: "insensitive" },
      });
    }
    if (categoryStr) {
      orConditions.push({
        category: { equals: categoryStr, mode: "insensitive" },
      });
    }

    const rawRecords = await db.purchaseRecord.findMany({
      where: { scopeKey, OR: orConditions },
      orderBy: { purchasedAt: "desc" },
      take: 200, // 최대 200건 (코어 함수가 벤더별 그룹핑)
      select: {
        vendorName: true,
        itemName: true,
        catalogNumber: true,
        category: true,
        unitPrice: true,
        amount: true,
        qty: true,
        unit: true,
        currency: true,
        purchasedAt: true,
        quoteId: true,
      },
    });

    // ── 3. LeadTimeIndex 구성 (quoteId → QuoteListItem.leadTime 파싱) ──
    const quoteIds = [
      ...new Set(
        rawRecords
          .map((r: { quoteId: string | null }) => r.quoteId)
          .filter((id): id is string => !!id),
      ),
    ];

    const leadTimeIndex: LeadTimeIndex = {};

    if (quoteIds.length > 0) {
      const quoteItems = await db.quoteListItem.findMany({
        where: { quoteId: { in: quoteIds } },
        select: { quoteId: true, leadTime: true },
      });
      for (const qi of quoteItems) {
        if (qi.quoteId && !(qi.quoteId in leadTimeIndex)) {
          // null 도 명시 저장 (파싱 시도 기록, 이후 lookp 시 "quote" source 유지)
          leadTimeIndex[qi.quoteId] = parseLeadTimeDays(qi.leadTime ?? null);
        }
      }
    }

    // ── 4. 추천 코어 (순수 함수) ──
    const records: PurchaseRecordLike[] = rawRecords.map((r: {
      vendorName: string | null;
      itemName: string;
      catalogNumber: string | null;
      category: string | null;
      unitPrice: number | null;
      amount: number;
      qty: number;
      unit: string | null;
      currency: string;
      purchasedAt: Date;
      quoteId: string | null;
    }) => ({
      vendorName: r.vendorName ?? "미상",
      itemName: r.itemName,
      catalogNumber: r.catalogNumber,
      category: r.category,
      unitPrice: r.unitPrice,
      amount: r.amount,
      qty: r.qty,
      unit: r.unit,
      currency: r.currency,
      purchasedAt: r.purchasedAt.toISOString(),
      quoteId: r.quoteId,
    }));

    const recommendation = buildSourcingRecommendation(records, target, leadTimeIndex);

    return NextResponse.json({
      success: true,
      productId,
      productName: product.name,
      dataSource: recommendation.dataSource,
      // 출처 badge 라벨 — 클라이언트에서 "과거 구매 기록 기반" 뱃지로 표시
      sourceLabel: "과거 구매 기록 기반",
      recommendation,
    });
  } catch (error) {
    console.error("[sourcing/recommend] Error:", error);
    return NextResponse.json(
      { error: "추천 데이터 조회 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
