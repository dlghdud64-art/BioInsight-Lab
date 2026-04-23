/**
 * Next.js Middleware
 *
 * 1. Page route 인증 (기존)
 * 2. API route CSRF gate (Batch 10)
 *
 * CSRF 체인:
 *   method classification → exempt 판정 → origin/referer 검증
 *   → signed double-submit token 검증 → rollout mode에 따라 차단/기록
 *
 * rollout mode (LABAXIS_CSRF_MODE env):
 *   report_only   → 기록만, 차단 없음 (기본값)
 *   soft_enforce   → highRisk(irreversible) route만 차단
 *   full_enforce   → 모든 eligible route 차단
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import {
  isProtectedMethod,
  isTrustedOrigin,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  getCsrfRolloutMode,
  shouldBlockOnViolation,
  getCsrfGovernanceMessage,
  type CsrfViolationType,
  type CsrfTelemetryEvent,
} from "@/lib/security/csrf-contract";
import { validateCsrfDoubleSubmit } from "@/lib/security/csrf-token-engine";
import { resolveCsrfConfig } from "@/lib/security/csrf-route-registry";
import {
  generateCorrelationId,
  createEventProvenance,
  recordSecurityEvent,
} from "@/lib/security/event-provenance-engine";

// ═══════════════════════════════════════════════════════
// Utility
// ═══════════════════════════════════════════════════════

function extractOriginFromReferer(referer: string | null): string | null {
  if (!referer) return null;
  try {
    const url = new URL(referer);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/** Violation → telemetry event type 매핑 */
function mapViolationToTelemetry(violation: CsrfViolationType): CsrfTelemetryEvent {
  switch (violation) {
    case 'missing_token': return 'csrf_missing_token';
    case 'token_mismatch': return 'csrf_token_mismatch';
    case 'token_expired': return 'csrf_token_expired';
    case 'origin_mismatch': return 'csrf_origin_mismatch';
    case 'missing_origin': return 'csrf_origin_mismatch';
    case 'invalid_token_format': return 'csrf_token_mismatch';
    default: return 'csrf_token_mismatch';
  }
}

/** CSRF telemetry 기록 (structured provenance) */
function recordCsrfMiddlewareTelemetry(
  event: CsrfTelemetryEvent,
  correlationId: string,
  pathname: string,
  method: string,
  origin: string | null,
  actorUserId: string,
): void {
  const provenance = createEventProvenance({
    sourceDomain: 'security',
    sourceSurface: 'csrf-middleware-gate',
    sourceRoute: pathname,
    actorUserId,
    targetEntityType: 'csrf',
    targetEntityId: 'middleware-csrf-check',
    correlationId,
    securityClassification: 'security_event',
  });

  recordSecurityEvent(
    'security_event',
    provenance,
    `CSRF middleware ${event}: method=${method} path=${pathname} origin=${origin || 'none'}`,
  );
}

function buildCsrfBlockResponse(
  violation: CsrfViolationType,
  pathname: string,
  correlationId: string,
): NextResponse {
  const message = getCsrfGovernanceMessage(violation);
  return NextResponse.json(
    { error: message, correlationId },
    { status: 403 },
  );
}

// ═══════════════════════════════════════════════════════
// Middleware
// ═══════════════════════════════════════════════════════

