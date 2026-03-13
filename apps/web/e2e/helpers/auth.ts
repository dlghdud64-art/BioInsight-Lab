import { type Page, expect } from "@playwright/test";

/**
 * Google OAuth를 우회하여 세션 쿠키를 직접 주입하는 헬퍼.
 * 테스트 환경에서는 NextAuth 세션 토큰을 DB에 직접 생성하거나
 * 쿠키를 주입하여 인증 상태를 만듭니다.
 *
 * 환경변수:
 *  - E2E_SESSION_TOKEN: 미리 생성된 NextAuth 세션 토큰
 *  - E2E_BASE_URL: 테스트 대상 서버 URL
 */

export async function loginWithSession(page: Page): Promise<void> {
  const sessionToken = process.env.E2E_SESSION_TOKEN;
  const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";

  if (!sessionToken) {
    throw new Error(
      "E2E_SESSION_TOKEN 환경변수가 필요합니다. " +
        "DB에서 세션 토큰을 생성하거나 .env.e2e 파일에 설정하세요."
    );
  }

  // NextAuth 세션 쿠키 주입
  const domain = new URL(baseURL).hostname;
  await page.context().addCookies([
    {
      name: "next-auth.session-token",
      value: sessionToken,
      domain,
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

export async function loginAsAdmin(page: Page): Promise<void> {
  const sessionToken = process.env.E2E_ADMIN_SESSION_TOKEN;
  const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";

  if (!sessionToken) {
    throw new Error(
      "E2E_ADMIN_SESSION_TOKEN 환경변수가 필요합니다."
    );
  }

  const domain = new URL(baseURL).hostname;
  await page.context().addCookies([
    {
      name: "next-auth.session-token",
      value: sessionToken,
      domain,
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

/** 현재 로그인 상태 확인 */
export async function expectAuthenticated(page: Page): Promise<void> {
  const cookies = await page.context().cookies();
  const session = cookies.find(
    (c) => c.name === "next-auth.session-token"
  );
  expect(session).toBeTruthy();
}
