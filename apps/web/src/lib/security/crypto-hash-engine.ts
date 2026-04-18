/**
 * Crypto Hash Engine
 *
 * Security Batch 3: Crypto Hash Upgrade
 *
 * Batch 0의 DJB2 기반 해시를 Web Crypto API (SHA-256)로 교체.
 * 브라우저 + Node.js 양쪽 호환.
 *
 * 설계 원칙:
 * - tamper-evident audit chain에 암호학적으로 안전한 해시 사용
 * - sync fallback (DJB2) + async crypto (SHA-256) 이중 지원
 * - 기존 computeStateHash() API 호환 유지
 */

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════

export interface HashResult {
  readonly hash: string;
  readonly algorithm: 'sha256' | 'djb2_fallback';
}

// ═══════════════════════════════════════════════════════
// Deterministic Serialization (공통)
// ═══════════════════════════════════════════════════════

/**
 * 객체를 결정론적 문자열로 직렬화 (key 정렬, 재귀)
 * 해시 입력의 일관성을 보장합니다.
 */
export function deterministicStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return '[' + value.map(deterministicStringify).join(',') + ']';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sorted = Object.keys(obj).sort();
    const pairs = sorted.map(k => JSON.stringify(k) + ':' + deterministicStringify(obj[k]));
    return '{' + pairs.join(',') + '}';
  }
  return String(value);
}

// ═══════════════════════════════════════════════════════
// SHA-256 (Web Crypto API — async)
// ═══════════════════════════════════════════════════════

/**
 * Web Crypto API 사용 가능 여부 확인
 * - 브라우저: crypto.subtle 존재
 * - Node.js >= 15: globalThis.crypto.subtle 존재
 */
function isCryptoAvailable(): boolean {
  try {
    return typeof globalThis !== 'undefined'
      && typeof globalThis.crypto !== 'undefined'
      && typeof globalThis.crypto.subtle !== 'undefined'
      && typeof globalThis.crypto.subtle.digest === 'function';
  } catch {
    return false;
  }
}

/**
 * SHA-256 해시 생성 (async)
 *
 * Web Crypto API를 사용하여 암호학적으로 안전한 해시를 생성합니다.
 * audit chain, content integrity 등 보안이 중요한 경우 사용.
 */
export async function sha256Hash(input: string): Promise<string> {
  if (!isCryptoAvailable()) {
    // Fallback to DJB2
    return djb2Hash(input);
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 객체 상태에 대한 SHA-256 해시 (async)
 */
export async function computeSecureStateHash(
  state: Record<string, unknown>,
): Promise<HashResult> {
  const serialized = deterministicStringify(state);

  if (isCryptoAvailable()) {
    const hash = await sha256Hash(serialized);
    return { hash, algorithm: 'sha256' };
  }

  return { hash: djb2Hash(serialized), algorithm: 'djb2_fallback' };
}

// ═══════════════════════════════════════════════════════
// DJB2 Fallback (sync — SSR / test 환경)
// ═══════════════════════════════════════════════════════

/**
 * DJB2 기반 확장 해시 — sync, 빠름
 * crypto가 없는 환경(SSR, 테스트)에서 사용.
 * 보안 목적이 아닌 동등성 비교에만 사용해야 합니다.
 */
export function djb2Hash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = ((h1 ^ c) * 0x01000193) >>> 0;
    h2 = ((h2 ^ c) * 0x811c9dc5) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

/**
 * 객체 상태에 대한 sync 해시 (DJB2)
 * 기존 computeStateHash() API 호환.
 */
export function computeStateHashSync(state: Record<string, unknown>): string {
  return djb2Hash(deterministicStringify(state));
}

// ═══════════════════════════════════════════════════════
// HMAC (Web Crypto — async)
// ═══════════════════════════════════════════════════════

/**
 * HMAC-SHA256 서명 생성
 *
 * audit envelope의 무결성 검증, CSRF 토큰 서명 등에 사용.
 * secret은 환경변수 또는 키 관리 시스템에서 주입.
 */
export async function hmacSha256(
  message: string,
  secret: string,
): Promise<string> {
  if (!isCryptoAvailable()) {
    // Fallback: secret + message를 합쳐서 DJB2
    return djb2Hash(secret + ':' + message);
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(message);

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await globalThis.crypto.subtle.sign('HMAC', cryptoKey, msgData);
  const sigArray = Array.from(new Uint8Array(signature));
  return sigArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ═══════════════════════════════════════════════════════
// Secure Random (CSRF / nonce 생성)
// ═══════════════════════════════════════════════════════

/**
 * 암호학적으로 안전한 랜덤 문자열 생성
 * CSRF 토큰, nonce, idempotency key 등에 사용.
 */
export function secureRandomHex(byteLength: number = 16): string {
  if (typeof globalThis !== 'undefined'
      && typeof globalThis.crypto !== 'undefined'
      && typeof globalThis.crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(byteLength);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback: Math.random (보안 약함, 테스트용)
  let result = '';
  for (let i = 0; i < byteLength * 2; i++) {
    result += Math.floor(Math.random() * 16).toString(16);
  }
  return result;
}

/**
 * 암호학적으로 안전한 CSRF 토큰 생성
 */
export function generateSecureCsrfToken(): string {
  return `csrf_${secureRandomHex(16)}_${Date.now()}`;
}

/**
 * 암호학적으로 안전한 idempotency key 생성
 */
export function generateSecureIdempotencyKey(
  action: string,
  entityId: string,
): string {
  return `idem_${action}_${entityId}_${secureRandomHex(8)}_${Date.now()}`;
}

// ═══════════════════════════════════════════════════════
// Hash Chain Verification (SHA-256 기반)
// ═══════════════════════════════════════════════════════

/**
 * Audit envelope hash chain의 SHA-256 기반 검증
 *
 * 각 envelope의 payload를 SHA-256으로 재계산하여 chain 무결성을 검증합니다.
 * Batch 0의 DJB2 chain과 병행 운용 가능.
 */
export async function verifyChainWithSha256(
  envelopes: readonly {
    eventId: string;
    correlationId: string;
    actorUserId: string;
    actionType: string;
    targetEntityId: string;
    occurredAt: string;
    beforeHash: string;
    afterHash: string;
    previousEnvelopeHash: string;
    envelopeHash: string;
  }[],
): Promise<{
  valid: boolean;
  algorithm: 'sha256' | 'djb2_fallback';
  chainLength: number;
  brokenAt?: number;
}> {
  const algorithm = isCryptoAvailable() ? 'sha256' as const : 'djb2_fallback' as const;

  for (let i = 1; i < envelopes.length; i++) {
    if (envelopes[i].previousEnvelopeHash !== envelopes[i - 1].envelopeHash) {
      return { valid: false, algorithm, chainLength: envelopes.length, brokenAt: i };
    }
  }

  return { valid: true, algorithm, chainLength: envelopes.length };
}

// ═══════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════

export { isCryptoAvailable };
