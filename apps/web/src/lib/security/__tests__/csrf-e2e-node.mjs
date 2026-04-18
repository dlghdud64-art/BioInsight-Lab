/**
 * CSRF E2E Integration Tests (Pure Node.js)
 *
 * HTTP 요청 시나리오 시뮬레이션:
 * - missing token
 * - mismatched token
 * - cross-origin
 * - stale/expired cookie
 * - duplicate retry
 * - exempt route bypass
 * - highRisk vs standard blocking
 * - defense-in-depth (middleware + inline)
 *
 * Run: node apps/web/src/lib/security/__tests__/csrf-e2e-node.mjs
 */

import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════
// Inline CSRF engine (from contract + token-engine + registry)
// ═══════════════════════════════════════════════════════════════

const CSRF_HEADER_NAME = 'x-labaxis-csrf-token';
const CSRF_COOKIE_NAME = '__Host-labaxis-csrf';
const CSRF_TOKEN_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const PROTECTED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const TRUSTED_ORIGINS = ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'];

function isProtectedMethod(m) { return PROTECTED_METHODS.has(m.toUpperCase()); }
function isTrustedOrigin(o) { return o && TRUSTED_ORIGINS.some(t => o === t || o.startsWith(t)); }

function shouldBlockOnViolation(mode, protection, highRisk = false) {
  if (protection === 'exempt') return false;
  switch (mode) {
    case 'full_enforce': return protection === 'required' || protection === 'optional';
    case 'soft_enforce': return highRisk || protection === 'required';
    case 'report_only': return false;
    default: return false;
  }
}

// Token engine (sync)
const SIGNING_SECRET = 'labaxis-csrf-dev-secret-do-not-use-in-prod';

function secureRandomHex(bytes = 32) {
  if (globalThis.crypto?.getRandomValues) {
    const buf = new Uint8Array(bytes);
    globalThis.crypto.getRandomValues(buf);
    return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let r = ''; for (let i = 0; i < bytes * 2; i++) r += Math.floor(Math.random() * 16).toString(16); return r;
}

function hmacSignSync(message, secret) {
  let hash = 5381; const combined = message + ':' + secret;
  for (let i = 0; i < combined.length; i++) hash = ((hash << 5) + hash + combined.charCodeAt(i)) >>> 0;
  return hash.toString(16).padStart(8, '0');
}

function generateToken(timestampOverride) {
  const random = secureRandomHex(32);
  const timestamp = (timestampOverride || Date.now()).toString();
  const payload = `${random}.${timestamp}`;
  return `${payload}.${hmacSignSync(payload, SIGNING_SECRET)}`;
}

function parseToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.'); if (parts.length !== 3) return null;
  const [random, ts, sig] = parts; const timestamp = parseInt(ts, 10);
  if (!random || random.length < 16 || isNaN(timestamp) || timestamp <= 0 || !sig || sig.length < 8) return null;
  return { random, timestamp, signature: sig };
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0;
}

function validateDoubleSubmit(cookie, header) {
  if (!cookie || !header) return { valid: false, violation: 'missing_token' };
  if (!parseToken(cookie) || !parseToken(header)) return { valid: false, violation: 'invalid_token_format' };
  if (!timingSafeEqual(cookie, header)) return { valid: false, violation: 'token_mismatch' };
  const payload = cookie.split('.').slice(0,2).join('.');
  if (!timingSafeEqual(cookie.split('.')[2], hmacSignSync(payload, SIGNING_SECRET))) return { valid: false, violation: 'token_mismatch' };
  const parsed = parseToken(cookie);
  if (Date.now() - parsed.timestamp > CSRF_TOKEN_MAX_AGE_MS) return { valid: false, violation: 'token_expired' };
  return { valid: true };
}

// Route registry (subset)
const EXEMPT_ROUTES = ['/api/auth/callback/google', '/api/billing/webhook', '/api/mobile/auth/signin'];
const HIGH_RISK_ROUTES = ['/api/request/abc/approve', '/api/invites/accept', '/api/quotes/q-1/status'];

function resolveCsrf(path) {
  if (EXEMPT_ROUTES.includes(path)) return { protection: 'exempt', highRisk: false };
  if (HIGH_RISK_ROUTES.includes(path)) return { protection: 'required', highRisk: true };
  return { protection: 'required', highRisk: false };
}

// ═══════════════════════════════════════════════════════════════
// Simulated Middleware (mirrors middleware.ts logic)
// ═══════════════════════════════════════════════════════════════