export default auth(async (req) => {
  const pathname = req.nextUrl.pathname;

  // ── 0. Legacy /dashboard/admin tree → /admin redirect (#30) ──
  // page-per-feature 중복 surface 제거. URL 정규화이므로 auth/role 로직보다 앞에서 처리한다.
  // 실파일 apps/web/src/app/dashboard/admin/page.tsx 삭제는 후속 commit에서 분리 (rollback safety).
  if (pathname === '/dashboard/admin' || pathname.startsWith('/dashboard/admin/')) {
    const newPath = pathname.replace(/^\/dashboard\/admin/, '/admin');
    return NextResponse.redirect(new URL(newPath + req.nextUrl.search, req.url));
  }

  // ── 1. Page route 인증 (기존 동작 유지 + /admin 트리 포함) ──
  if (
    pathname.startsWith('/app/') ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/')
  ) {
    const isLoggedIn = !!req.auth;
    if (!isLoggedIn) {
      const signInUrl = new URL("/auth/signin", req.url);
      signInUrl.searchParams.set(
        "callbackUrl",
        req.nextUrl.pathname + req.nextUrl.search,
      );
      return NextResponse.redirect(signInUrl);
    }
  }

  // ── 1b. Admin surface central authorization gate (#27) ──
  // admin 페이지(/dashboard/admin*, /admin*)와 admin API(/api/admin/*)의
  // 권한 체크를 한 곳에 고정해 route별 guard drift(TIER1/2/3)를 차단한다.
  // deny-by-default: session.user.role === 'ADMIN' 아니면 모두 차단.
  const isAdminPage =
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/dashboard/admin' ||
    pathname.startsWith('/dashboard/admin/');
  const isAdminApi = pathname.startsWith('/api/admin/');

  if (isAdminPage || isAdminApi) {
    const sessionUser = req.auth?.user as { id?: string; role?: string } | undefined;
    const role = sessionUser?.role;
    const isAdmin = role === 'ADMIN';

    if (!req.auth) {
      if (isAdminApi) {
        return NextResponse.json(
          { error: '인증이 필요합니다.' },
          { status: 401 },
        );
      }
      // admin page — 상위 page-auth 블록에서 redirect되지만 안전망으로 한 번 더.
      const signInUrl = new URL("/auth/signin", req.url);
      signInUrl.searchParams.set(
        "callbackUrl",
        req.nextUrl.pathname + req.nextUrl.search,
      );
      return NextResponse.redirect(signInUrl);
    }

    if (!isAdmin) {
      if (isAdminApi) {
        // e2e(s07-auth-access-control.spec.ts)가 "관리자 권한" 문자열 포함을 기대함.
        return NextResponse.json(
          { error: '관리자 권한이 필요합니다.' },
          { status: 403 },
        );
      }
      // non-admin이 admin page에 접근하면 대시보드 홈으로 돌려보낸다.
      // 별도 403 셸/페이지를 신설하지 않는다.
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    // ADMIN → fallthrough (CSRF gate 및 실제 route handler로 진입)
  }

  // ── 2. API route CSRF gate ──
  if (pathname.startsWith('/api/') && isProtectedMethod(req.method)) {
    const routeConfig = resolveCsrfConfig(pathname);

    // Exempt route → skip entirely
    if (routeConfig.protection === 'exempt') {
      return NextResponse.next();
    }

    // 모바일 앱 Bearer 토큰 요청은 CSRF 검증 건너뛰기
    // (모바일은 cookie 기반이 아니므로 CSRF 보호 불필요)
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return NextResponse.next();
    }

    const mode = getCsrfRolloutMode();
    const correlationId = generateCorrelationId();
    const actorUserId = req.auth?.user?.id || 'anonymous';

    // 2a. Origin / Referer 검증
    const origin = req.headers.get('origin');
    const referer = req.headers.get('referer');
    const effectiveOrigin = origin || extractOriginFromReferer(referer);

    if (!effectiveOrigin) {
      const violation: CsrfViolationType = 'missing_origin';
      recordCsrfMiddlewareTelemetry(
        mapViolationToTelemetry(violation), correlationId,
        pathname, req.method, null, actorUserId,
      );
      if (shouldBlockOnViolation(mode, routeConfig.protection, routeConfig.highRisk)) {
        return buildCsrfBlockResponse(violation, pathname, correlationId);
      }
    } else if (!isTrustedOrigin(effectiveOrigin)) {
      const violation: CsrfViolationType = 'origin_mismatch';
      recordCsrfMiddlewareTelemetry(
        mapViolationToTelemetry(violation), correlationId,
        pathname, req.method, effectiveOrigin, actorUserId,
      );
      if (shouldBlockOnViolation(mode, routeConfig.protection, routeConfig.highRisk)) {
        return buildCsrfBlockResponse(violation, pathname, correlationId);
      }
    }

    // 2b. Double-submit cookie/header token 검증
    const cookieToken =
      req.cookies.get(CSRF_COOKIE_NAME.replace('__Host-', ''))?.value ||
      req.cookies.get(CSRF_COOKIE_NAME)?.value;
    const headerToken = req.headers.get(CSRF_HEADER_NAME);

    const tokenResult = await validateCsrfDoubleSubmit(cookieToken, headerToken);

    if (!tokenResult.valid && tokenResult.violation) {
      recordCsrfMiddlewareTelemetry(
        mapViolationToTelemetry(tokenResult.violation), correlationId,
        pathname, req.method, effectiveOrigin, actorUserId,
      );
      if (shouldBlockOnViolation(mode, routeConfig.protection, routeConfig.highRisk)) {
        return buildCsrfBlockResponse(tokenResult.violation, pathname, correlationId);
      }
    }
  }

  return NextResponse.next();
});

// ═══════════════════════════════════════════════════════
// Matcher
// ═══════════════════════════════════════════════════════

export const config = {
  matcher: [
    "/app/:path*",
    "/dashboard/:path*",
    "/admin/:path*",
    "/api/:path*",
  ],
};
