/**
 * mobile-jwt.ts
 *
 * 모바일 앱의 Bearer JWT 토큰을 검증하여 세션 객체로 변환.
 *
 * 웹은 NextAuth 세션, 모바일은 자체 JWT를 사용한다.
 * API route에서 auth()가 null을 반환하면 (모바일 Bearer 요청),
 * 이 함수로 fallback 인증을 수행한다.
 *
 * 사용법 (API route):
 *   const session = await auth();
 *   const user = session?.user ?? await verifyMobileToken(request);
 */

import { jwtVerify } from "jose";
import { NextRequest } from "next/server";

const jwtSecretRaw = process.env.MOBILE_JWT_SECRET || process.env.AUTH_SECRET || "";
const JWT_SECRET = new TextEncoder().encode(jwtSecretRaw);

interface MobileUser {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
}

/**
 * Authorization: Bearer <token> 헤더에서 모바일 JWT를 검증.
 * 유효하면 user 객체 반환, 아니면 null.
 */
export async function verifyMobileToken(request: NextRequest): Promise<MobileUser | null> {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;

    const token = authHeader.slice(7);
    if (!token || !jwtSecretRaw) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET);

    if (!payload.sub || !payload.email) return null;

    return {
      id: payload.sub as string,
      email: payload.email as string,
      name: (payload.name as string) ?? null,
      role: (payload.role as string) ?? null,
    };
  } catch {
    // 만료, 서명 불일치 등
    return null;
  }
}

/**
 * API route에서 웹 세션 또는 모바일 토큰으로 사용자를 인증.
 * 웹 auth() 세션이 있으면 그대로 사용하고,
 * 없으면 Bearer 토큰을 검증한다.
 */
export async function getAuthUser(
  webSession: { user?: { id?: string; email?: string; name?: string; role?: string } } | null,
  request: NextRequest,
): Promise<{ id: string; email?: string; name?: string; role?: string } | null> {
  // 1. 웹 세션 우선
  if (webSession?.user?.id) {
    return {
      id: webSession.user.id,
      email: webSession.user.email ?? undefined,
      name: webSession.user.name ?? undefined,
      role: webSession.user.role ?? undefined,
    };
  }

  // 2. 모바일 JWT fallback
  const mobileUser = await verifyMobileToken(request);
  if (mobileUser) {
    return {
      id: mobileUser.id,
      email: mobileUser.email,
      name: mobileUser.name ?? undefined,
      role: mobileUser.role ?? undefined,
    };
  }

  return null;
}
