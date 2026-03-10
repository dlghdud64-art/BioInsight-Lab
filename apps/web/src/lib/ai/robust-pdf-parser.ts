/**
 * 프로덕션 레벨 PDF 파서 (pdf-parse v2.x 대응)
 * Universal Handler: 어떤 PDF든 처리
 * - pdf-parse v2 클래스 API 사용
 * - 텍스트 레이어 없는 PDF 감지 및 명확한 에러
 * - Fail-safe 아키텍처
 */

export interface RobustPDFResult {
  text: string;
  extractionMethod: "pdf-parse" | "fallback" | "ocr-required";
  success: boolean;
  error?: string;
  metadata?: {
    pages?: number;
    hasTextLayer?: boolean;
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
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength
    );

    const parser = new PDFParseClass(uint8Data);
    await parser.load();

    let text = "";
    try {
      text = parser.getText();
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
 * Robust PDF Parser - Production Level
 */
export async function robustParsePDF(
  pdfBuffer: Buffer
): Promise<RobustPDFResult> {
  console.log("[Robust PDF Parser] Starting extraction...");

  const pdfParseResult = await tryPdfParse(pdfBuffer);

  if (pdfParseResult && pdfParseResult.text) {
    const cleanedText = cleanExtractedText(pdfParseResult.text);
    const hasText = hasTextLayer(cleanedText, pdfParseResult.pages);

    if (hasText) {
      console.log("[Robust PDF Parser] Success with pdf-parse");
      return {
        text: cleanedText,
        extractionMethod: "pdf-parse",
        success: true,
        metadata: {
          pages: pdfParseResult.pages,
          hasTextLayer: true,
        },
      };
    } else {
      console.warn(
        "[Robust PDF Parser] Text layer too short, likely image-based PDF"
      );
      return {
        text: "",
        extractionMethod: "ocr-required",
        success: false,
        error:
          "텍스트 레이어가 없는 PDF입니다. 스캔된 이미지 PDF는 OCR 처리가 필요합니다.",
        metadata: {
          pages: pdfParseResult.pages,
          hasTextLayer: false,
        },
      };
    }
  }

  console.warn(
    "[Robust PDF Parser] pdf-parse failed, no fallback available"
  );

  return {
    text: "",
    extractionMethod: "fallback",
    success: false,
    error:
      "PDF 텍스트 추출에 실패했습니다. 파일이 손상되었거나 암호화되어 있을 수 있습니다.",
  };
}