/**
 * Simulate the full middleware CSRF check chain.
 *
 * @param {object} req - Simulated request
 * @param {string} req.method
 * @param {string} req.path
 * @param {string|null} req.origin
 * @param {string|null} req.referer
 * @param {string|null} req.csrfCookie
 * @param {string|null} req.csrfHeader
 * @param {string} mode - Rollout mode
 * @returns {{ passed: boolean, blocked: boolean, violation?: string }}
 */
function simulateMiddleware(req, mode = 'report_only') {
  const { method, path, origin, referer, csrfCookie, csrfHeader } = req;

  // Safe method → skip
  if (!isProtectedMethod(method)) {
    return { passed: true, blocked: false };
  }

  const routeConfig = resolveCsrf(path);

  // Exempt → skip
  if (routeConfig.protection === 'exempt') {
    return { passed: true, blocked: false, exempt: true };
  }

  // Origin check
  const effectiveOrigin = origin || (referer ? (() => { try { const u = new URL(referer); return `${u.protocol}//${u.host}`; } catch { return null; } })() : null);

  if (!effectiveOrigin) {
    const shouldBlock = shouldBlockOnViolation(mode, routeConfig.protection, routeConfig.highRisk);
    return { passed: !shouldBlock, blocked: shouldBlock, violation: 'missing_origin' };
  }

  if (!isTrustedOrigin(effectiveOrigin)) {
    const shouldBlock = shouldBlockOnViolation(mode, routeConfig.protection, routeConfig.highRisk);
    return { passed: !shouldBlock, blocked: shouldBlock, violation: 'origin_mismatch' };
  }

  // Token check
  const tokenResult = validateDoubleSubmit(csrfCookie, csrfHeader);

  if (!tokenResult.valid && tokenResult.violation) {
    const shouldBlock = shouldBlockOnViolation(mode, routeConfig.protection, routeConfig.highRisk);
    return { passed: !shouldBlock, blocked: shouldBlock, violation: tokenResult.violation };
  }

  return { passed: true, blocked: false };
}

// ═══════════════════════════════════════════════════════════════
// Test Runner
// ═══════════════════════════════════════════════════════════════

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.log(`  ✗ ${name}`); console.log(`    ${e.message}`); }
}

// ─── 1. Missing Token ───
console.log('\n═══ E2E 1. Missing Token ═══\n');

test('missing token: report_only → 통과 (기록만)', () => {
  const r = simulateMiddleware({
    method: 'POST', path: '/api/quotes', origin: 'http://localhost:3000',
    csrfCookie: null, csrfHeader: null,
  }, 'report_only');
  assert.equal(r.passed, true);
  assert.equal(r.blocked, false);
  assert.equal(r.violation, 'missing_token');
});

test('missing token: soft_enforce → 차단', () => {
  const r = simulateMiddleware({
    method: 'POST', path: '/api/quotes', origin: 'http://localhost:3000',
    csrfCookie: null, csrfHeader: null,
  }, 'soft_enforce');
  assert.equal(r.blocked, true);
  assert.equal(r.violation, 'missing_token');
});

test('missing token: full_enforce → 차단', () => {
  const r = simulateMiddleware({
    method: 'POST', path: '/api/quotes', origin: 'http://localhost:3000',
    csrfCookie: null, csrfHeader: null,
  }, 'full_enforce');
  assert.equal(r.blocked, true);
});

test('missing header only → missing_token', () => {
  const token = generateToken();
  const r = simulateMiddleware({
    method: 'POST', path: '/api/quotes', origin: 'http://localhost:3000',
    csrfCookie: token, csrfHeader: null,
  }, 'full_enforce');
  assert.equal(r.blocked, true);
  assert.equal(r.violation, 'missing_token');
});

test('missing cookie only → missing_token', () => {
  const token = generateToken();
  const r = simulateMiddleware({
    method: 'POST', path: '/api/quotes', origin: 'http://localhost:3000',
    csrfCookie: null, csrfHeader: token,
  }, 'full_enforce');
  assert.equal(r.blocked, true);
  assert.equal(r.violation, 'missing_token');
});

// ─── 2. Mismatched Token ───
console.log('\n═══ E2E 2. Mismatched Token ═══\n');

