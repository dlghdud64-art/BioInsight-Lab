import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import { getScope, buildScopeWhere, getScopeKey } from "@/lib/auth/scope";
import { auth } from "@/auth";

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

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      purchase_date,
      vendor_name,
      product_name,
      category,
      quantity,
      unit_price,
      currency = "KRW",
      total_amount,
    } = body;

    // 필수 필드 검증
    if (!purchase_date || !vendor_name || !product_name) {
      return NextResponse.json(
        { error: "구매일, 벤더명, 품목명은 필수입니다." },
        { status: 400 }
      );
    }

    // 숫자 필드 검증 및 변환
    const cleanQuantity = quantity ? Number(String(quantity).replace(/,/g, "")) : 0;
    const cleanUnitPrice = unit_price ? Number(String(unit_price).replace(/,/g, "")) : 0;
    const calculatedTotal = cleanQuantity * cleanUnitPrice;
    const finalTotal = total_amount 
      ? Number(String(total_amount).replace(/,/g, "")) 
      : calculatedTotal;

    // 날짜 변환
    const purchaseDate = new Date(purchase_date);
    if (isNaN(purchaseDate.getTime())) {
      return NextResponse.json(
        { error: "유효하지 않은 날짜 형식입니다." },
        { status: 400 }
      );
    }

    // Scope 가져오기
    const scope = await getScope(request);
    const scopeKey = getScopeKey(scope);

    // 구매 기록 생성
    const purchaseRecord = await db.purchaseRecord.create({
      data: {
        scopeKey: scopeKey,
        purchasedAt: purchaseDate,
        vendorName: vendor_name,
        itemName: product_name, // Prisma 스키마는 itemName 사용
        category: category || null,
        qty: cleanQuantity, // Prisma 스키마는 qty 사용
        unitPrice: cleanUnitPrice || null,
        amount: finalTotal, // Prisma 스키마는 amount 사용
        currency: currency || "KRW",
        source: "import", // 기본값
        workspaceId: scope.workspaceId || null,
      },
    });

    logger.info("Purchase record created", {
      id: purchaseRecord.id,
      userId: session.user.id,
      productName: product_name,
    });

    return NextResponse.json(
      { 
        success: true, 
        purchase: purchaseRecord 
      },
      { status: 201 }
    );
  } catch (error: any) {
    logger.error("Failed to create purchase record", { error: error.message });
    return handleApiError(error, "purchases");
  }
}


