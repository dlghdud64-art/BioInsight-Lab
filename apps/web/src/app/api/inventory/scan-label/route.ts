/**
 * POST /api/inventory/scan-label
 *
 * 시약 라벨 이미지/텍스트를 파싱하여 구조화된 데이터를 반환합니다.
 *
 * - imageBase64가 있으면: Gemini 멀티모달로 직접 파싱 (OCR + 구조화 한 번에)
 * - text만 있으면: 정규식 기반 파서로 파싱 (fallback)
 *
 * Request body:
 *   - text?: string (수동 입력된 라벨 텍스트)
 *   - imageBase64?: string (촬영/업로드된 라벨 이미지 data URI)
 *
 * Response:
 *   - parsed: LabelParseResult
 *   - matchedProduct?: { id, name, brand, catalogNumber }
 *   - matchedInventory?: { id, lotNumber, currentQuantity, unit }
 *   - suggestions: { isNewProduct, isNewLot, isExistingLot, action }
 */

import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { parseReagentLabel } from "@/lib/ocr/label-parser";
import { parseWithGemini } from "@/lib/ocr/gemini-label-parser";

export async function POST(req: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'inventory',
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/inventory/scan-label',
    });
    if (!enforcement.allowed) return enforcement.deny();

        if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const body = await req.json();
    const { text, imageBase64 } = body as { text?: string; imageBase64?: string };

    if (!text && !imageBase64) {
      return NextResponse.json(
        { error: "텍스트 또는 이미지 데이터가 필요합니다" },
        { status: 400 }
      );
    }

    // ── 파싱 단계 ──
    // 이미지가 있으면 Gemini 멀티모달, 없으면 정규식 fallback
    let parsed;

    if (imageBase64) {
      try {
        parsed = await parseWithGemini(imageBase64);
      } catch (geminiErr) {
        console.error("[scan-label] Gemini parse failed, falling back to regex:", geminiErr);
        // Gemini 실패 시 텍스트가 있으면 정규식 fallback
        if (text) {
          parsed = parseReagentLabel(text);
        } else {
          return NextResponse.json(
            { error: "AI 라벨 분석에 실패했습니다. 텍스트를 직접 입력해주세요." },
            { status: 422 }
          );
        }
      }
    } else {
      parsed = parseReagentLabel(text!);
    }

    // ── DB 매칭 단계: catalogNo로 기존 제품 검색 ──
    let matchedProduct: {
      id: string;
      name: string;
      brand: string | null;
      catalogNumber: string | null;
    } | null = null;

    if (parsed.catalogNo) {
      const product = await db.product.findFirst({
        where: {
          catalogNumber: {
            equals: parsed.catalogNo,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          name: true,
          brand: true,
          catalogNumber: true,
        },
      });

      if (product) {
        matchedProduct = product;
      }
    }

    // catalogNo로 못 찾으면 CAS Number로 시도
    if (!matchedProduct && parsed.casNumber) {
      const product = await db.product.findFirst({
        where: {
          casNumber: {
            equals: parsed.casNumber,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          name: true,
          brand: true,
          catalogNumber: true,
        },
      });

      if (product) {
        matchedProduct = product;
      }
    }

    // ── 기존 재고에서도 매칭 시도 ──
    let matchedInventory: {
      id: string;
      lotNumber: string | null;
      currentQuantity: number;
      unit: string | null;
    } | null = null;

    if (matchedProduct && parsed.lotNo) {
      const inventory = await db.inventory.findFirst({
        where: {
          productId: matchedProduct.id,
          lotNumber: {
            equals: parsed.lotNo,
            mode: "insensitive",
          },
          userId: session.user.id,
        },
        select: {
          id: true,
          lotNumber: true,
          currentQuantity: true,
          unit: true,
        },
      });

      if (inventory) {
        matchedInventory = inventory;
      }
    }

    return NextResponse.json({
      success: true,
      parsed,
      matchedProduct,
      matchedInventory,
      suggestions: {
        isNewProduct: !matchedProduct,
        isNewLot: matchedProduct && !matchedInventory,
        isExistingLot: !!matchedInventory,
        action: matchedInventory
          ? "restock"
          : matchedProduct
            ? "new_lot"
            : "new_product",
      },
    });
  } catch (error) {
    console.error("[scan-label] Error:", error);
    return NextResponse.json(
      { error: "라벨 파싱 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
