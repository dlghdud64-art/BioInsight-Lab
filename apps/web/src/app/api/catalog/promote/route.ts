// §catalog-A Phase 3 — demand-driven 승격 route (호영님 P1, 2026-06-10)
// ref → canonical product INSERT의 **유일한 명시 경로**. ingest/검색은 절대 호출 안 함.
// idempotent: 이미 승격된 ref는 기존 product 반환(재INSERT 0).

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/api-error-handler";
import { refToProductCreateInput } from "@/lib/catalog/procurement-search";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    // §catalog-A P3a — 승격 mutation 게이트(③ security theater 봉합).
    //   canonical product INSERT 단독 경로 → ADMIN|SUPPLIER 서버 재검증. RESEARCHER 차단.
    if (session.user.role !== "ADMIN" && session.user.role !== "SUPPLIER") {
      return NextResponse.json({ error: "제품 승격 권한이 없습니다." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const prdctIdNo = typeof body?.prdctIdNo === "string" ? body.prdctIdNo.trim() : "";
    if (!prdctIdNo) {
      return NextResponse.json({ error: "prdctIdNo가 필요합니다." }, { status: 400 });
    }

    const ref = await db.procurementCatalogRef.findUnique({ where: { prdctIdNo } });
    if (!ref) {
      return NextResponse.json({ error: "참조 항목을 찾을 수 없습니다." }, { status: 404 });
    }

    // idempotent — 이미 승격됨: 기존 product 반환, INSERT 0.
    if (ref.linkedProductId) {
      const existing = await db.product.findUnique({
        where: { id: ref.linkedProductId },
        include: { vendors: { include: { vendor: true } } },
      });
      if (existing) {
        return NextResponse.json({ product: existing, promoted: false });
      }
      // link가 가리키는 product가 삭제된 드문 케이스 — 아래 재승격 경로로 진행.
    }

    const product = await db.product.create({
      data: refToProductCreateInput(ref),
      include: { vendors: { include: { vendor: true } } },
    });

    await db.procurementCatalogRef.update({
      where: { prdctIdNo },
      data: { linkedProductId: product.id },
    });

    return NextResponse.json({ product, promoted: true });
  } catch (error) {
    return handleApiError(error, "catalog/promote");
  }
}
