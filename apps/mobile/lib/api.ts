import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import { Sentry } from "./sentry";

// 환경변수에서 API URL 가져오기 (없으면 로컬호스트)
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 요청 인터셉터: accessToken 자동 삽입
apiClient.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 응답 인터셉터: 401 → 토큰 갱신 시도
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await SecureStore.getItemAsync("refreshToken");
        if (!refreshToken) throw new Error("No refresh token");

        const res = await axios.post(`${API_BASE_URL}/api/mobile/auth/refresh`, {
          refreshToken,
        });

        const { accessToken } = res.data;
        await SecureStore.setItemAsync("accessToken", accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch {
        // 갱신 실패 → 로그아웃
        await SecureStore.deleteItemAsync("accessToken");
        await SecureStore.deleteItemAsync("refreshToken");
        router.replace("/(auth)/login");
        return Promise.reject(error);
      }
    }

    // 401 이외의 서버 에러를 Sentry에 보고
    if (error.response?.status && error.response.status >= 500) {
      Sentry.captureException(error, {
        extra: {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response.status,
        },
      });
    }

    return Promise.reject(error);
  }
);

/**
 * Auth preflight — 토큰 유효성 확인 + 자동 refresh.
 * push deeplink 진입 전, 또는 앱 foreground 복귀 시 호출.
 *
 * 결과:
 * - "valid": 토큰 유효, 바로 진행 가능
 * - "refreshed": 토큰 만료 → refresh 성공
 * - "login_required": refresh도 실패 → 로그인 필요
 */
export async function authPreflight(): Promise<"valid" | "refreshed" | "login_required"> {
  const token = await SecureStore.getItemAsync("accessToken");
  if (!token) return "login_required";

  try {
    // 가벼운 API 호출로 토큰 유효성 확인
    await apiClient.get("/api/mobile/auth/verify");
    return "valid";
  } catch (err: any) {
    if (err?.response?.status === 401) {
      // 401 → interceptor가 자동 refresh 시도함
      // interceptor에서 refresh 성공하면 재시도되므로 여기까지 오면 실패
      const refreshToken = await SecureStore.getItemAsync("refreshToken");
      if (!refreshToken) return "login_required";

      try {
        const res = await axios.post(`${API_BASE_URL}/api/mobile/auth/refresh`, { refreshToken });
        const { accessToken } = res.data;
        await SecureStore.setItemAsync("accessToken", accessToken);
        return "refreshed";
      } catch {
        await SecureStore.deleteItemAsync("accessToken");
        await SecureStore.deleteItemAsync("refreshToken");
        return "login_required";
      }
    }
    // 네트워크 에러 등 → 토큰이 있으니 일단 진행 허용
    return "valid";
  }
}

export async function login(email: string, password: string) {
  const res = await apiClient.post("/api/mobile/auth/signin", {
    email,
    password,
  });
  const data = res.data as { accessToken: string; refreshToken: string; user: { id: string; name: string; email: string } };
  // Sentry 유저 컨텍스트 설정
  Sentry.setUser({ id: data.user.id, email: data.user.email });
  return data;
}
