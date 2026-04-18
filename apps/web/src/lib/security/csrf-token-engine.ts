/**
 * CSRF Token Engine
 *
 * Security Batch 10: CSRF Full Enforcement
 *
 * double-submit cookie 전략을 위한 토큰 생성·검증·서명·갱신 엔진.
 *
 * 설계 원칙:
 * - secure random 기반 토큰 생성
 * - HMAC signing으로 위조 방지
 * - practical TTL (30분 기본, 2시간 max — overlay/workbench 재사용 고려)
 * - raw plaintext 비교만 하지 않고 signed token binding
 */

import {
  CSRF_TOKEN_TTL_MS,
  CSRF_TOKEN_MAX_AGE_MS,
  type CsrfValidationResult,
  type CsrfViolationType,
  getCsrfGovernanceMessage,
} from './csrf-contract';

// ═══════════════════════════════════════════════════════
// Token Format
// ═══════════════════════════════════════════════════════
// token = `${random_hex_32}.${timestamp}.${hmac_signature}`
// cookie와 header 양쪽에 동일 token 전송
// 서버에서 cookie value === header value 확인 + HMAC 검증 + TTL 확인

/** CSRF signing secret (서버 환경변수, 없으면 fallback) */
function getSigningSecret(): string {
  if (typeof process !== 'undefined' && process.env.LABAXIS_CSRF_SECRET) {
    return process.env.LABAXIS_CSRF_SECRET;
  }
  // Fallback for dev — production에서는 반드시 env로 주입
  return 'labaxis-csrf-dev-secret-do-not-use-in-prod';
}

// ═══════════════════════════════════════════════════════
// Crypto Utilities (inline, dependency-free)
// ═══════════════════════════════════════════════════════

function secureRandomHex(bytes: number = 32): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const buf = new Uint8Array(bytes);
    globalThis.crypto.getRandomValues(buf);
    return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback (SSR/test)
  let result = '';
  for (let i = 0; i < bytes * 2; i++) {
    result += Math.floor(Math.random() * 16).toString(16);
  }
  return result;
}

async function hmacSign(message: string, secret: string): Promise<string> {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const encoder = new TextEncoder();
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await globalThis.crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(message),
    );
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Sync fallback (DJB2-style) — dev/test only
  let hash = 5381;
  const combined = message + ':' + secret;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) + hash + combined.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function hmacSignSync(message: string, secret: string): string {
  let hash = 5381;
  const combined = message + ':' + secret;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) + hash + combined.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

// ═══════════════════════════════════════════════════════
// Token Generation
// ═══════════════════════════════════════════════════════

/**
 * CSRF 토큰 생성 (async — HMAC 서명 포함)
 *
 * Format: `{random}.{timestamp}.{hmac}`
 * - random: 32바이트 secure random hex
 * - timestamp: 생성 시각 (ms)
 * - hmac: random+timestamp의 HMAC-SHA256 서명
 */
export async function generateCsrfToken(): Promise<string> {
  const random = secureRandomHex(32);
  const timestamp = Date.now().toString();
  const payload = `${random}.${timestamp}`;
  const signature = await hmacSign(payload, getSigningSecret());
  return `${payload}.${signature}`;
}

/**
 * CSRF 토큰 생성 (sync — DJB2 fallback 서명)
 * SSR/test 환경용
 */
export function generateCsrfTokenSync(): string {
  const random = secureRandomHex(32);
  const timestamp = Date.now().toString();
  const payload = `${random}.${timestamp}`;
  const signature = hmacSignSync(payload, getSigningSecret());
  return `${payload}.${signature}`;
}

// ═══════════════════════════════════════════════════════
// Token Validation
// ═══════════════════════════════════════════════════════

/**
 * CSRF 토큰 구조 파싱
 */
function parseToken(token: string): { random: string; timestamp: number; signature: string } | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [random, timestampStr, signature] = parts;
  const timestamp = parseInt(timestampStr, 10);

  if (!random || random.length < 16) return null;
  if (isNaN(timestamp) || timestamp <= 0) return null;
  if (!signature || signature.length < 8) return null;

  return { random, timestamp, signature };
}

/**
 * CSRF 토큰 서명 검증 (async — HMAC)
 */
async function verifySignature(token: string): Promise<boolean> {
  const parsed = parseToken(token);
  if (!parsed) return false;

  const payload = `${parsed.random}.${parsed.timestamp}`;
  const expected = await hmacSign(payload, getSigningSecret());
  return timingSafeEqual(parsed.signature, expected);
}

/**
 * CSRF 토큰 서명 검증 (sync — DJB2 fallback)
 */
function verifySignatureSync(token: string): boolean {
  const parsed = parseToken(token);
  if (!parsed) return false;

  const payload = `${parsed.random}.${parsed.timestamp}`;
  const expected = hmacSignSync(payload, getSigningSecret());
  return timingSafeEqual(parsed.signature, expected);
}

/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * CSRF 토큰 만료 확인
 */
export function isCsrfTokenExpired(token: string): boolean {
  const parsed = parseToken(token);
  if (!parsed) return true;

  const age = Date.now() - parsed.timestamp;
  return age > CSRF_TOKEN_MAX_AGE_MS;
}

