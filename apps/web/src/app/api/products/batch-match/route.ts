import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { buildSearchQuery, sortByRelevance } from "@/lib/search/ranking";
import { toBomCandidate, type BomProductForMatch } from "@/lib/catalog/bom-product-match";

// §catalog-A P3c — BOM catalog-scoped batch 매칭 (호영님 P-track, 2026-06-12)
//   BOM 시약 라인 N개 ↔ canonical Product 후보 매칭. 응답 키 = productId(catalog-scoped,
//   quote-scoped 의 등록키와 축 다름 — P3b quotes/[id]/match-products 와 혼동 금지).
//   read-only(write 0). 게이트 = 401 only(role-free — BOM 은 RESEARCHER 표면).
//   N+1 0: item별 buildSearchQuery where 를 OR 합산 → 단일 product 조회 1회 →
//   item별 sortByRelevance 재랭킹 → top-5 후보.
//   안전필드(hazardCodes/pictograms/safetyNote) select 포함 — BOM 위험물질 표시 dead 복구
//   (기존 /api/products/search 는 안전필드 미반환 → isHighRisk 항상 falsy 였음).

const batchSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        category: z.string().nullable().optional(),
      }),
    )
    .min(1)
    .max(100),
});

const TOP_N = 5;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { items } = batchSchema.parse(await request.json());

    // item별 where 생성 → OR 합산(단일 쿼리). visibility/min-length 게이트는
    //   buildSearchQuery 상속(2글자 미만 = never-match 로 자체 컷).
    const perItemWhere = items.map((it) => buildSearchQuery({ query: it.name }).where);

    const products = await db.product.findMany({
      where: { OR: perItemWhere },
      select: {
        id: true,
        name: true,
        catalogNumber: true,
        hazardCodes: true,
        pictograms: true,
        safetyNote: true,
        vendors: {
          select: {
            priceInKRW: true,
            currency: true,
            vendor: { select: { name: true } },
          },
          orderBy: { priceInKRW: "asc" },
          take: 1,
        },
      },
      take: 1000,
    });

    // item별 재랭킹(sortByRelevance) → top-N → BOM 후보 투영(toBomCandidate,
    //   isHighRisk 서버 계산). 응답 키 = productId.
    const results = items.map((it) => {
      const scored = sortByRelevance(products, it.name);
      const candidates = scored
        .filter((s) => s.score > 0)
        .slice(0, TOP_N)
        .map((s) => toBomCandidate(s.product as unknown as BomProductForMatch));
      return { id: it.id, candidates };
    });

    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 },
      );
    }
    console.error("products batch-match failed:", error);
    return NextResponse.json({ error: "매칭에 실패했습니다." }, { status: 500 });
  }
}
