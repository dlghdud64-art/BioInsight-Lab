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
