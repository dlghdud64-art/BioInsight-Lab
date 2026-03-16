/**
 * GET  /api/compare-sessions — 비교 세션 목록 조회
 * POST /api/compare-sessions — 비교 세션 생성 + structured diff 계산
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getProductsByIds } from "@/lib/api/products";
import { computeMultiProductDiff } from "@/lib/compare-workspace/compare-engine";
import { createActivityLog } from "@/lib/activity-log";
import { handleApiError } from "@/lib/api-error-handler";

// ── GET: 비교 세션 목록 ──

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;

    if (!userId) {
      return NextResponse.json({ sessions: [], total: 0 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "all";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 50);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    const where: Record<string, unknown> = { userId };
    if (status !== "all") {
      where.decisionState = status;
    }

    const [sessions, total] = await Promise.all([
      db.compareSession.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          inquiryDrafts: {
            select: { id: true, status: true },
          },
        },
      }),
      db.compareSession.count({ where }),
    ]);

    if (sessions.length === 0) {
      return NextResponse.json({ sessions: [], total: 0 });
    }

    // 세션 ID 수집
    const sessionIds = sessions.map((s: any) => s.id);

    // 연결된 견적 조회
    const linkedQuotes = await db.quote.findMany({
      where: { comparisonId: { in: sessionIds } },
      select: { id: true, comparisonId: true, status: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
    const quoteCountMap: Record<string, number> = {};
    const quoteStatusMap: Record<string, string[]> = {};
    const latestQuoteStatusMap: Record<string, string> = {};
    for (const q of linkedQuotes) {
      if (q.comparisonId) {
        quoteCountMap[q.comparisonId] = (quoteCountMap[q.comparisonId] || 0) + 1;
        if (!quoteStatusMap[q.comparisonId]) quoteStatusMap[q.comparisonId] = [];
        if (!quoteStatusMap[q.comparisonId].includes(q.status)) quoteStatusMap[q.comparisonId].push(q.status);
        if (!latestQuoteStatusMap[q.comparisonId]) latestQuoteStatusMap[q.comparisonId] = q.status;
      }
    }

    // 제품명 일괄 조회
    const allProductIds = [...new Set(sessions.flatMap((s: any) => {
      const ids = s.productIds;
      return Array.isArray(ids) ? ids : [];
    }))];
    const products = allProductIds.length > 0
      ? await db.product.findMany({
          where: { id: { in: allProductIds } },
          select: { id: true, name: true },
        })
      : [];
    const productNameMap: Record<string, string> = {};
    for (const p of products) {
      productNameMap[p.id] = p.name;
    }

    // 응답 조립
    const enrichedSessions = sessions.map((s: any) => {
      const pIds: string[] = Array.isArray(s.productIds) ? s.productIds : [];
      const drafts = s.inquiryDrafts || [];

      // latestActionAt 계산
      const timestamps = [s.createdAt, s.updatedAt, ...drafts.map((d: any) => d.createdAt)].filter(Boolean);
      const latestActionAt = timestamps.length > 0
        ? new Date(Math.max(...timestamps.map((t: Date) => new Date(t).getTime()))).toISOString()
        : s.updatedAt?.toISOString?.() ?? s.createdAt?.toISOString?.() ?? null;

      // diffSummaryVerdict 추출
      const diffArr = Array.isArray(s.diffResult) ? s.diffResult : [];
      const diffSummaryVerdict = diffArr[0]?.summary?.overallVerdict ?? null;

      return {
        id: s.id,
        productIds: pIds,
        productNames: pIds.map((id: string) => productNameMap[id] || id),
        decisionState: s.decisionState ?? null,
        decidedBy: s.decidedBy ?? null,
        decidedAt: s.decidedAt?.toISOString?.() ?? null,
        linkedQuoteCount: quoteCountMap[s.id] || 0,
        linkedQuoteStatuses: quoteStatusMap[s.id] || [],
        latestQuoteStatus: latestQuoteStatusMap[s.id] || null,
        inquiryDraftCount: drafts.length,
        inquiryDraftStatuses: [...new Set(drafts.map((d: any) => d.status))],
        latestActionAt,
        createdAt: s.createdAt?.toISOString?.() ?? null,
        diffSummaryVerdict,
      };
    });

    return NextResponse.json({ sessions: enrichedSessions, total });
  } catch (error) {
    return handleApiError(error, "GET /api/compare-sessions");
  }
}

// ── POST: 비교 세션 생성 ──

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;

    const body = await request.json();
    const { productIds, organizationId } = body;

    if (!Array.isArray(productIds) || productIds.length < 2) {
      return NextResponse.json(
        { error: "최소 2개 제품 ID가 필요합니다." },
        { status: 400 }
      );
    }

    if (productIds.length > 5) {
      return NextResponse.json(
        { error: "최대 5개까지 비교할 수 있습니다." },
        { status: 400 }
      );
    }

    // 제품 조회
    const products = await getProductsByIds(productIds);
    if (!products || products.length < 2) {
      return NextResponse.json(
        { error: "비교할 수 있는 제품이 2개 이상 필요합니다." },
        { status: 404 }
      );
    }

    // CompareSession 생성
    const compareSession = await db.compareSession.create({
      data: {
        productIds: productIds,
        userId,
        organizationId: organizationId ?? null,
      },
    });

    // Structured diff 계산
    const diffResults = computeMultiProductDiff(products, compareSession.id);

    // diff 결과 저장
    await db.compareSession.update({
      where: { id: compareSession.id },
      data: { diffResult: diffResults as any },
    });

    // Activity log
    await createActivityLog({
      activityType: "PRODUCT_COMPARED",
      entityType: "COMPARE_SESSION",
      entityId: compareSession.id,
      userId,
      organizationId: organizationId ?? null,
      metadata: {
        productIds,
        productCount: products.length,
        totalDifferences: diffResults.reduce((sum, d) => sum + d.totalDifferences, 0),
      },
    });

    return NextResponse.json({
      session: {
        id: compareSession.id,
        productIds: compareSession.productIds,
        diffResult: diffResults,
        createdAt: compareSession.createdAt,
      },
      products: products.map((p: any) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        catalogNumber: p.catalogNumber,
      })),
    });
  } catch (error) {
    return handleApiError(error, "POST /api/compare-sessions");
  }
}
