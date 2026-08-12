import { NextResponse } from "next/server";

/**
 * í´ë¼ì´ì¸í¸ìì íê²½ ë³ì ì¤ì ì íì¸í  ì ìë API
 * ë³´ìì ë¯¼ê°íì§ ìì ì¤ì ë§ ë°í
 */
export async function GET() {
  // PDF_MODE 환경 변수 확인
  // - "server-upload": PDF 업로드 활성화
  // - "paste-only": 텍스트 붙여넣기만 가능
  // - 미설정 시: 기본적으로 활성화 (개발/프로덕션 모두)
  const pdfMode = process.env.PDF_MODE || "server-upload";
  const pdfUploadEnabled = pdfMode === "server-upload";
  
  return NextResponse.json({
    pdfMode,
    pdfUploadEnabled,
  });
}







