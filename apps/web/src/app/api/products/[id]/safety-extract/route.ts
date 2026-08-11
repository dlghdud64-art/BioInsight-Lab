import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
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
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    const { id } = await params;

    // §enforcement-handle-close-sweep (products) — 대상 엔티티 실재(params id) → per-resource 키.
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'product',
      targetEntityId: id,
      sourceSurface: 'web_app',
      routePath: '/api/products/id/safety-extract',
    });
    if (!enforcement.allowed) return enforcement.deny();
    const body = await request.json();
    const { msdsUrl, msdsText } = body;

    // 제품 조회
    const product = await db.product.findUnique({
      where: { id },
    });

    if (!product) {
      enforcement.fail();
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
          // ⚠️ 내부 catch 자체 return — 외부 catch 미경유(E6 클래스).
          enforcement.fail();
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
          // ⚠️ 내부 catch 자체 return — 외부 catch 미경유(E6 클래스).
          enforcement.fail();
          return NextResponse.json(
            { error: error.message || "MSDS 문서를 가져올 수 없습니다." },
            { status: 400 }
          );
        }
      }
    }

    if (!textToAnalyze || textToAnalyze.trim().length === 0) {
      enforcement.fail();
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

    // db.product.update 로 안전 필드를 실제로 갱신한다 → complete().
    enforcement.complete({
      beforeState: {
        productId: id, msdsUrl: product.msdsUrl, hazardCodes: product.hazardCodes,
        storageCondition: product.storageCondition, safetyNote: product.safetyNote,
      },
      afterState: {
        productId: id, msdsUrl: updatedProduct.msdsUrl, hazardCodes: updatedProduct.hazardCodes,
        storageCondition: updatedProduct.storageCondition, safetyNote: updatedProduct.safetyNote,
      },
    });

    return NextResponse.json({
      success: true,
      safetyInfo,
      product: updatedProduct,
    });
  } catch (error: any) {
    enforcement?.fail();
    console.error("Error extracting safety info:", error);
    return NextResponse.json(
      { error: error.message || "안전 정보 추출에 실패했습니다." },
      { status: 500 }
    );
  }
}

