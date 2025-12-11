import { NextResponse } from "next/server";

/**
 * í´ë¼ì´ì¸í¸ìì íê²½ ë³ì ì¤ì ì íì¸í  ì ìë API
 * ë³´ìì ë¯¼ê°íì§ ìì ì¤ì ë§ ë°í
 */
export async function GET() {
  // 환경 변수가 없으면 개발 환경에서는 기본적으로 PDF 업로드 활성화
  const defaultMode = process.env.NODE_ENV === "production" ? "paste-only" : "server-upload";
  const pdfMode = process.env.PDF_MODE || defaultMode;
  
  return NextResponse.json({
    pdfMode,
    pdfUploadEnabled: pdfMode === "server-upload",
  });
}







