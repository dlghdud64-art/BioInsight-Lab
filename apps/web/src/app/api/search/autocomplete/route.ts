/**
 * §11.258c #sourcing-search-autocomplete — 호영님 spec #6 server route.
 *
 * GET /api/search/autocomplete?q=<query>&limit=<n>
 *
 * 응답: { items: Array<{ type: "product"|"brand"|"catalog", label: string, value: string }> }
 *
 * 정책:
 *   - 2글자 미만 시 빈 결과 (server 부하 차단).
 *   - 각 type 별 top 5 (총 최대 15개).
 *   - Product.name / brand / catalogNumber 각 contains 검색 (Prisma index 정합).
 *   - distinct 으로 brand / catalog 중복 제거.
 *
 * canonical truth lock:
 *   - 기존 /api/products/search route 변경 0.
 *   - Product 모델 + Prisma index 변경 0.
 *   - auth 강제 0 — 자동완성은 dropdown UX 의 일부, 사용자 입력 즉시 반응 (UX 최적화).
 *     실제 검색 결과 fetch (/api/products/search) 시 별도 auth 검증.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const logger = createLogger("search/autocomplete");

interface AutocompleteItem {
  type: "product" | "brand" | "catalog";
  label: string;
  value: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const q = (searchParams.get("q") || "").trim();
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(Number(limitParam), 1), 10) : 5;

    // §11.258c — 2글자 미만 시 server 부하 차단 (호영님 spec).
    if (q.length < 2) {
      return NextResponse.json({ items: [] });
    }

    // §11.258c — 3 type 병렬 query (Product.name + brand + catalogNumber).
    //   각 type 별 take limit (default 5). distinct 으로 중복 제거 (brand / catalog).
    const [products, brands, catalogs] = await Promise.all([
      db.product.findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        select: { id: true, name: true },
        take: limit,
        orderBy: { name: "asc" },
      }),
      db.product.findMany({
        where: { brand: { contains: q, mode: "insensitive" } },
        select: { brand: true },
        take: limit * 3, // distinct 후 take 보장 위해 over-fetch.
        distinct: ["brand"],
        orderBy: { brand: "asc" },
      }),
      db.product.findMany({
        where: { catalogNumber: { contains: q, mode: "insensitive" } },
        select: { catalogNumber: true, name: true },
        take: limit * 2,
        distinct: ["catalogNumber"],
        orderBy: { catalogNumber: "asc" },
      }),
    ]);

    const items: AutocompleteItem[] = [];

    for (const p of products) {
      items.push({ type: "product", label: p.name, value: p.name });
    }
    for (const b of brands) {
      if (b.brand) items.push({ type: "brand", label: b.brand, value: b.brand });
      if (items.filter((i) => i.type === "brand").length >= limit) break;
    }
    for (const c of catalogs) {
      if (c.catalogNumber) {
        items.push({
          type: "catalog",
          label: `${c.catalogNumber} · ${c.name ?? ""}`.trim(),
          value: c.catalogNumber,
        });
      }
      if (items.filter((i) => i.type === "catalog").length >= limit) break;
    }

    return NextResponse.json({ items });
  } catch (error) {
    logger.error("autocomplete failure", error as Error);
    // §11.258c — silent fallback (autocomplete 는 UX optional, 검색 자체는 보존).
    return NextResponse.json({ items: [] });
  }
}
