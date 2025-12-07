import { NextResponse } from "next/server";

/**
 * 클라이언트에서 환경 변수 설정을 확인할 수 있는 API
 * 보안상 민감하지 않은 설정만 반환
 */
export async function GET() {
  const pdfMode = process.env.PDF_MODE || "paste-only";
  
  return NextResponse.json({
    pdfMode,
    pdfUploadEnabled: pdfMode === "server-upload",
  });
}