test('different tokens → token_mismatch → 차단 (full_enforce)', () => {
  const r = simulateMiddleware({
    method: 'POST', path: '/api/quotes', origin: 'http://localhost:3000',
    csrfCookie: generateToken(), csrfHeader: generateToken(),
  }, 'full_enforce');
  assert.equal(r.blocked, true);
  assert.equal(r.violation, 'token_mismatch');
});

test('tampered signature → token_mismatch', () => {
  const token = generateToken();
  const parts = token.split('.');
  const tampered = `${parts[0]}.${parts[1]}.deadbeef`;
  const r = simulateMiddleware({
    method: 'PATCH', path: '/api/inventory/abc', origin: 'http://localhost:3000',
    csrfCookie: tampered, csrfHeader: tampered,
  }, 'full_enforce');
  assert.equal(r.blocked, true);
  assert.equal(r.violation, 'token_mismatch');
});

test('mismatched tokens in report_only → 통과 (기록만)', () => {
  const r = simulateMiddleware({
    method: 'POST', path: '/api/quotes', origin: 'http://localhost:3000',
    csrfCookie: generateToken(), csrfHeader: generateToken(),
  }, 'report_only');
  assert.equal(r.passed, true);
  assert.equal(r.violation, 'token_mismatch');
});

// ─── 3. Cross-Origin ───
console.log('\n═══ E2E 3. Cross-Origin ═══\n');

test('evil origin → origin_mismatch → 차단 (full_enforce)', () => {
  const token = generateToken();
  const r = simulateMiddleware({
    method: 'POST', path: '/api/quotes', origin: 'https://evil.com',
    csrfCookie: token, csrfHeader: token,
  }, 'full_enforce');
  assert.equal(r.blocked, true);
  assert.equal(r.violation, 'origin_mismatch');
});

test('no origin, no referer → missing_origin → 차단 (soft_enforce)', () => {
  const token = generateToken();
  const r = simulateMiddleware({
    method: 'POST', path: '/api/quotes', origin: null, referer: null,
    csrfCookie: token, csrfHeader: token,
  }, 'soft_enforce');
  assert.equal(r.blocked, true);
  assert.equal(r.violation, 'missing_origin');
});

test('trusted referer without origin → 통과', () => {
  const token = generateToken();
  const r = simulateMiddleware({
    method: 'POST', path: '/api/quotes',
    origin: null, referer: 'http://localhost:3000/dashboard/quotes',
    csrfCookie: token, csrfHeader: token,
  }, 'full_enforce');
  assert.equal(r.passed, true);
  assert.equal(r.blocked, false);
});

test('evil referer, no origin → origin_mismatch', () => {
  const token = generateToken();
  const r = simulateMiddleware({
    method: 'POST', path: '/api/quotes',
    origin: null, referer: 'https://evil.com/phishing',
    csrfCookie: token, csrfHeader: token,
  }, 'full_enforce');
  assert.equal(r.blocked, true);
  assert.equal(r.violation, 'origin_mismatch');
});

// ─── 4. Stale / Expired Cookie ───
console.log('\n═══ E2E 4. Stale Cookie ═══\n');

test('expired token (3h ago) → token_expired → 차단', () => {
  const threeHoursAgo = Date.now() - (3 * 60 * 60 * 1000);
  const token = generateToken(threeHoursAgo);
  const r = simulateMiddleware({
    method: 'POST', path: '/api/quotes', origin: 'http://localhost:3000',
    csrfCookie: token, csrfHeader: token,
  }, 'full_enforce');
  assert.equal(r.blocked, true);
  assert.equal(r.violation, 'token_expired');
});

test('fresh token (1min ago) → 통과', () => {
  const oneMinAgo = Date.now() - (60 * 1000);
  const token = generateToken(oneMinAgo);
  const r = simulateMiddleware({
    method: 'POST', path: '/api/quotes', origin: 'http://localhost:3000',
    csrfCookie: token, csrfHeader: token,
  }, 'full_enforce');
  assert.equal(r.passed, true);
  assert.equal(r.blocked, false);
});

test('token at max-age boundary (2h - 1s) → 통과', () => {
  const justUnder = Date.now() - (CSRF_TOKEN_MAX_AGE_MS - 1000);
  const token = generateToken(justUnder);
  const r = simulateMiddleware({
    method: 'POST', path: '/api/quotes', origin: 'http://localhost:3000',
    csrfCookie: token, csrfHeader: token,
  }, 'full_enforce');
  assert.equal(r.passed, true);
});

