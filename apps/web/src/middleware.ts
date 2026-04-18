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

  // ── 1. Page route 인증 (기존 동작 유지) ──
  if (
    pathname.startsWith('/app/') ||
    pathname.startsWith('/dashboard/')
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
    "/api/:path*",
  ],
};