/**
 * CSRF 토큰 갱신 필요 확인 (TTL 기준)
 */
export function shouldRefreshCsrfToken(token: string): boolean {
  const parsed = parseToken(token);
  if (!parsed) return true;

  const age = Date.now() - parsed.timestamp;
  return age > CSRF_TOKEN_TTL_MS;
}

// ═══════════════════════════════════════════════════════
// Full Validation
// ═══════════════════════════════════════════════════════

/**
 * CSRF double-submit 검증 (async)
 *
 * 1. cookie token 존재 확인
 * 2. header token 존재 확인
 * 3. cookie === header 일치 확인 (double-submit)
 * 4. 토큰 형식/서명 검증
 * 5. 토큰 만료 확인
 */
export async function validateCsrfDoubleSubmit(
  cookieToken: string | undefined | null,
  headerToken: string | undefined | null,
): Promise<CsrfValidationResult> {
  // 1. Missing token
  if (!cookieToken || !headerToken) {
    const violation: CsrfViolationType = 'missing_token';
    return {
      valid: false,
      violation,
      governanceMessage: getCsrfGovernanceMessage(violation),
      shouldLog: true,
    };
  }

  // 2. Format check
  if (!parseToken(cookieToken) || !parseToken(headerToken)) {
    const violation: CsrfViolationType = 'invalid_token_format';
    return {
      valid: false,
      violation,
      governanceMessage: getCsrfGovernanceMessage(violation),
      shouldLog: true,
    };
  }

  // 3. Double-submit: cookie === header (timing-safe)
  if (!timingSafeEqual(cookieToken, headerToken)) {
    const violation: CsrfViolationType = 'token_mismatch';
    return {
      valid: false,
      violation,
      governanceMessage: getCsrfGovernanceMessage(violation),
      shouldLog: true,
    };
  }

  // 4. Signature verification
  const sigValid = await verifySignature(cookieToken);
  if (!sigValid) {
    const violation: CsrfViolationType = 'token_mismatch';
    return {
      valid: false,
      violation,
      governanceMessage: getCsrfGovernanceMessage(violation),
      shouldLog: true,
    };
  }

  // 5. Expiration check
  if (isCsrfTokenExpired(cookieToken)) {
    const violation: CsrfViolationType = 'token_expired';
    return {
      valid: false,
      violation,
      governanceMessage: getCsrfGovernanceMessage(violation),
      shouldLog: true,
    };
  }

  return { valid: true, shouldLog: false };
}

/**
 * CSRF double-submit 검증 (sync — test/SSR용)
 */
export function validateCsrfDoubleSubmitSync(
  cookieToken: string | undefined | null,
  headerToken: string | undefined | null,
): CsrfValidationResult {
  if (!cookieToken || !headerToken) {
    const violation: CsrfViolationType = 'missing_token';
    return { valid: false, violation, governanceMessage: getCsrfGovernanceMessage(violation), shouldLog: true };
  }

  if (!parseToken(cookieToken) || !parseToken(headerToken)) {
    const violation: CsrfViolationType = 'invalid_token_format';
    return { valid: false, violation, governanceMessage: getCsrfGovernanceMessage(violation), shouldLog: true };
  }

  if (!timingSafeEqual(cookieToken, headerToken)) {
    const violation: CsrfViolationType = 'token_mismatch';
    return { valid: false, violation, governanceMessage: getCsrfGovernanceMessage(violation), shouldLog: true };
  }

  if (!verifySignatureSync(cookieToken)) {
    const violation: CsrfViolationType = 'token_mismatch';
    return { valid: false, violation, governanceMessage: getCsrfGovernanceMessage(violation), shouldLog: true };
  }

  if (isCsrfTokenExpired(cookieToken)) {
    const violation: CsrfViolationType = 'token_expired';
    return { valid: false, violation, governanceMessage: getCsrfGovernanceMessage(violation), shouldLog: true };
  }

  return { valid: true, shouldLog: false };
}

// ═══════════════════════════════════════════════════════
// Cookie Builder
// ═══════════════════════════════════════════════════════

/**
 * CSRF cookie 설정용 Set-Cookie 헤더 값 생성
 *
 * __Host- prefix 사용:
 * - Secure 필수
 * - Path=/ 필수
 * - Domain 지정 불가
 * - SameSite=Lax (cross-site navigation은 허용하되, cross-site POST는 차단)
 * - HttpOnly=false (프론트엔드에서 JS로 읽어서 header에 넣어야 하므로)
 */
export function buildCsrfCookieHeader(token: string): string {
  const isProduction = typeof process !== 'undefined'
    && process.env.NODE_ENV === 'production';

  const parts = [
    `__Host-labaxis-csrf=${token}`,
    'Path=/',
    'SameSite=Lax',
  ];

  if (isProduction) {
    parts.push('Secure');
  }

  // HttpOnly=false → 프론트엔드에서 document.cookie로 읽기 가능
  // double-submit 전략 특성상 JS에서 cookie를 읽어 header로 보내야 함
  // Max-Age: 2시간 (CSRF_TOKEN_MAX_AGE_MS와 동일)
  parts.push(`Max-Age=${Math.floor(CSRF_TOKEN_MAX_AGE_MS / 1000)}`);

  return parts.join('; ');
}
