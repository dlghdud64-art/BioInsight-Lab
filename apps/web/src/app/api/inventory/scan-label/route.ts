/**
 * POST /api/inventory/scan-label
 *
 * 시약 라벨 텍스트를 파싱하여 구조화된 데이터를 반환합니다.
 * 현재: 정규식 기반 파서 사용
 * 향후: Cloud Vision OCR + LLM(OpenAI/Claude) 파싱으로 업그레이드 가능
 *
 * Request body:
 *   - text: string (OCR 또는 수동 입력된 라벨 텍스트)
 *   - imageBase64?: string (향후 서버사이드 OCR용 이미지 데이터)
 *
 * Response:
 *   - parsed: LabelParseResult
 *   - matchedProduct?: { id, name, brand, catalogNumber } (DB 매칭 결과)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { parseReagentLabel } from "@/lib/ocr/label-parser";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
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

    // ── OCR 단계 (향후 확장 포인트) ──
    // 현재: 클라이언트에서 텍스트를 직접 전송
    // 향후: imageBase64가 있으면 서버사이드 OCR 수행
    let ocrText = text ?? "";

    if (!ocrText && imageBase64) {
      // TODO: Cloud Vision API 또는 Tesseract.js 서버사이드 OCR 연동
      // const ocrResult = await cloudVisionOCR(imageBase64);
      // ocrText = ocrResult.text;
      return NextResponse.json(
        { error: "서버사이드 OCR은 아직 준비 중입니다. 텍스트 입력을 이용해주세요." },
        { status: 501 }
      );
    }

    // ── 파싱 단계 ──
    const parsed = parseReagentLabel(ocrText);

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
          ? "restock"  // 기존 lot에 입고 추가
          : matchedProduct
            ? "new_lot" // 기존 제품, 새 lot 등록
            : "new_product", // 새 제품 + 재고 등록
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
