import { NextResponse } from "next/server";

/**
 * í´ë¼ì´ì¸í¸ìì íê²½ ë³ì ì¤ì ì íì¸í  ì ìë API
 * ë³´ìì ë¯¼ê°íì§ ìì ì¤ì ë§ ë°í
 */
export async function GET() {
  const pdfMode = process.env.PDF_MODE || "paste-only";
  
  return NextResponse.json({
    pdfMode,
    pdfUploadEnabled: pdfMode === "server-upload",
  });
}






