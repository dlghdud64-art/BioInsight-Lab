/**
 * oauth.ts — 모바일 Google OAuth 로그인
 *
 * expo-auth-session + expo-web-browser로 Google OAuth 플로우를 처리.
 * 웹 NextAuth의 Google provider와 동일한 identity를 재사용.
 *
 * 흐름:
 * 1. Google OAuth consent screen 열기 (WebBrowser)
 * 2. authorization code 수신
 * 3. 서버 /api/mobile/auth/oauth-callback으로 code 전송
 * 4. 서버가 Google에서 토큰 교환 → user 조회/생성 → mobile JWT 발급
 * 5. 모바일에 accessToken + refreshToken 저장
 */

import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import Constants from "expo-constants";

// Expo managed app에서 WebBrowser warm-up
WebBrowser.maybeCompleteAuthSession();

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

// Google OAuth config
// EXPO_PUBLIC_GOOGLE_CLIENT_ID는 Google Cloud Console에서 발급한 OAuth 2.0 Client ID
// Web application 타입 (모바일도 AuthSession proxy를 통해 같은 client ID 사용)
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "";

// Expo AuthSession에서 redirect URI 자동 생성
const redirectUri = AuthSession.makeRedirectUri({
  scheme: "bioinsight",
  path: "oauth-callback",
});

// Discovery document (Google OpenID Connect)
const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

export interface OAuthResult {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

/**
 * Google OAuth 로그인 시작.
 * WebBrowser에서 consent screen을 열고, callback으로 돌아온 code를
 * 서버에 전송하여 JWT를 발급받는다.
 */
export async function signInWithGoogle(): Promise<OAuthResult> {
  try {
    if (!GOOGLE_CLIENT_ID) {
      return { success: false, error: "Google Client ID가 설정되지 않았습니다." };
    }

    // 1. AuthSession request 생성
    const request = new AuthSession.AuthRequest({
      clientId: GOOGLE_CLIENT_ID,
      redirectUri,
      scopes: ["openid", "email", "profile"],
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    });

    // 2. Google consent screen 열기
    const result = await request.promptAsync(discovery);

    if (result.type !== "success" || !result.params?.code) {
      if (result.type === "cancel" || result.type === "dismiss") {
        return { success: false, error: "로그인이 취소되었습니다." };
      }
      return { success: false, error: "Google 인증에 실패했습니다." };
    }

    // 3. 서버에 authorization code 전송 → JWT 발급
    const serverResponse = await fetch(`${API_BASE_URL}/api/mobile/auth/oauth-callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: result.params.code,
        codeVerifier: request.codeVerifier,
        redirectUri,
      }),
    });

    if (!serverResponse.ok) {
      const err = await serverResponse.json().catch(() => ({}));
      return { success: false, error: err.error ?? "서버 인증에 실패했습니다." };
    }

    const data = await serverResponse.json();

    // 4. JWT 저장
    await SecureStore.setItemAsync("accessToken", data.accessToken);
    await SecureStore.setItemAsync("refreshToken", data.refreshToken);

    return {
      success: true,
      user: data.user,
    };
  } catch (err: any) {
    console.error("[OAuth] Error:", err);
    return {
      success: false,
      error: err?.message ?? "로그인 중 오류가 발생했습니다.",
    };
  }
}

/**
 * 로그아웃 — 토큰 삭제 + 로그인 화면으로 이동
 */
export async function signOut() {
  await SecureStore.deleteItemAsync("accessToken");
  await SecureStore.deleteItemAsync("refreshToken");
  router.replace("/(auth)/login");
}
