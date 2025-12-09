/**
 * PDF 버퍼에서 텍스트 추출
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  try {
    // pdf-parse는 ESM 모듈이므로 dynamic import 사용
    const pdfParseModule = await import("pdf-parse");
    const pdfParse = pdfParseModule.default || pdfParseModule;
    const data = await pdfParse(pdfBuffer);
    return data.text;
  } catch (error) {
    console.error("Error parsing PDF:", error);
    throw new Error("PDF 파싱에 실패했습니다.");
  }
}



