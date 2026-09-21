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

/** CSRF rollout mode 해석 결과 — 모드와 그 모드가 어디서 왔는지를 함께 돌려준다. */
export interface CsrfModeResolution {
  mode: CsrfRolloutMode;
  /** env 가 비어 있지 않았는가 (미설정·공백이면 false) */
  envPresent: boolean;
  /** env 값이 세 모드 중 하나로 인식됐는가 — false 면 설정이 먹지 않고 있다 */
  recognized: boolean;
}

const CSRF_MODES: readonly CsrfRolloutMode[] = ['report_only', 'soft_enforce', 'full_enforce'];

/** 인식 못 한 값 경고는 프로세스당 한 번만 — 요청마다 찍지 않는다. */
let unrecognizedModeWarned = false;

/**
 * 현재 CSRF rollout mode — env/config 기반.
 *
 * 🛑 §csrf-mode-unrecognized (2026-09-21)
 *   이전 구현은 인식 못 하는 값을 **조용히** report_only 로 떨어뜨렸다.
 *   같은 프로젝트 env 에 글자 하나 빠진 `ABAXIS_CSRF_MODE` 가 실제로 앉아 있었으므로
 *   오타는 가설이 아니라 실증이다. 오타난 값 = 보호 없음 + 아무도 모름.
 *
 *   그렇다고 throw 하지는 않는다. 이 함수는 미들웨어에서 요청마다 불린다 —
 *   던지면 오타 하나가 프로덕션 전체를 500 으로 만든다. 가드가 제품을 죽이면
 *   그게 더 큰 결함이다. 모드는 안전한 기본값(report_only)에 머물되,
 *   **인식 실패 사실을 잃지 않는다**:
 *     ① console.error — Vercel 런타임 로그(휘발이 아닌 유일한 싱크)
 *     ② resolveCsrfRolloutMode().recognized=false — /api/security/csrf-status 가 노출
 *   원문 값은 싣지 않는다(Vercel 에 sensitive 로 보관된 값이다).
 */
export function resolveCsrfRolloutMode(): CsrfModeResolution {
  const rawValue = typeof process !== 'undefined'
    ? process.env.LABAXIS_CSRF_MODE
    : undefined;

  // envPresent 는 **키가 있는가**, recognized 는 **그 값이 먹는가** — 둘은 다른 질문이다.
  //   키 자체가 없을 때만 미설정이다. 빈 값·공백만 있는 값은 "넣긴 넣었는데 먹지 않는" 상태이고,
  //   그걸 미설정으로 접으면 Vercel env 목록에는 키가 있는데 상태 엔드포인트는 "설정 안 됨" 이라
  //   말하게 된다 — 이 변경의 목적(설정이 먹었는지 보이게 한다)과 정면으로 어긋난다.
  if (rawValue === undefined) {
    return { mode: 'report_only', envPresent: false, recognized: true };
  }
  const raw = rawValue;

  // 🛑 모드 선택은 **완전 일치**만 인정한다. trim 한 값으로 고르지 않는다.
  //   `" soft_enforce\n"` 처럼 공백이 붙은 prod 값이 배포 하나로 report_only → soft_enforce 로
  //   **조용히 켜진다**(prod 값은 sensitive 라 읽을 수 없어 켜진 줄도 모른다).
  //   공백이 붙은 허용값은 report_only 로 두고 recognized=false 로 드러낸다.
  if ((CSRF_MODES as readonly string[]).includes(raw)) {
    return { mode: raw as CsrfRolloutMode, envPresent: true, recognized: true };
  }

  if (!unrecognizedModeWarned) {
    unrecognizedModeWarned = true;
    // eslint-disable-next-line no-console
    console.error(
      '[csrf] LABAXIS_CSRF_MODE 값이 비어 있거나 인식되지 않습니다. report_only 로 동작합니다. ' +
      `허용값: ${CSRF_MODES.join(' | ')} · 해소: env 값을 허용값 하나로 고치고 재배포하십시오. ` +
      '(값 자체는 로그에 싣지 않습니다)',
    );
  }
  return { mode: 'report_only', envPresent: true, recognized: false };
}

/** 현재 CSRF rollout mode. 해석 근거가 필요하면 resolveCsrfRolloutMode() 를 쓴다. */
export function getCsrfRolloutMode(): CsrfRolloutMode {
  return resolveCsrfRolloutMode().mode;
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
