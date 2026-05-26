/**
 * §11.310d #orders-draft-create — 재고 도우미 권장 발주 draft 등록 endpoint.
 *
 * 호영님 P1 spec (Q31 = A, 2026-05-26):
 *   /dashboard/purchase-orders/new [발주 생성] → POST /api/orders/draft
 *   → PurchaseRecord 신규 record (source="manual_draft", followUpStatus=null)
 *   → 응답 ID + redirect to PO 목록.
 *
 * 단순화 (호영님 spec "어렵게 가지말고 단순하게" 정합):
 *   - 기존 /api/orders POST (quote-based) 변경 0 — 별도 endpoint
 *   - Order/OrderItem schema 변경 0 — PurchaseRecord 만 활용 (기존 모델)
 *   - auth() 만 (enforceAction 미사용, §11.309c 패턴 정합)
 *
 * 입력:
 *   POST /api/orders/draft
 *   Body: {
 *     productName: string;     // 필수
 *     supplier: string;        // 필수 (vendorName)
 *     quantity: number;        // 필수 > 0
 *     unitPrice?: number;      // optional (0 가능)
 *     notes?: string;
 *     source?: "reorder-recommendation" | "manual";  // 출처 (감사)
 *   }
 *
 * 응답:
 *   { id: string, purchasedAt: string, vendorName: string, itemName: string }
 *
 * 후속 (§11.310d-2):
 *   - 정식 Order/OrderItem record + 결재 요청 흐름
 *   - vendorId lookup (현재 vendorName plain string)
 *   - approval workflow + audit envelope
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/mobile-jwt";

interface DraftOrderBody {
  productName: string;
  supplier: string;
  quantity: number;
  unitPrice?: number;
  notes?: string;
  source?: "reorder-recommendation" | "manual";
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const user = await getAuthUser(session as Parameters<typeof getAuthUser>[0], request);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as DraftOrderBody;
    const { productName, supplier, quantity, unitPrice, notes, source } = body;

    // ── Input validation ──
    if (!productName || typeof productName !== "string" || !productName.trim()) {
      return NextResponse.json(
        { error: "productName 은 필수입니다." },
        { status: 400 },
      );
    }
    if (!supplier || typeof supplier !== "string" || !supplier.trim()) {
      return NextResponse.json(
        { error: "supplier 는 필수입니다." },
        { status: 400 },
      );
    }
    if (typeof quantity !== "number" || quantity <= 0) {
      return NextResponse.json(
        { error: "quantity 는 0보다 큰 숫자여야 합니다." },
        { status: 400 },
      );
    }

    const safeUnitPrice = typeof unitPrice === "number" && unitPrice >= 0 ? unitPrice : 0;
    const amount = quantity * safeUnitPrice;

    // §11.310d — scopeKey: user.id (§11.310b PurchaseRecord 패턴 정합)
    const scopeKey = user.id;
    const recordSource = source === "reorder-recommendation"
      ? "reorder-recommendation"
      : "manual";

    const created = await db.purchaseRecord.create({
      data: {
        scopeKey,
        purchasedAt: new Date(),
        vendorName: supplier.trim(),
        itemName: productName.trim(),
        qty: quantity,
        unitPrice: safeUnitPrice,
        amount,
        currency: "KRW",
        source: recordSource,
        // followUpStatus null = pending (정식 발주 결재 대기 — §11.310d-2 후속)
      },
      select: {
        id: true,
        purchasedAt: true,
        vendorName: true,
        itemName: true,
        qty: true,
        unitPrice: true,
        amount: true,
      },
    });

    return NextResponse.json({
      id: created.id,
      purchasedAt: created.purchasedAt.toISOString(),
      vendorName: created.vendorName,
      itemName: created.itemName,
      qty: created.qty,
      unitPrice: created.unitPrice,
      amount: created.amount,
      source: recordSource,
    });
  } catch (error) {
    console.error("[OrdersDraft/POST]", error);
    return NextResponse.json(
      { error: "발주 draft 생성에 실패했습니다." },
      { status: 500 },
    );
  }
}
