import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { extractTextFromPDF } from "@/lib/ai/pdf-parser";
import { extractProductInfoFromDatasheet } from "@/lib/ai/datasheet-extractor";

// pdf-parse는 Node.js 네이티브 모듈이므로 Node.js 런타임 필요
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
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
      targetEntityType: 'ai_action',
      // §enforcement-handle-close-sweep (datasheet) — 'unknown' 유지. 업로드된 PDF 에서
      //   텍스트를 뽑아 반환할 뿐 대상 엔티티가 없다 (DB 쓰기 0).
      //   ⚠️ targetEntityType 'ai_action' 은 문서 추출과 어긋난다 → §audit-taxonomy-review 후보.
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/datasheet/extract-pdf',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      enforcement.fail();
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      enforcement.fail();
      return NextResponse.json({ error: "PDF 파일만 업로드 가능합니다." }, { status: 400 });
    }

    // 파일 크기 제한 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      enforcement.fail();
      return NextResponse.json({ error: "파일 크기는 10MB 이하여야 합니다." }, { status: 400 });
    }

    // 🎭 파일명 추출 (데모 cheat key용)
    const fileName = file.name;
    if (process.env.NODE_ENV === "development") {
      console.log(`[PDF Extract API] Processing file: ${fileName}`);
    }

    // File을 Buffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // PDF에서 텍스트 추출
    const pdfText = await extractTextFromPDF(buffer);

    // 텍스트가 너무 길면 앞부분만 사용
    let cleanedText = pdfText;
    if (cleanedText.length > 15000) {
      cleanedText = cleanedText.substring(0, 15000) + "...";
    }

    // 데이터시트 정보 추출 (파일명 전달 - 데모 cheat key 활성화)
    const extractedInfo = await extractProductInfoFromDatasheet(cleanedText, fileName);

    // Extract-only route: no DB writes -> audit envelope 없이 lock 만 해제한다.
    enforcement.fail();
    return NextResponse.json({
      data: {
        ...extractedInfo,
        extractedTextLength: pdfText.length,
        sourceType: "pdf",
      },
    });
  } catch (error: any) {
    enforcement?.fail();
    console.error("Error processing datasheet PDF:", error);
    const errorMessage = error?.message || "데이터시트 PDF 처리에 실패했습니다.";
    console.error("Error details:", {
      message: errorMessage,
      stack: error?.stack,
      name: error?.name,
    });
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}


























