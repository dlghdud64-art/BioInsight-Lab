/**
 * PDF 버퍼에서 텍스트 추출
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  try {
    // pdf-parse는 ESM 모듈이므로 dynamic import 사용
    const pdfParseModule = await import("pdf-parse");
    // pdf-parse는 CommonJS 모듈이므로 default export가 없을 수 있음
    const pdfParse = (pdfParseModule as any).default || pdfParseModule;
    if (typeof pdfParse !== 'function') {
      throw new Error("pdf-parse 모듈을 올바르게 로드할 수 없습니다.");
    }
    const data = await pdfParse(pdfBuffer);
    return data.text;
  } catch (error) {
    console.error("Error parsing PDF:", error);
    throw new Error("PDF 파싱에 실패했습니다.");
  }
}



