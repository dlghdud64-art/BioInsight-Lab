// #catalog-spec-backfill ①-b Phase 3a — 견적 파싱 item↔Product 매칭 (read-only) (호영님 P-track, 2026-06-11)
// canonical(db.product) 읽기 전용 — write 0. tier 판정은 lib/catalog/quote-product-match 순수함수.
// 후보 Product 는 batch 단일 findMany 로 조회(§8-C N+1 금지), select 제한(overfetch 금지).

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  matchQuoteItemToProduct,
  type QuoteProductTarget,
} from "@/lib/catalog/quote-product-match";

const matchSchema = z.object({
  items: z
    .array(
      z.object({
        productName: z.string().nullable().optional(),
        catalogNumber: z.string().nullable().optional(),
      }),
    )
    .max(100),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { items } = matchSchema.parse(await request.json());

    // 후보 키 수집 (중복 제거)
    const catalogs = [
      ...new Set(items.map((i) => i.catalogNumber?.trim()).filter((v): v is string => !!v)),
    ];
    const names = items
      .map((i) => i.productName?.trim())
      .filter((v): v is string => !!v && v.length >= 2);

    // batch 단일 쿼리: catalog exact(insensitive) + name contains(insensitive). select 제한.
    const or: Prisma.ProductWhereInput[] = [];
    for (const c of catalogs) {
      or.push({ catalogNumber: { equals: c, mode: "insensitive" } });
      or.push({ modelNumber: { equals: c, mode: "insensitive" } });
    }
    for (const n of names) {
      or.push({ name: { contains: n, mode: "insensitive" } });
    }

    const candidates: QuoteProductTarget[] =
      or.length === 0
        ? []
        : await db.product.findMany({
            where: { OR: or },
            select: { id: true, name: true, catalogNumber: true, modelNumber: true },
            take: 100,
          });

    // item별 tier 판정 (순수함수, spec 미사용)
    const results = items.map((it, lineIndex) => {
      const r = matchQuoteItemToProduct(
        {
          productName: it.productName ?? null,
          catalogNumber: it.catalogNumber ?? null,
          specification: null,
        },
        candidates,
      );
      return { lineIndex, tier: r.tier, matches: r.matches };
    });

    return NextResponse.json({ results });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 },
      );
    }
    console.error("quote match-products failed:", error);
    return NextResponse.json({ error: "매칭에 실패했습니다." }, { status: 500 });
  }
}
