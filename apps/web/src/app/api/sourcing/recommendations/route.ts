/**
 * POST /api/sourcing/recommendations  — §11.318 Phase 1c
 *
 * 제품 1개 → 내부 PurchaseRecord(실거래) 기반 대체품/벤더 추천.
 * 환각 0: 근거(실거래) 없으면 빈 산출. 추정 전략 텍스트 생성 안 함.
 *
 * 납기(호영님 Q3 ⓑ+ⓐ): PurchaseRecord.quoteId → Quote.items(QuoteListItem).leadTime
 *   파싱 가능 시 number, 아니면 null + "unknown"("미확인"). 지어내지 않음.
 *
 * 카테고리 공간 정합: Product.category(enum) ≠ PurchaseRecord.category(자유 문자열).
 *   같은 제품 구매 이력의 category(자유 문자열)를 기준으로 대체품을 같은 공간에서 매칭.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import {
  buildSourcingRecommendation,
  type PurchaseRecordLike,
  type LeadTimeIndex,
} from "@/lib/compare-workspace/sourcing-recommendation";

export const runtime = "nodejs";

/** "5일" / "2~3영업일" / "3 days" → 첫 정수. 파싱 불가 시 null(지어내기 0). */
function parseLeadTimeDays(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = String(s).match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { productId } = body as { productId?: string };
    if (!productId) {
      return NextResponse.json({ error: "productId 가 필요합니다." }, { status: 400 });
    }

    const product = await db.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, catalogNumber: true, category: true },
    });
    if (!product) {
      return NextResponse.json({ error: "제품을 찾을 수 없습니다." }, { status: 404 });
    }

    // ── scope (purchases route 패턴 정합) ──
    const memberships = await db.workspaceMember.findMany({
      where: { userId: session.user.id },
      select: { workspaceId: true },
    });
    const workspaceIds = memberships.map((m: { workspaceId: string }) => m.workspaceId);
    const guestKey = req.headers.get("x-guest-key");
    const scopeKeyValues: string[] = [
      session.user.id,
      ...workspaceIds,
      ...(guestKey ? [guestKey] : []),
    ];
    const scopeWhere = {
      OR: [
        { scopeKey: { in: scopeKeyValues } },
        ...(workspaceIds.length > 0 ? [{ workspaceId: { in: workspaceIds } }] : []),
      ],
    };

    const selectFields = {
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
    } as const;

    // ── 1) 같은 제품 구매 이력 (catalogNumber 정확 / itemName) ──
    const sameProductWhere: any = {
      AND: [
        scopeWhere,
        {
          OR: [
            ...(product.catalogNumber
              ? [{ catalogNumber: { equals: product.catalogNumber, mode: "insensitive" } }]
              : []),
            { itemName: { equals: product.name, mode: "insensitive" } },
          ],
        },
      ],
    };
    const sameRows = await db.purchaseRecord.findMany({
      where: sameProductWhere,
      select: selectFields,
      orderBy: { purchasedAt: "desc" },
      take: 200,
    });

    // ── 2) 대체품: 구매 이력 category(자유 문자열) 기준 동일 카테고리 ──
    //    Product.category(enum) 가 아니라 실거래 category 공간에서 매칭(정합).
    const historyCategory =
      sameRows.map((r: { category: string | null }) => r.category).find((c: string | null): c is string => !!c) ?? null;

    let subRows: typeof sameRows = [];
    if (historyCategory) {
      subRows = await db.purchaseRecord.findMany({
        where: {
          AND: [
            scopeWhere,
            { category: { equals: historyCategory, mode: "insensitive" } },
          ],
        },
        select: selectFields,
        orderBy: { purchasedAt: "desc" },
        take: 200,
      });
    }

    // ── 납기 index: quoteId → days|null (QuoteListItem.leadTime 파싱) ──
    const allRows = [...sameRows, ...subRows];
    const quoteIds = Array.from(
      new Set(allRows.map((r: { quoteId: string | null }) => r.quoteId).filter((q: string | null): q is string => !!q)),
    );
    const leadTimeIndex: LeadTimeIndex = {};
    if (quoteIds.length > 0) {
      const items = await db.quoteListItem.findMany({
        where: {
          quoteId: { in: quoteIds },
          OR: [
            { productId: product.id },
            { name: { equals: product.name, mode: "insensitive" } },
          ],
        },
        select: { quoteId: true, leadTime: true },
      });
      for (const it of items) {
        if (leadTimeIndex[it.quoteId] == null) {
          leadTimeIndex[it.quoteId] = parseLeadTimeDays(it.leadTime);
        }
      }
    }

    // dedupe (sameRows ∪ subRows) → PurchaseRecordLike
    const seen = new Set<string>();
    const records: PurchaseRecordLike[] = [];
    for (const r of allRows) {
      const key = `${r.vendorName}|${r.catalogNumber}|${r.itemName}|${r.purchasedAt.toISOString()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      records.push({
        vendorName: r.vendorName,
        itemName: r.itemName,
        catalogNumber: r.catalogNumber,
        category: r.category,
        unitPrice: r.unitPrice ?? null,
        amount: r.amount,
        qty: r.qty,
        unit: r.unit,
        currency: r.currency,
        purchasedAt: r.purchasedAt.toISOString(),
        quoteId: r.quoteId,
      });
    }

    const target = {
      catalogNumber: product.catalogNumber ?? null,
      itemName: product.name,
      category: historyCategory, // 실거래 category 공간 기준
    };

    const recommendation = buildSourcingRecommendation(records, target, leadTimeIndex);

    return NextResponse.json({
      success: true,
      target: {
        id: product.id,
        name: product.name,
        catalogNumber: product.catalogNumber ?? null,
      },
      recommendation,
    });
  } catch (error) {
    console.error("[sourcing/recommendations] Error:", error);
    return NextResponse.json(
      { error: "추천 조회 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