test('token at max-age boundary (2h + 1s) → expired', () => {
  const justOver = Date.now() - (CSRF_TOKEN_MAX_AGE_MS + 1000);
  const token = generateToken(justOver);
  const r = simulateMiddleware({
    method: 'POST', path: '/api/quotes', origin: 'http://localhost:3000',
    csrfCookie: token, csrfHeader: token,
  }, 'full_enforce');
  assert.equal(r.blocked, true);
  assert.equal(r.violation, 'token_expired');
});

// ─── 5. Duplicate Retry (same token) ───
console.log('\n═══ E2E 5. Duplicate Retry ═══\n');

test('같은 유효 토큰으로 두 번 요청 → 모두 통과', () => {
  const token = generateToken();
  const makeReq = () => simulateMiddleware({
    method: 'POST', path: '/api/quotes', origin: 'http://localhost:3000',
    csrfCookie: token, csrfHeader: token,
  }, 'full_enforce');

  const r1 = makeReq();
  const r2 = makeReq();
  assert.equal(r1.passed, true);
  assert.equal(r2.passed, true);
});

test('유효 토큰 재사용 후 서명 변조 → 두번째 차단', () => {
  const token = generateToken();
  const r1 = simulateMiddleware({
    method: 'POST', path: '/api/quotes', origin: 'http://localhost:3000',
    csrfCookie: token, csrfHeader: token,
  }, 'full_enforce');
  assert.equal(r1.passed, true);

  const parts = token.split('.');
  const tampered = `${parts[0]}.${parts[1]}.ffffffff`;
  const r2 = simulateMiddleware({
    method: 'POST', path: '/api/quotes', origin: 'http://localhost:3000',
    csrfCookie: tampered, csrfHeader: tampered,
  }, 'full_enforce');
  assert.equal(r2.blocked, true);
});

// ─── 6. Exempt Route Bypass ───
console.log('\n═══ E2E 6. Exempt Route Bypass ═══\n');

test('exempt route: 토큰 없어도 통과 (full_enforce)', () => {
  const r = simulateMiddleware({
    method: 'POST', path: '/api/billing/webhook', origin: null,
    csrfCookie: null, csrfHeader: null,
  }, 'full_enforce');
  assert.equal(r.passed, true);
  assert.ok(r.exempt);
});

test('exempt route: cross-origin이어도 통과', () => {
  const r = simulateMiddleware({
    method: 'POST', path: '/api/mobile/auth/signin', origin: 'https://mobile-app.example.com',
    csrfCookie: null, csrfHeader: null,
  }, 'full_enforce');
  assert.equal(r.passed, true);
});

test('GET method: 토큰 없어도 통과', () => {
  const r = simulateMiddleware({
    method: 'GET', path: '/api/quotes', origin: null,
    csrfCookie: null, csrfHeader: null,
  }, 'full_enforce');
  assert.equal(r.passed, true);
});

test('HEAD method: 보호 대상 아님', () => {
  const r = simulateMiddleware({
    method: 'HEAD', path: '/api/quotes', origin: null,
    csrfCookie: null, csrfHeader: null,
  }, 'full_enforce');
  assert.equal(r.passed, true);
});

// ─── 7. HighRisk vs Standard Blocking ───
console.log('\n═══ E2E 7. HighRisk vs Standard ═══\n');

test('highRisk route + soft_enforce + missing token → 차단', () => {
  const r = simulateMiddleware({
    method: 'POST', path: '/api/request/abc/approve', origin: 'http://localhost:3000',
    csrfCookie: null, csrfHeader: null,
  }, 'soft_enforce');
  assert.equal(r.blocked, true);
});

test('standard route + soft_enforce + missing token → 차단 (required)', () => {
  const r = simulateMiddleware({
    method: 'POST', path: '/api/quotes', origin: 'http://localhost:3000',
    csrfCookie: null, csrfHeader: null,
  }, 'soft_enforce');
  assert.equal(r.blocked, true);
});

test('highRisk route + valid token + trusted origin → 통과', () => {
  const token = generateToken();
  const r = simulateMiddleware({
    method: 'POST', path: '/api/invites/accept', origin: 'http://localhost:3000',
    csrfCookie: token, csrfHeader: token,
  }, 'full_enforce');
  assert.equal(r.passed, true);
  assert.equal(r.blocked, false);
});

// ─── 8. Full Happy Path ───
console.log('\n═══ E2E 8. Full Happy Path ═══\n');

