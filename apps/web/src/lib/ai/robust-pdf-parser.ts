/**
 * 프로덕션 레벨 PDF 파서 (pdf-parse v2.x 대응)
 * Universal Handler: 어떤 PDF든 처리
 * - pdf-parse v2 클래스 API 사용
 * - 텍스트 레이어 없는 PDF 감지 및 명확한 에러
 * - Fail-safe 아키텍처
 * - 구조화 진단 로깅 (requestId + 타이밍)
 */

import {
  logPipelineStage,
  createRequestId,
  type PipelineErrorCode,
} from "./pipeline-logger";

export interface RobustPDFResult {
  text: string;
  extractionMethod: "pdf-parse" | "fallback" | "ocr-required";
  success: boolean;
  error?: string;
  errorCode?:
    | "PDF_NO_TEXT"
    | "PDF_ENCRYPTED"
    | "PDF_INVALID"
    | "PDF_CORRUPT"
    | "MODULE_ERROR"
    | "RUNTIME_ERROR";
  requestId: string;
  metadata?: {
    pages?: number;
    hasTextLayer?: boolean;
    extractedTextLength?: number;
    textPreview?: string;
    fileSize?: number;
    durationMs?: number;
  };
}

/**
 * pdf-parse v2 시도
 */
async function tryPdfParse(
  buffer: Buffer
): Promise<{ text: string; pages?: number } | null> {
  try {
    if (typeof window !== "undefined") {
      throw new Error("서버 사이드 전용");
    }

    // @ts-ignore
    const pdfParseModule = require("pdf-parse");
    const PDFParseClass =
      pdfParseModule.PDFParse ?? pdfParseModule.default?.PDFParse;

    if (typeof PDFParseClass !== "function") {
      console.error(
        "[PDF Parser] PDFParse class not found. Module keys:",
        Object.keys(pdfParseModule)
      );
      return null;
    }

    // Buffer → Uint8Array (pdf-parse v2 요구사항)
    const uint8Data = new Uint8Array(
      (buffer as any).buffer,
      (buffer as any).byteOffset,
      (buffer as any).byteLength
    );

    // standardFontDataUrl 설정
    let standardFontDataUrl: string | undefined;
    try {
      const path = require("path");
      standardFontDataUrl = path.join(
        path.dirname((require.resolve as any)("pdfjs-dist/package.json")),
        "standard_fonts/"
      );
    } catch {
      // 경로 탐색 실패 시 무시
    }

    const parserOptions: Record<string, unknown> = {};
    if (standardFontDataUrl) {
      parserOptions.standardFontDataUrl = standardFontDataUrl;
    }
    const parser = new PDFParseClass(uint8Data, parserOptions);
    await parser.load();

    let text = "";
    try {
      const result = parser.getText();
      // pdf-parse v2가 객체를 반환하는 경우 대응
      text = typeof result === "string" ? result : String(result ?? "");
    } catch {
      // getText 실패 시 개별 페이지 추출
      const doc = parser.doc ?? (parser as any).document;
      const numPages = doc?.numPages ?? 0;
      const parts: string[] = [];
      for (let i = 1; i <= numPages; i++) {
        try {
          const pt = parser.getPageText(i);
          if (pt) parts.push(pt);
        } catch {
          // 페이지별 실패 무시
        }
      }
      text = parts.join("\n\n");
    }

    // 파서 정리
    try {
      parser.destroy?.();
    } catch {
      // 정리 실패 무시
    }

    if (!text) {
      console.warn("[PDF Parser] pdf-parse returned no text");
      return null;
    }

    // 페이지 수 추출 시도
    let pages: number | undefined;
    try {
      const info = parser.getInfo?.();
      pages = info?.numPages;
    } catch {
      // ignore
    }

    return { text, pages };
  } catch (error) {
    console.error("[PDF Parser] pdf-parse failed:", error);
    return null;
  }
}

/**
 * 텍스트 레이어 존재 여부 확인
 */
function hasTextLayer(text: string, estimatedPages: number = 1): boolean {
  const minCharsPerPage = 50;
  const minExpectedChars = estimatedPages * minCharsPerPage;
  return text.trim().length >= minExpectedChars;
}

/**
 * 텍스트 정리 및 정규화
 */
function cleanExtractedText(text: string): string {
  let cleaned = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  cleaned = cleaned.replace(/[ \t]{2,}/g, "\t");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  return cleaned.trim();
}

/**
 * 에러 메시지에서 errorCode 분류
 */
