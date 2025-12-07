/**
 * 환경변수 헬퍼 함수
 * Vercel 배포 환경에서 자동으로 URL을 감지하도록 지원
 */

/**
 * 앱의 기본 URL을 반환합니다.
 * Vercel 환경에서는 VERCEL_URL을 사용하고, 그 외에는 NEXTAUTH_URL 또는 로컬호스트를 사용합니다.
 */
export function getAppUrl(): string {
  // Vercel 환경 변수 우선 사용
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // NEXTAUTH_URL이 설정되어 있으면 사용
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }

  // 개발 환경에서는 localhost 사용
  if (process.env.NODE_ENV === "development") {
    return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  }

  // 프로덕션 환경에서도 기본값 제공 (경고와 함께)
  console.warn(
    "⚠️  NEXTAUTH_URL 또는 VERCEL_URL이 설정되지 않았습니다. 기본값을 사용합니다."
  );
  return "https://bioinsight-demo.vercel.app";
}

/**
 * 데이터베이스 연결이 가능한지 확인합니다.
 * 데모 환경에서는 연결 실패 시에도 앱이 계속 작동하도록 합니다.
 */
export function isDatabaseAvailable(): boolean {
  return !!process.env.DATABASE_URL;
}

/**
 * 데모 모드인지 확인합니다.
 * DATABASE_URL이 없거나 특정 환경변수가 설정되어 있으면 데모 모드로 간주합니다.
 */
export function isDemoMode(): boolean {
  return (
    !isDatabaseAvailable() ||
    process.env.DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development"
  );
}

