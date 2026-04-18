/**
 * CSRF Token Bootstrap / Refresh API
 *
 * Security Batch 10: CSRF Full Enforcement
 *
 * GET /api/security/csrf-token
 * - 새 CSRF 토큰 발급
 * - __Host-labaxis-csrf cookie 설정
 * - 프론트엔드 초기화 / 토큰 갱신용
 *
 * 인증된 세션에서만 발급 (unauthenticated 요청은 차단)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { generateCsrfToken, buildCsrfCookieHeader } from '@/lib/security/csrf-token-engine';

export async function GET(_req: NextRequest) {
  // 인증 확인
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: '인증이 필요합니다' },
      { status: 401 },
    );
  }

  // 토큰 생성
  const token = await generateCsrfToken();

  // Response: cookie 설정 + 토큰 반환
  const response = NextResponse.json({ csrfToken: token });
  response.headers.set('Set-Cookie', buildCsrfCookieHeader(token));
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

  return response;
}
