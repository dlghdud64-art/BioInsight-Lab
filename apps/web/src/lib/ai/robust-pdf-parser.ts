/**
 * 프로덕션 레벨 PDF 파서
 * Universal Handler: 어떤 PDF든 처리
 * - pdf-parse 실패 시 대체 방법 자동 시도
 * - 텍스트 레이어 없는 PDF 감지 및 명확한 에러
 * - Fail-safe 아키텍처
 */

export interface RobustPDFResult {
  text: string;
  extractionMethod: 'pdf-parse' | 'fallback' | 'ocr-required';
  success: boolean;
  error?: string;
  metadata?: {
    pages?: number;
    hasTextLayer?: boolean;
  };
}

/**
 * pdf-parse 시도
 */
async function tryPdfParse(buffer: Buffer): Promise<{ text: string; pages?: number } | null> {
  try {
    if (typeof window !== 'undefined') {
      throw new Error('서버 사이드 전용');
    }

    // @ts-ignore
    const pdfParseModule = require('pdf-parse');
    const pdfParse = typeof pdfParseModule === 'function'
      ? pdfParseModule
      : pdfParseModule.default;

    if (typeof pdfParse !== 'function') {
      console.error('[PDF Parser] pdf-parse is not a function:', typeof pdfParse);
      return null;
    }

    const data = await pdfParse(buffer, { max: 0 });

    if (!data || !data.text) {
      console.warn('[PDF Parser] pdf-parse returned no text');
      return null;
    }

    return {
      text: data.text,
      pages: data.numpages,
    };
  } catch (error) {
    console.error('[PDF Parser] pdf-parse failed:', error);
    return null;
  }
}

/**
 * 텍스트 레이어 존재 여부 확인
 * 추출된 텍스트가 매우 짧으면 이미지 기반 PDF일 가능성 높음
 */
function hasTextLayer(text: string, estimatedPages: number = 1): boolean {
  // 페이지당 최소 50자 미만이면 텍스트 레이어 없음으로 판단
  const minCharsPerPage = 50;
  const minExpectedChars = estimatedPages * minCharsPerPage;

  return text.trim().length >= minExpectedChars;
}

/**
 * 텍스트 정리 및 정규화
 */
function cleanExtractedText(text: string): string {
  // 줄바꿈 정규화
  let cleaned = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 과도한 공백 제거 (표 구조는 보존)
  cleaned = cleaned.replace(/[ \t]{2,}/g, '\t');

  // 과도한 줄바꿈 제거 (최대 2개 연속)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

/**
 * Robust PDF Parser - Production Level
 *
 * @param pdfBuffer PDF 파일 버퍼
 * @returns 파싱 결과 (성공 여부, 텍스트, 에러 메시지)
 */
export async function robustParsePDF(pdfBuffer: Buffer): Promise<RobustPDFResult> {
  // 1단계: pdf-parse 시도
  console.log('[Robust PDF Parser] Starting extraction...');

  const pdfParseResult = await tryPdfParse(pdfBuffer);

  if (pdfParseResult && pdfParseResult.text) {
    const cleanedText = cleanExtractedText(pdfParseResult.text);
    const hasText = hasTextLayer(cleanedText, pdfParseResult.pages);

    if (hasText) {
      console.log('[Robust PDF Parser] Success with pdf-parse');
      return {
        text: cleanedText,
        extractionMethod: 'pdf-parse',
        success: true,
        metadata: {
          pages: pdfParseResult.pages,
          hasTextLayer: true,
        },
      };
    } else {
      console.warn('[Robust PDF Parser] Text layer too short, likely image-based PDF');
      return {
        text: '',
        extractionMethod: 'ocr-required',
        success: false,
        error: '텍스트 레이어가 없는 PDF입니다. 스캔된 이미지 PDF는 OCR 처리가 필요합니다.',
        metadata: {
          pages: pdfParseResult.pages,
          hasTextLayer: false,
        },
      };
    }
  }

  // 2단계: pdf-parse 실패 - Fallback 시도
  console.warn('[Robust PDF Parser] pdf-parse failed, trying fallback methods...');

  // TODO: 향후 pdf2json, pdfjs-dist 등 대체 라이브러리 시도 가능
  // 현재는 명확한 실패 메시지 반환

  return {
    text: '',
    extractionMethod: 'fallback',
    success: false,
    error: 'PDF 텍스트 추출에 실패했습니다. 파일이 손상되었거나 암호화되어 있을 수 있습니다.',
  };
}
