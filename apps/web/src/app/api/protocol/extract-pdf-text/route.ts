// 서버 환경 폴리필 (DOMMatrix 등) — 반드시 최상단에서 import
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { auth } from "@/auth";
import "@/lib/server-polyfills";

import { NextRequest, NextResponse } from "next/server";
import { extractTextFromPDF } from "@/lib/ai/pdf-parser";
import {
  logPipelineStage,
  createRequestId,
} from "@/lib/ai/pipeline-logger";

export const runtime = "nodejs";

/**
 * POST /api/protocol/extract-pdf-text
 * PDF 파일에서 텍스트를 추출합니다.
 *
 * pdfjs-dist(pdf-parse 종속)는 DOMMatrix 등 DOM API를 내부적으로 참조하므로,
 * Node.js 환경에서는 server-polyfills를 미리 로드해야 합니다.
 *
 * 구조화 진단 로깅: requestId 기반 추적
 */
export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  const requestId = createRequestId();
  const pipelineStart = Date.now();
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
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/protocol/extract-pdf-text',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다.", requestId }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "PDF 파일만 업로드 가능합니다.", requestId }, { status: 400 });
    }

    // 파일 크기 제한 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "파일 크기는 10MB 이하여야 합니다.", requestId }, { status: 400 });
    }

    logPipelineStage({
      stage: "upload_received",
      requestId,
      timestamp: new Date().toISOString(),
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
    });

    // File → Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // PDF에서 텍스트 추출
    logPipelineStage({
      stage: "pdf_parse_started",
      requestId,
      timestamp: new Date().toISOString(),
      fileName: file.name,
      fileSize: file.size,
    });

    const parseStart = Date.now();
    const pdfText = await extractTextFromPDF(buffer);

    // 추출 결과가 문자열이 아닌 경우 (pdf-parse v2 내부 이슈 대응)
    const text = typeof pdfText === "string" ? pdfText : "";

    if (!text || text.trim().length === 0) {
      logPipelineStage({
        stage: "pdf_parse_failed",
        requestId,
        timestamp: new Date().toISOString(),
        errorCode: "PDF_NO_TEXT",
        errorMessage: "Extracted text is empty",
        durationMs: Date.now() - parseStart,
        fileName: file.name,
        fileSize: file.size,
      });

      return NextResponse.json({
        error: "PDF에서 텍스트를 추출할 수 없습니다. 스캔된 이미지 PDF이거나 텍스트 레이어가 없는 파일일 수 있습니다.",
        code: "PDF_NO_TEXT",
        requestId,
      }, { status: 422 });
    }

    const durationMs = Date.now() - parseStart;

    logPipelineStage({
      stage: "pdf_parse_completed",
      requestId,
      timestamp: new Date().toISOString(),
      extractedTextLength: text.length,
      textPreview: text.slice(0, 300),
      durationMs,
      fileName: file.name,
      fileSize: file.size,
    });

    return NextResponse.json({
      text,
      length: text.length,
      extractedTextLength: text.length,
      textPreview: text.slice(0, 300),
      requestId,
    });
  } catch (error: any) {
    const msg = error?.message ?? "";
    const name = error?.name ?? error?.constructor?.name ?? "";
    const durationMs = Date.now() - pipelineStart;
    console.error("[extract-pdf-text] Error:", msg, "| name:", name);

    // 에러 분류 (msg + error class name 모두 검사)

    // 1. 런타임/환경 에러 (DOMMatrix, window, document 등)
    if (/DOMMatrix|is not defined|window|document|navigator/i.test(msg)) {
      logPipelineStage({
        stage: "pdf_parse_failed",
        requestId,
        timestamp: new Date().toISOString(),
        errorCode: "PDF_RUNTIME_ERROR",
        errorMessage: msg,
        durationMs,
      });
      return NextResponse.json({
        error: "이 PDF는 현재 환경에서 바로 읽을 수 없습니다. 텍스트 붙여넣기로 계속 진행하거나 다른 PDF로 다시 시도해 주세요.",
        code: "RUNTIME_ERROR",
        requestId,
        details: process.env.NODE_ENV === "development" ? msg : undefined,
      }, { status: 500 });
    }

    // 2. 암호화된 PDF
    if (/password|encrypted/i.test(msg) || name === "PasswordException") {
      logPipelineStage({
        stage: "pdf_parse_failed",
        requestId,
        timestamp: new Date().toISOString(),
        errorCode: "PDF_ENCRYPTED",
        errorMessage: msg,
        durationMs,
      });
      return NextResponse.json({
        error: "암호로 보호된 PDF입니다. 암호를 해제한 후 다시 시도해 주세요.",
        code: "PDF_ENCRYPTED",
        requestId,
      }, { status: 422 });
    }

    // 3. 손상된 / 유효하지 않은 PDF
    if (/invalid|corrupt|damaged|structure|parse|stream|xref|trailer|startxref/i.test(msg) || name === "InvalidPDFException" || name === "FormatError") {
      logPipelineStage({
        stage: "pdf_parse_failed",
        requestId,
        timestamp: new Date().toISOString(),
        errorCode: "PDF_CORRUPT",
        errorMessage: msg,
        durationMs,
      });
      return NextResponse.json({
        error: "PDF 파일이 손상되었거나 지원하지 않는 형식입니다. 파일을 확인하거나 텍스트 붙여넣기로 진행해 주세요.",
        code: "PDF_INVALID",
        requestId,
      }, { status: 422 });
    }

    // 4. 모듈/클래스 문제
    if (/PDFParse.*찾을 수 없|모듈/i.test(msg)) {
      logPipelineStage({
        stage: "pdf_parse_failed",
        requestId,
        timestamp: new Date().toISOString(),
        errorCode: "PDF_MODULE_ERROR",
        errorMessage: msg,
        durationMs,
      });
      return NextResponse.json({
        error: "PDF 분석 모듈에 문제가 발생했습니다. 텍스트 붙여넣기로 진행해 주세요.",
        code: "MODULE_ERROR",
        requestId,
        details: process.env.NODE_ENV === "development" ? msg : undefined,
      }, { status: 500 });
    }

    // 5. 스캔본 / 텍스트 없음
    if (/텍스트.*없|no text|empty|스캔|빈 문서/i.test(msg)) {
      logPipelineStage({
        stage: "pdf_parse_failed",
        requestId,
        timestamp: new Date().toISOString(),
        errorCode: "PDF_NO_TEXT",
        errorMessage: msg,
        durationMs,
      });
      return NextResponse.json({
        error: "이 PDF에는 텍스트 레이어가 없습니다. 스캔된 이미지 PDF일 수 있습니다. 텍스트 붙여넣기로 진행해 주세요.",
        code: "PDF_NO_TEXT",
        requestId,
      }, { status: 422 });
    }

    // 6. 기타 에러 — 상세 로그 남기고 사용자 안내
    logPipelineStage({
      stage: "pdf_parse_failed",
      requestId,
      timestamp: new Date().toISOString(),
      errorCode: "UNKNOWN",
      errorMessage: msg,
      durationMs,
    });
    console.error("[extract-pdf-text] Unclassified error stack:", error?.stack);
    return NextResponse.json({
      error: "PDF 분석에 실패했습니다. 파일이 손상되었거나 지원하지 않는 형식일 수 있습니다. 텍스트 붙여넣기로 계속 진행할 수 있습니다.",
      code: "PDF_PARSE_ERROR",
      requestId,
      details: process.env.NODE_ENV === "development" ? error?.stack : undefined,
    }, { status: 500 });
  }
}
