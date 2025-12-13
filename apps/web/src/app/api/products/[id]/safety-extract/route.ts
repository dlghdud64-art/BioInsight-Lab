import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { extractSafetyInfoFromMSDS, fetchMSDSText } from "@/lib/ai/safety-extractor";
import { extractTextFromPDF } from "@/lib/ai/pdf-parser";

/**
 * MSDS/SDS에서 안전 정보 자동 추출 API
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { msdsUrl, msdsText } = body;

    // 제품 조회
    const product = await db.product.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // MSDS 텍스트 가져오기
    let textToAnalyze = msdsText;

    if (!textToAnalyze && msdsUrl) {
      // URL에서 텍스트 추출
      if (msdsUrl.toLowerCase().endsWith(".pdf")) {
        // PDF 다운로드 및 파싱
        try {
          const pdfResponse = await fetch(msdsUrl);
          if (!pdfResponse.ok) {
            throw new Error("Failed to download PDF");
          }
          const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
          textToAnalyze = await extractTextFromPDF(pdfBuffer);
        } catch (error) {
          return NextResponse.json(
            { error: "MSDS PDF를 다운로드하거나 파싱할 수 없습니다." },
            { status: 400 }
          );
        }
      } else {
        // HTML 페이지에서 텍스트 추출
        try {
          textToAnalyze = await fetchMSDSText(msdsUrl);
        } catch (error: any) {
          return NextResponse.json(
            { error: error.message || "MSDS 문서를 가져올 수 없습니다." },
            { status: 400 }
          );
        }
      }
    }

    if (!textToAnalyze || textToAnalyze.trim().length === 0) {
      return NextResponse.json(
        { error: "MSDS 텍스트가 필요합니다." },
        { status: 400 }
      );
    }

    // GPT로 안전 정보 추출
    const safetyInfo = await extractSafetyInfoFromMSDS(textToAnalyze);

    // 제품 업데이트 (안전 정보 저장)
    const updatedProduct = await db.product.update({
      where: { id },
      data: {
        hazardCodes: safetyInfo.hazardCodes ? safetyInfo.hazardCodes : null,
        pictograms: safetyInfo.pictograms ? safetyInfo.pictograms : null,
        storageCondition: safetyInfo.storageCondition || null,
        ppe: safetyInfo.ppe ? safetyInfo.ppe : null,
        safetyNote: safetyInfo.summary || null,
      },
    });

    return NextResponse.json({
      success: true,
      safetyInfo,
      product: updatedProduct,
    });
  } catch (error: any) {
    console.error("Error extracting safety info:", error);
    return NextResponse.json(
      { error: error.message || "안전 정보 추출에 실패했습니다." },
      { status: 500 }
    );
  }
}

