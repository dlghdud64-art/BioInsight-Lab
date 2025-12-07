import pdfParse from "pdf-parse";

/**
 * PDF 버퍼에서 텍스트 추출
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(pdfBuffer);
    return data.text;
  } catch (error) {
    console.error("Error parsing PDF:", error);
    throw new Error("PDF 파싱에 실패했습니다.");
  }
}



