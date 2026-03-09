import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.MOBILE_JWT_SECRET || process.env.AUTH_SECRET || "bioinsight-mobile-secret-key"
);

async function verifyMobileToken(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

/**
 * GET /api/mobile/products/search?q=...&limit=20&offset=0
 */
export async function GET(req: NextRequest) {
  const user = await verifyMobileToken(req);
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  if (!q || q.length < 1) {
    return NextResponse.json({ products: [], total: 0 });
  }

  const where = {
    OR: [
      { name: { contains: q, mode: "insensitive" as const } },
      { nameEn: { contains: q, mode: "insensitive" as const } },
      { catalogNumber: { contains: q, mode: "insensitive" as const } },
      { brand: { contains: q, mode: "insensitive" as const } },
    ],
  };

  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      take: limit,
      skip: offset,
      select: {
        id: true,
        name: true,
        nameEn: true,
        brand: true,
        catalogNumber: true,
        category: true,
      },
      orderBy: { name: "asc" },
    }),
    db.product.count({ where }),
  ]);

  return NextResponse.json({ products, total });
}
