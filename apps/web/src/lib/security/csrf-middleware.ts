/**
 * CSRF Middleware
 *
 * Security Batch 10: CSRF Full Enforcement
 *
 * withEnforcement() 체인과 enforceAction() inline 패턴 양쪽에서 사용하는
 * 서버 authoritative CSRF 검증 middleware.
 *
 * 체인 순서:
 * 1. session resolve
 * 2. method classification → exempt이면 skip
 * 3. origin / referer validation
 * 4. csrf token validation (double-submit)
 * 5. (이후) permission → replay → concurrency → handler → audit
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  CSRF_HEADER_NAME,
  CSRF_COOKIE_NAME,
  type CsrfRolloutMode,
  type CsrfProtectionLevel,
  type CsrfViolationType,
  type CsrfTelemetryEvent,
  getCsrfRolloutMode,
  getCsrfGovernanceMessage,
  isProtectedMethod,
  isTrustedOrigin,
  shouldBlockOnViolation,
} from './csrf-contract';
import {
  validateCsrfDoubleSubmit,
} from './csrf-token-engine';
import {
  recordSecurityEvent,
  createEventProvenance,
} from './event-provenance-engine';

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════

export interface CsrfCheckContext {
  readonly req: NextRequest;
  readonly correlationId: string;
  readonly protection: CsrfProtectionLevel;
  readonly highRisk?: boolean;
  readonly sourceSurface: string;
  readonly actorUserId?: string;
}

export interface CsrfCheckResult {
  readonly passed: boolean;
  readonly violation?: CsrfViolationType;
  /** full_enforce에서 차단 시 반환할 response */
  readonly blockResponse?: NextResponse;
  /** telemetry 기록용 */
  readonly telemetryEvent?: CsrfTelemetryEvent;
}

// ═══════════════════════════════════════════════════════
// Core CSRF Check
// ═══════════════════════════════════════════════════════

/**
 * 서버 authoritative CSRF 검증
 *
 * 1. method exempt 여부 판정
 * 2. origin/referer 검증
 * 3. double-submit cookie/header 검증
 * 4. rollout mode에 따라 차단 or 기록
 */
export async function performCsrfCheck(ctx: CsrfCheckContext): Promise<CsrfCheckResult> {
  const { req, correlationId, protection, highRisk = false, sourceSurface, actorUserId } = ctx;
  const mode = getCsrfRolloutMode();

  // 1. Exempt routes skip entirely
  if (protection === 'exempt') {
    return { passed: true };
  }

  // 2. Safe methods skip
  if (!isProtectedMethod(req.method)) {
    return { passed: true };
  }

  // 3. Origin / Referer validation
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');

  // Origin 우선 전략: origin이 있으면 origin으로, 없으면 referer에서 origin 추출
  const effectiveOrigin = origin || (referer ? extractOriginFromReferer(referer) : null);

  if (!effectiveOrigin) {
    const violation: CsrfViolationType = 'missing_origin';
    return handleViolation(violation, mode, protection, highRisk, correlationId, sourceSurface, actorUserId, req);
  }

  if (!isTrustedOrigin(effectiveOrigin)) {
    const violation: CsrfViolationType = 'origin_mismatch';
    return handleViolation(violation, mode, protection, highRisk, correlationId, sourceSurface, actorUserId, req);
  }

  // 4. Double-submit cookie/header validation
  const cookieToken = req.cookies.get(CSRF_COOKIE_NAME.replace('__Host-', ''))?.value
    || req.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = req.headers.get(CSRF_HEADER_NAME);

  const tokenResult = await validateCsrfDoubleSubmit(cookieToken, headerToken);

  if (!tokenResult.valid && tokenResult.violation) {
    return handleViolation(tokenResult.violation, mode, protection, highRisk, correlationId, sourceSurface, actorUserId, req);
  }

  // All checks passed
  return { passed: true, telemetryEvent: 'csrf_validation_passed' };
}

// ═══════════════════════════════════════════════════════
// Violation Handler
// ═══════════════════════════════════════════════════════

function handleViolation(
  violation: CsrfViolationType,
  mode: CsrfRolloutMode,
  protection: CsrfProtectionLevel,
  highRisk: boolean,
  correlationId: string,
  sourceSurface: string,
  actorUserId: string | undefined,
  req: NextRequest,
): CsrfCheckResult {
  const telemetryEvent = mapViolationToTelemetry(violation);

  // Telemetry 기록 (모든 모드에서)
  recordCsrfTelemetry(telemetryEvent, correlationId, sourceSurface, actorUserId, req);

  // 차단 여부 판정
  const shouldBlock = shouldBlockOnViolation(mode, protection, highRisk);

  if (shouldBlock) {
    const message = getCsrfGovernanceMessage(violation);
    return {
      passed: false,
      violation,
      telemetryEvent,
      blockResponse: NextResponse.json(
        { error: message, correlationId },
        { status: 403 },
      ),
    };
  }

  // report_only or soft_enforce(저위험) → 기록만 하고 통과
  return {
    passed: true,
    violation,
    telemetryEvent,
  };
}

// ═══════════════════════════════════════════════════════
// Telemetry
// ═══════════════════════════════════════════════════════

function recordCsrfTelemetry(
  event: CsrfTelemetryEvent,
  correlationId: string,
  sourceSurface: string,
  actorUserId: string | undefined,
  req: NextRequest,
): void {
  const provenance = createEventProvenance({
    sourceDomain: 'security',
    sourceSurface,
    sourceRoute: req.nextUrl.pathname,
    actorUserId: actorUserId || 'unknown',
    targetEntityType: 'csrf',
    targetEntityId: 'csrf-check',
    correlationId,
    securityClassification: 'security_event',
  });

  recordSecurityEvent(
    'security_event',
    provenance,
    `CSRF ${event}: method=${req.method} path=${req.nextUrl.pathname} origin=${req.headers.get('origin') || 'none'}`,
  );
}

// ═══════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════

function extractOriginFromReferer(referer: string): string | null {
  try {
    const url = new URL(referer);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

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
