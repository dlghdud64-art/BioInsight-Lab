import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import { getScope, buildScopeWhere } from "@/lib/auth/scope";

const logger = createLogger("purchases");

export async function GET(request: NextRequest) {
  try {
    // Get scope (workspace or guest)
    const scope = await getScope(request);

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const vendor = searchParams.get("vendor");
    const category = searchParams.get("category");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    logger.debug("Fetching purchases", {
      scope: scope.type,
      workspaceId: scope.workspaceId,
      guestKey: scope.guestKey?.substring(0, 8),
      from,
      to,
      vendor,
      category,
      page,
      limit
    });

    // Build where clause with scope
    const where: any = buildScopeWhere(scope);

    if (from || to) {
      where.purchasedAt = {};
      if (from) where.purchasedAt.gte = new Date(from);
      if (to) where.purchasedAt.lte = new Date(to);
    }

    if (vendor) {
      where.vendorName = { contains: vendor, mode: "insensitive" };
    }

    if (category) {
      where.category = { contains: category, mode: "insensitive" };
    }

    const [items, totalCount] = await Promise.all([
      db.purchaseRecord.findMany({
        where,
        orderBy: { purchasedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.purchaseRecord.count({ where }),
    ]);

    logger.info(`Found ${items.length} purchases (total: ${totalCount}) for scope ${scope.type}`);

    return NextResponse.json({
      items,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    return handleApiError(error, "purchases");
  }
}



