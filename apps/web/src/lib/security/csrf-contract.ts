/**
 * CSRF Contract
 *
 * Security Batch 10: CSRF Full Enforcement
 *
 * browser-origin mutation 보호를 위한 CSRF 계약 정의.
 * double-submit cookie + origin/referer 검증 전략.
 *
 * 설계 원칙:
 * - GET/HEAD/OPTIONS는 기본 exempt
 * - state-changing method(POST/PUT/PATCH/DELETE)만 보호
 * - report_only → soft_enforce → full_enforce 점진 rollout
 * - irreversible mutation은 full_enforce 시 fail-closed
 */

// ═══════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════

/** CSRF 토큰 전달용 HTTP 헤더명 */
export const CSRF_HEADER_NAME = 'x-labaxis-csrf-token';

/** CSRF double-submit cookie 이름 (__Host- prefix for security) */
export const CSRF_COOKIE_NAME = '__Host-labaxis-csrf';

/** CSRF 보호 대상 HTTP 메서드 */
export const CSRF_PROTECTED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** CSRF exempt HTTP 메서드 */
export const CSRF_EXEMPT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** CSRF 토큰 기본 TTL (30분) */
export const CSRF_TOKEN_TTL_MS = 30 * 60 * 1000;

/** CSRF 토큰 최대 허용 수명 (2시간 — overlay/workbench 재사용 고려) */
export const CSRF_TOKEN_MAX_AGE_MS = 2 * 60 * 60 * 1000;

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════

/** CSRF enforcement rollout mode */
export type CsrfRolloutMode = 'report_only' | 'soft_enforce' | 'full_enforce';

/** Route별 CSRF 보호 수준 */
export type CsrfProtectionLevel = 'required' | 'optional' | 'exempt';

/** CSRF 검증 결과 */
export interface CsrfValidationResult {
  readonly valid: boolean;
  readonly violation?: CsrfViolationType;
  readonly governanceMessage?: string;
  /** report_only 모드에서도 기록용 */
  readonly shouldLog: boolean;
}

/** CSRF 위반 유형 */
export type CsrfViolationType =
  | 'missing_token'
  | 'token_mismatch'
  | 'token_expired'
  | 'origin_mismatch'
  | 'missing_origin'
  | 'invalid_token_format';

/** CSRF telemetry 이벤트 유형 */
export type CsrfTelemetryEvent =
  | 'csrf_missing_token'
  | 'csrf_token_mismatch'
  | 'csrf_origin_mismatch'
  | 'csrf_token_expired'
  | 'csrf_bootstrap_failed'
  | 'csrf_refresh_failed'
  | 'csrf_validation_passed';

/** Route CSRF 설정 */
export interface RouteCsrfConfig {
  readonly protection: CsrfProtectionLevel;
  /** 고위험 route는 soft_enforce에서도 차단 */
  readonly highRisk?: boolean;
}

// ═══════════════════════════════════════════════════════
// Rollout Config
// ═══════════════════════════════════════════════════════

/**
 * 현재 CSRF rollout mode
 * env/config 기반으로 전환 가능
 */
export function getCsrfRolloutMode(): CsrfRolloutMode {
  const envMode = typeof process !== 'undefined'
    ? process.env.LABAXIS_CSRF_MODE
    : undefined;

  if (envMode === 'full_enforce') return 'full_enforce';
  if (envMode === 'soft_enforce') return 'soft_enforce';
  if (envMode === 'report_only') return 'report_only';

  // 기본값: report_only (안전한 시작점, 프론트 호출 경로 검증 후 전환)
  return 'report_only';
}

// ═══════════════════════════════════════════════════════
// Origin Resolution
// ═══════════════════════════════════════════════════════

/** 허용된 origin 목록 */
function getTrustedOrigins(): string[] {
  const origins: string[] = [];

  // Production
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_URL) {
    origins.push(process.env.NEXT_PUBLIC_APP_URL);
  }

  // Local dev
  origins.push(
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
  );

  // Preview/staging
  if (typeof process !== 'undefined' && process.env.LABAXIS_TRUSTED_ORIGINS) {
    const extra = process.env.LABAXIS_TRUSTED_ORIGINS.split(',').map(o => o.trim());
    origins.push(...extra);
  }

  return origins;
}

/**
 * Origin이 trusted인지 검증
 */
export function isTrustedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;

  const trusted = getTrustedOrigins();
  return trusted.some(t => origin === t || origin.startsWith(t));
}

// ═══════════════════════════════════════════════════════
// Governance Messages
// ═══════════════════════════════════════════════════════

const CSRF_GOVERNANCE_MESSAGES: Record<CsrfViolationType, string> = {
  missing_token: '보안 검증이 완료되지 않아 작업을 진행할 수 없습니다.',
  token_mismatch: '보안 검증이 완료되지 않아 작업을 진행할 수 없습니다.',
  token_expired: '보안 검증이 만료되어 다시 시도해 주세요.',
  origin_mismatch: '현재 요청은 유효한 작업 세션에서 시작되지 않았습니다.',
  missing_origin: '현재 요청은 유효한 작업 세션에서 시작되지 않았습니다.',
  invalid_token_format: '보안 검증이 완료되지 않아 작업을 진행할 수 없습니다.',
};

/**
 * CSRF 위반에 대한 human-readable governance message 반환
 * raw internal code 노출 금지
 */
export function getCsrfGovernanceMessage(violation: CsrfViolationType): string {
  return CSRF_GOVERNANCE_MESSAGES[violation]
    || '보안 검증에 실패했습니다. 다시 시도해 주세요.';
}

// ═══════════════════════════════════════════════════════
// Method Classification
// ═══════════════════════════════════════════════════════

/**
 * HTTP method가 CSRF 보호 대상인지 판정
 */
export function isProtectedMethod(method: string): boolean {
  return CSRF_PROTECTED_METHODS.has(method.toUpperCase());
}

/**
 * Rollout mode에서 요청을 차단해야 하는지 판정
 */
export function shouldBlockOnViolation(
  mode: CsrfRolloutMode,
  protection: CsrfProtectionLevel,
  highRisk: boolean = false,
): boolean {
  if (protection === 'exempt') return false;

  switch (mode) {
    case 'full_enforce':
      return protection === 'required' || protection === 'optional';
    case 'soft_enforce':
      return highRisk || protection === 'required';
    case 'report_only':
      return false;
    default:
      return false;
  }
}
