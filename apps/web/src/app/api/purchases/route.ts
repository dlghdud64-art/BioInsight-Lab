import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { createLogger } from "@/lib/logger";
import { getScope, getScopeKey } from "@/lib/auth/scope";
import { auth } from "@/auth";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

const logger = createLogger("purchases");

export async function GET(request: NextRequest) {
  try {
    // 인증된 유저만 조회 가능
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const vendor = searchParams.get("vendor");
    const category = searchParams.get("category");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    // 유저의 워크스페이스 목록 조회
    const memberships = await db.workspaceMember.findMany({
      where: { userId: session.user.id },
      select: { workspaceId: true },
    });
    const workspaceIds = memberships.map((m: { workspaceId: string }) => m.workspaceId);

    // x-guest-key 헤더 (하위 호환: 미로그인 상태에서 저장된 구매 내역)
    const guestKey = request.headers.get("x-guest-key");

    // scopeKey 조건: userId + workspaceIds + guestKey 모두 포함
    const scopeKeyValues: string[] = [
      session.user.id, // userId로 저장된 구매 내역
      ...workspaceIds,  // workspaceId로 저장된 구매 내역
      ...(guestKey ? [guestKey] : []), // 미로그인 상태에서 저장된 구매 내역
    ];

    // workspaceId 컬럼으로 직접 연결된 구매 내역도 포함
    const ownerWhere: any = {
      OR: [
        { scopeKey: { in: scopeKeyValues } },
        ...(workspaceIds.length > 0 ? [{ workspaceId: { in: workspaceIds } }] : []),
      ],
    };

    logger.debug("Fetching purchases", {
      userId: session.user.id,
      workspaceCount: workspaceIds.length,
      hasGuestKey: !!guestKey,
      from,
      to,
      vendor,
      category,
      page,
      limit,
    });

    // 날짜/필터 조건 추가
    const where: any = {
      ...ownerWhere,
    };

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

    logger.info(`Found ${items.length} purchases (total: ${totalCount}) for user ${session.user.id}`);

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
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'purchase_request',
      targetEntityId: 'new',
      sourceSurface: 'purchase-api',
      routePath: '/api/purchases',
    });
    if (!enforcement.allowed) return enforcement.deny();

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

    // Scope 가져오기: 워크스페이스가 있으면 workspaceId를 scopeKey로, 없으면 userId 사용
    let postScopeKey = session.user.id;
    let postWorkspaceId: string | null = null;
    try {
      const scope = await getScope(request);
      postScopeKey = getScopeKey(scope);
      postWorkspaceId = scope.type === "workspace" ? (scope.workspaceId ?? null) : null;
    } catch {
      // 워크스페이스/게스트키 없는 유저: userId를 scopeKey로 사용
    }

    // 구매 기록 생성
    const purchaseRecord = await db.purchaseRecord.create({
      data: {
        scopeKey: postScopeKey,
        purchasedAt: purchaseDate,
        vendorName: vendor_name,
        itemName: product_name, // Prisma 스키마는 itemName 사용
        category: category || null,
        qty: cleanQuantity, // Prisma 스키마는 qty 사용
        unitPrice: cleanUnitPrice || null,
        amount: finalTotal, // Prisma 스키마는 amount 사용
        currency: currency || "KRW",
        source: "import", // 기본값
        workspaceId: postWorkspaceId,
      },
    });

    logger.info("Purchase record created", {
      id: purchaseRecord.id,
      userId: session.user.id,
      productName: product_name,
    });

    enforcement.complete({});

    return NextResponse.json(
      {
        success: true,
        purchase: purchaseRecord
      },
      { status: 201 }
    );
  } catch (error: any) {
    enforcement?.fail();
    logger.error("Failed to create purchase record", { error: error.message });
    return handleApiError(error, "purchases");
  }
}


