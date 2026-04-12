import axios from "axios";

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.code === "ECONNABORTED") return "서버 응답이 너무 느립니다. 잠시 후 다시 시도해주세요.";
    if (!error.response) return "네트워크 연결을 확인해주세요.";
    const status = error.response.status;
    if (status === 400) return error.response.data?.message || "입력값을 확인해주세요.";
    if (status === 403) return "권한이 없습니다.";
    if (status === 404) return "데이터를 찾을 수 없습니다.";
    if (status === 409) return "이미 처리된 요청입니다.";
    if (status >= 500) return "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }
  return "알 수 없는 오류가 발생했습니다.";
}
