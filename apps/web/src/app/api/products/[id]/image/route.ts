/**
 * /api/products/[id]/image — placeholder stub
 *
 * #api-products-id-image-route-create — §11.203 후속 follow-up.
 *
 * Behavior:
 *   - product.imageUrl 존재 → 307 redirect to imageUrl
 *   - product 부재 또는 imageUrl null → 200 SVG placeholder (운영자
 *     console 의 4xx noise 차단)
 *
 * §11.203 caller fallback (sourcing-result-row / search-result-item /
 * product-detail-summary / product-card) 은 imageUrl 직접 사용 + 빈 값
 * 시 FlaskConical icon 으로 대체. 본 route 는 caller fallback 외에서
 * 호출되는 dead link (옛 page / 외부 link / AddInventoryModal sweep
 * 잔존) 를 cover.
 *
 * canonical truth:
 *   - Product.imageUrl 단일 source. 본 route 는 redirect / placeholder
 *     중계만 (DB write 0).
 *   - 인증 0 (이미지 자산은 product 메타와 동등 — public).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** 1x1 transparent SVG placeholder — 200 응답으로 dead link 차단. */
const PLACEHOLDER_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#f1f5f9"/>
  <path d="M22 24h20v16H22z" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linejoin="round"/>
  <circle cx="28" cy="30" r="2" fill="#94a3b8"/>
  <path d="M22 38l6-6 5 5 4-4 5 5" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linejoin="round"/>
</svg>`;

function placeholderResponse(): NextResponse {
  return new NextResponse(PLACEHOLDER_SVG, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  if (!id || typeof id !== "string") {
    return placeholderResponse();
  }

  try {
    const product = await db.product.findUnique({
      where: { id },
      select: { imageUrl: true },
    });

    if (product?.imageUrl && product.imageUrl.trim()) {
      // canonical imageUrl 로 redirect (운영자 캐시 가능)
      return NextResponse.redirect(product.imageUrl, { status: 307 });
    }

    return placeholderResponse();
  } catch {
    // DB error — placeholder fallback (4xx noise 차단)
    return placeholderResponse();
  }
}
