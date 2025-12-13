/**
 * 에러 처리 유틸리티
 * 사용자 친화적 에러 메시지 생성
 */

export interface AppError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: any;
}

/**
 * 에러 타입에 따른 사용자 친화적 메시지 생성
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // 네트워크 에러
    if (error.message.includes("fetch") || error.message.includes("network")) {
      return "네트워크 연결을 확인해주세요. 인터넷 연결이 불안정할 수 있습니다.";
    }

    // 타임아웃 에러
    if (error.message.includes("timeout") || error.message.includes("timed out")) {
      return "요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.";
    }

    // 인증 에러
    if (error.message.includes("401") || error.message.includes("Unauthorized")) {
      return "로그인이 필요합니다. 다시 로그인해주세요.";
    }

    // 권한 에러
    if (error.message.includes("403") || error.message.includes("Forbidden")) {
      return "접근 권한이 없습니다. 관리자에게 문의해주세요.";
    }

    // 찾을 수 없음
    if (error.message.includes("404") || error.message.includes("Not Found")) {
      return "요청한 정보를 찾을 수 없습니다.";
    }

    // 서버 에러
    if (error.message.includes("500") || error.message.includes("Internal Server Error")) {
      return "서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.";
    }

    // 기본 에러 메시지
    return error.message || "알 수 없는 오류가 발생했습니다.";
  }

  // 문자열 에러
  if (typeof error === "string") {
    return error;
  }

  // 객체 형태의 에러
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }

  return "알 수 없는 오류가 발생했습니다.";
}

/**
 * API 응답에서 에러 메시지 추출
 */
export function extractApiErrorMessage(response: Response, data?: any): string {
  // 응답 본문에 에러 메시지가 있는 경우
  if (data?.error) {
    return typeof data.error === "string" ? data.error : getErrorMessage(data.error);
  }

  // 상태 코드에 따른 기본 메시지
  switch (response.status) {
    case 400:
      return "잘못된 요청입니다. 입력한 정보를 확인해주세요.";
    case 401:
      return "로그인이 필요합니다. 다시 로그인해주세요.";
    case 403:
      return "접근 권한이 없습니다. 관리자에게 문의해주세요.";
    case 404:
      return "요청한 정보를 찾을 수 없습니다.";
    case 429:
      return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
    case 500:
      return "서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.";
    case 503:
      return "서비스를 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.";
    default:
      return `오류가 발생했습니다. (${response.status})`;
  }
}

/**
 * 에러를 AppError 형태로 변환
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof Error) {
    return {
      message: getErrorMessage(error),
      code: error.name,
      details: error.stack,
    };
  }

  if (error && typeof error === "object" && "message" in error) {
    return {
      message: getErrorMessage(error),
      code: (error as any).code,
      statusCode: (error as any).statusCode,
      details: error,
    };
  }

  return {
    message: getErrorMessage(error),
  };
}

