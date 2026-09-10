import { NextResponse } from "next/server";

/**
 * 클라이언트에서 환경 변수 설정을 확인할 수 있는 API
 * 보안상 민감하지 않은 설정만 반환
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