function classifyPdfError(
  error: unknown
): { errorCode: RobustPDFResult["errorCode"]; message: string } {
  const msg =
    error instanceof Error ? error.message : String(error ?? "unknown");
  const name =
    error instanceof Error
      ? (error as any).name ?? error.constructor?.name ?? ""
      : "";

  if (/password|encrypted/i.test(msg) || name === "PasswordException") {
    return { errorCode: "PDF_ENCRYPTED", message: msg };
  }
  if (
    /invalid|corrupt|damaged|xref|trailer|startxref/i.test(msg) ||
    name === "InvalidPDFException" ||
    name === "FormatError"
  ) {
    return { errorCode: "PDF_INVALID", message: msg };
  }
  if (/PDFParse.*찾을 수 없|모듈/i.test(msg)) {
    return { errorCode: "MODULE_ERROR", message: msg };
  }
  if (/DOMMatrix|is not defined|window|document|navigator/i.test(msg)) {
    return { errorCode: "RUNTIME_ERROR", message: msg };
  }
  return { errorCode: undefined, message: msg };
}

/**
 * Robust PDF Parser - Production Level
 */
export async function robustParsePDF(
  pdfBuffer: Buffer,
  fileSize?: number
): Promise<RobustPDFResult> {
  const requestId = createRequestId();
  const startTime = Date.now();

  logPipelineStage({
    stage: "pdf_parse_started",
    requestId,
    timestamp: new Date().toISOString(),
    fileSize,
  });

  try {
    const pdfParseResult = await tryPdfParse(pdfBuffer);
    const durationMs = Date.now() - startTime;

    if (pdfParseResult && pdfParseResult.text) {
      const cleanedText = cleanExtractedText(pdfParseResult.text);
      const hasText = hasTextLayer(cleanedText, pdfParseResult.pages);

      if (hasText) {
        const result: RobustPDFResult = {
          text: cleanedText,
          extractionMethod: "pdf-parse",
          success: true,
          requestId,
          metadata: {
            pages: pdfParseResult.pages,
            hasTextLayer: true,
            extractedTextLength: cleanedText.length,
            textPreview: cleanedText.slice(0, 300),
            fileSize,
            durationMs,
          },
        };

        logPipelineStage({
          stage: "pdf_parse_completed",
          requestId,
          timestamp: new Date().toISOString(),
          extractionMethod: "pdf-parse",
          extractedTextLength: cleanedText.length,
          pageCount: pdfParseResult.pages,
          hasTextLayer: true,
          durationMs,
          fileSize,
        });

        return result;
      } else {
        // 텍스트 레이어가 너무 짧음 — 이미지 기반 PDF
        logPipelineStage({
          stage: "pdf_parse_failed",
          requestId,
          timestamp: new Date().toISOString(),
          errorCode: "PDF_NO_TEXT",
          errorMessage:
            "Text layer too short, likely image-based PDF",
          extractedTextLength: cleanedText.length,
          pageCount: pdfParseResult.pages,
          hasTextLayer: false,
          durationMs,
          fileSize,
        });

        return {
          text: "",
          extractionMethod: "ocr-required",
          success: false,
          error:
            "텍스트 레이어가 없는 PDF입니다. 스캔된 이미지 PDF는 OCR 처리가 필요합니다.",
          errorCode: "PDF_NO_TEXT",
          requestId,
          metadata: {
            pages: pdfParseResult.pages,
            hasTextLayer: false,
            extractedTextLength: cleanedText.length,
            textPreview: cleanedText.slice(0, 300) || undefined,
            fileSize,
            durationMs,
          },
        };
      }
    }

    // pdf-parse 완전 실패 (null 반환)
    logPipelineStage({
      stage: "pdf_parse_failed",
      requestId,
      timestamp: new Date().toISOString(),
      errorCode: "PDF_CORRUPT",
      errorMessage: "pdf-parse returned null — file may be corrupt or encrypted",
      durationMs,
      fileSize,
    });

    return {
      text: "",
      extractionMethod: "fallback",
      success: false,
      error:
        "PDF 텍스트 추출에 실패했습니다. 파일이 손상되었거나 암호화되어 있을 수 있습니다.",
      errorCode: "PDF_CORRUPT",
      requestId,
      metadata: {
        fileSize,
        durationMs,
      },
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const { errorCode, message } = classifyPdfError(error);

    logPipelineStage({
      stage: "pdf_parse_failed",
      requestId,
      timestamp: new Date().toISOString(),
      errorCode: (errorCode as PipelineErrorCode) ?? "UNKNOWN",
      errorMessage: message,
      durationMs,
      fileSize,
    });

    return {
      text: "",
      extractionMethod: "fallback",
      success: false,
      error:
        "PDF 텍스트 추출에 실패했습니다. 파일이 손상되었거나 암호화되어 있을 수 있습니다.",
      errorCode: errorCode ?? "RUNTIME_ERROR",
      requestId,
      metadata: {
        fileSize,
        durationMs,
      },
    };
  }
}