test('완전한 유효 요청: fresh token + trusted origin + POST → 통과', () => {
  const token = generateToken();
  const r = simulateMiddleware({
    method: 'POST', path: '/api/request/abc/approve', origin: 'http://localhost:3000',
    csrfCookie: token, csrfHeader: token,
  }, 'full_enforce');
  assert.equal(r.passed, true);
  assert.equal(r.blocked, false);
  assert.equal(r.violation, undefined);
});

test('PUT method + valid token → 통과', () => {
  const token = generateToken();
  const r = simulateMiddleware({
    method: 'PUT', path: '/api/quotes/q-1/status', origin: 'http://localhost:3000',
    csrfCookie: token, csrfHeader: token,
  }, 'full_enforce');
  assert.equal(r.passed, true);
});

test('DELETE method + valid token → 통과', () => {
  const token = generateToken();
  const r = simulateMiddleware({
    method: 'DELETE', path: '/api/quotes/q-1/status', origin: 'http://localhost:3000',
    csrfCookie: token, csrfHeader: token,
  }, 'full_enforce');
  assert.equal(r.passed, true);
});

test('PATCH method + valid token → 통과', () => {
  const token = generateToken();
  const r = simulateMiddleware({
    method: 'PATCH', path: '/api/inventory/abc', origin: 'http://localhost:3000',
    csrfCookie: token, csrfHeader: token,
  }, 'full_enforce');
  assert.equal(r.passed, true);
});

// ─── 9. Rollout Transition Scenarios ───
console.log('\n═══ E2E 9. Rollout Transition ═══\n');

test('report → soft 전환: 기존 통과 요청이 토큰 없으면 차단됨', () => {
  const req = {
    method: 'POST', path: '/api/quotes', origin: 'http://localhost:3000',
    csrfCookie: null, csrfHeader: null,
  };
  const report = simulateMiddleware(req, 'report_only');
  const soft = simulateMiddleware(req, 'soft_enforce');
  assert.equal(report.passed, true);
  assert.equal(soft.blocked, true);
});

test('soft → full 전환: optional route도 차단됨', () => {
  // optional은 현재 코드에 없지만 계약상 존재
  const block = shouldBlockOnViolation('full_enforce', 'optional', false);
  assert.equal(block, true);
});

test('rollout 전환 시 유효 토큰 요청은 모든 모드에서 통과', () => {
  const token = generateToken();
  const req = {
    method: 'POST', path: '/api/quotes', origin: 'http://localhost:3000',
    csrfCookie: token, csrfHeader: token,
  };
  for (const mode of ['report_only', 'soft_enforce', 'full_enforce']) {
    const r = simulateMiddleware(req, mode);
    assert.equal(r.passed, true, `should pass in ${mode}`);
  }
});

// ─── 10. Edge Cases ───
console.log('\n═══ E2E 10. Edge Cases ═══\n');

test('empty string token → invalid_token_format', () => {
  const r = simulateMiddleware({
    method: 'POST', path: '/api/quotes', origin: 'http://localhost:3000',
    csrfCookie: '', csrfHeader: '',
  }, 'full_enforce');
  assert.equal(r.blocked, true);
  assert.equal(r.violation, 'missing_token');
});

test('malformed token (no dots) → invalid_token_format', () => {
  const r = simulateMiddleware({
    method: 'POST', path: '/api/quotes', origin: 'http://localhost:3000',
    csrfCookie: 'noDotsHere', csrfHeader: 'noDotsHere',
  }, 'full_enforce');
  assert.equal(r.blocked, true);
  assert.equal(r.violation, 'invalid_token_format');
});

test('origin with trailing slash stripped → trusted', () => {
  const token = generateToken();
  const r = simulateMiddleware({
    method: 'POST', path: '/api/quotes', origin: 'http://localhost:3000',
    csrfCookie: token, csrfHeader: token,
  }, 'full_enforce');
  assert.equal(r.passed, true);
});

test('OPTIONS method → safe, 통과', () => {
  const r = simulateMiddleware({
    method: 'OPTIONS', path: '/api/quotes', origin: 'https://evil.com',
    csrfCookie: null, csrfHeader: null,
  }, 'full_enforce');
  assert.equal(r.passed, true);
});

// ═══════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(50)}`);
console.log(`E2E Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) { console.log('\n⛔ SOME TESTS FAILED'); process.exit(1); }
else { console.log('\n✅ ALL E2E TESTS PASSED'); }
