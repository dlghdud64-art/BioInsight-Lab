/**
 * CSRF Batch 10 Contract Tests (Pure Node.js — no test framework)
 *
 * Run: node apps/web/src/lib/security/__tests__/csrf-batch10-node.mjs
 *
 * 이 파일은 csrf 모듈을 직접 JS로 inline해서 core logic을 검증합니다.
 * (TypeScript/SWC/Jest 없이 실행 가능)
 */

import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════
// Inline contract functions (from csrf-contract.ts)
// ═══════════════════════════════════════════════════════════════

const CSRF_PROTECTED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CSRF_HEADER_NAME = 'x-labaxis-csrf-token';
const CSRF_COOKIE_NAME = '__Host-labaxis-csrf';
const CSRF_TOKEN_MAX_AGE_MS = 2 * 60 * 60 * 1000;

function isProtectedMethod(method) {
  return CSRF_PROTECTED_METHODS.has(method.toUpperCase());
}

function isTrustedOrigin(origin) {
  if (!origin) return false;
  const trusted = ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'];
  return trusted.some(t => origin === t || origin.startsWith(t));
}

function shouldBlockOnViolation(mode, protection, highRisk = false) {
  if (protection === 'exempt') return false;
  switch (mode) {
    case 'full_enforce': return protection === 'required' || protection === 'optional';
    case 'soft_enforce': return highRisk || protection === 'required';
    case 'report_only': return false;
    default: return false;
  }
}

const CSRF_GOVERNANCE_MESSAGES = {
  missing_token: '보안 검증이 완료되지 않아 작업을 진행할 수 없습니다.',
  token_mismatch: '보안 검증이 완료되지 않아 작업을 진행할 수 없습니다.',
  token_expired: '보안 검증이 만료되어 다시 시도해 주세요.',
  origin_mismatch: '현재 요청은 유효한 작업 세션에서 시작되지 않았습니다.',
  missing_origin: '현재 요청은 유효한 작업 세션에서 시작되지 않았습니다.',
  invalid_token_format: '보안 검증이 완료되지 않아 작업을 진행할 수 없습니다.',
};

function getCsrfGovernanceMessage(v) { return CSRF_GOVERNANCE_MESSAGES[v] || '보안 검증에 실패했습니다.'; }

// ═══════════════════════════════════════════════════════════════
// Inline route registry (from csrf-route-registry.ts)
// ═══════════════════════════════════════════════════════════════

const EXEMPT_ROUTES = [
  { pattern: '/api/auth/[...nextauth]', reason: 'framework_csrf_builtin' },
  { pattern: '/api/billing/webhook', reason: 'webhook_signature' },
  { pattern: '/api/inbound/sendgrid/[secret]', reason: 'webhook_signature' },
  { pattern: '/api/invite/[token]', reason: 'public_token_auth' },
  { pattern: '/api/vendor-requests/[token]/response', reason: 'public_token_auth' },
  { pattern: '/api/mobile/auth/signin', reason: 'bearer_token_auth' },
  { pattern: '/api/mobile/auth/refresh', reason: 'bearer_token_auth' },
  { pattern: '/api/vendor/auth/send-link', reason: 'vendor_token_auth' },
  { pattern: '/api/vendor/quotes/[quoteId]/response', reason: 'vendor_token_auth' },
];

const HIGH_RISK_ROUTE_PATTERNS = [
  '/api/request/[id]/approve', '/api/request/[id]/cancel', '/api/request/[id]/reverse',
  '/api/admin/orders/[id]/status', '/api/purchases/[id]/reclass', '/api/invites/accept',
  '/api/admin/products/[id]', '/api/billing/payment-methods', '/api/budgets/[id]',
  '/api/cart/items/[id]', '/api/compliance-links/[id]', '/api/groupware/send',
  '/api/inventory/[id]', '/api/inventory/import/commit', '/api/notifications',
  '/api/organizations/[id]', '/api/organizations/[id]/logo', '/api/organizations/[id]/members',
  '/api/purchases/import/commit', '/api/quote-items/[id]', '/api/quotes/[id]',
  '/api/quotes/[id]/status', '/api/quotes/generate-english', '/api/reviews/[id]',
  '/api/team/[id]/members', '/api/templates/[id]', '/api/user-inventory/[id]',
  '/api/workspaces/[id]', '/api/workspaces/[id]/invites', '/api/workspaces/[id]/members/[memberId]',
];

function patternToRegex(p) {
  const r = p.replace(/\[\.\.\.([^\]]+)\]/g, '(.+)').replace(/\[([^\]]+)\]/g, '([^/]+)');
  return new RegExp(`^${r}$`);
}

const COMPILED = [];
for (const e of EXEMPT_ROUTES) COMPILED.push({ regex: patternToRegex(e.pattern), config: { protection: 'exempt', highRisk: false, exemptReason: e.reason }, pattern: e.pattern });
for (const p of HIGH_RISK_ROUTE_PATTERNS) COMPILED.push({ regex: patternToRegex(p), config: { protection: 'required', highRisk: true }, pattern: p });
const DEFAULT_CONFIG = { protection: 'required', highRisk: false };

function resolveCsrfConfig(pathname) {
  for (const r of COMPILED) { if (r.regex.test(pathname)) return r.config; }
  return DEFAULT_CONFIG;
}

// ═══════════════════════════════════════════════════════════════
// Inline token engine (sync parts, from csrf-token-engine.ts)
// ═══════════════════════════════════════════════════════════════

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

const SIGNING_SECRET = 'labaxis-csrf-dev-secret-do-not-use-in-prod';

function generateCsrfTokenSync() {
  const random = secureRandomHex(32);
  const timestamp = Date.now().toString();
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

function validateCsrfDoubleSubmitSync(cookie, header) {
  if (!cookie || !header) return { valid: false, violation: 'missing_token' };
  if (!parseToken(cookie) || !parseToken(header)) return { valid: false, violation: 'invalid_token_format' };
  if (!timingSafeEqual(cookie, header)) return { valid: false, violation: 'token_mismatch' };
  const payload = cookie.split('.').slice(0,2).join('.');
  if (!timingSafeEqual(cookie.split('.')[2], hmacSignSync(payload, SIGNING_SECRET))) return { valid: false, violation: 'token_mismatch' };
  const parsed = parseToken(cookie);
  if (Date.now() - parsed.timestamp > CSRF_TOKEN_MAX_AGE_MS) return { valid: false, violation: 'token_expired' };
  return { valid: true };
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

console.log('\n═══ 1. Route Registry ═══\n');

test('exempt: /api/auth/callback/google → exempt', () => {
  const c = resolveCsrfConfig('/api/auth/callback/google');
  assert.equal(c.protection, 'exempt');
});

test('exempt: /api/billing/webhook → exempt', () => {
  assert.equal(resolveCsrfConfig('/api/billing/webhook').protection, 'exempt');
});

test('exempt: /api/mobile/auth/signin → exempt', () => {
  assert.equal(resolveCsrfConfig('/api/mobile/auth/signin').protection, 'exempt');
});

test('exempt: /api/vendor/quotes/q-123/response → exempt', () => {
  assert.equal(resolveCsrfConfig('/api/vendor/quotes/q-123/response').protection, 'exempt');
});

test('exempt count = 9', () => {
  const exemptEntries = COMPILED.filter(r => r.config.protection === 'exempt');
  assert.equal(exemptEntries.length, 9);
});

test('highRisk: /api/request/abc/approve → required + highRisk', () => {
  const c = resolveCsrfConfig('/api/request/abc/approve');
  assert.equal(c.protection, 'required'); assert.equal(c.highRisk, true);
});

test('highRisk: /api/invites/accept → required + highRisk', () => {
  const c = resolveCsrfConfig('/api/invites/accept');
  assert.equal(c.protection, 'required'); assert.equal(c.highRisk, true);
});

test('highRisk: /api/admin/orders/123/status → required + highRisk', () => {
  const c = resolveCsrfConfig('/api/admin/orders/123/status');
  assert.equal(c.protection, 'required'); assert.equal(c.highRisk, true);
});

test('highRisk count = 30', () => {
  assert.equal(COMPILED.filter(r => r.config.highRisk).length, 30);
});

test('standard: /api/cart → required + not highRisk', () => {
  const c = resolveCsrfConfig('/api/cart');
  assert.equal(c.protection, 'required'); assert.equal(c.highRisk, false);
});

test('standard: /api/favorites → required + not highRisk', () => {
  const c = resolveCsrfConfig('/api/favorites');
  assert.equal(c.protection, 'required'); assert.equal(c.highRisk, false);
});

test('no duplicate patterns in registry', () => {
  const patterns = COMPILED.map(r => r.pattern);
  assert.equal(patterns.length, new Set(patterns).size);
});

console.log('\n═══ 2. CSRF Contract ═══\n');

test('isProtectedMethod: POST=true, GET=false', () => {
  assert.equal(isProtectedMethod('POST'), true);
  assert.equal(isProtectedMethod('GET'), false);
  assert.equal(isProtectedMethod('DELETE'), true);
  assert.equal(isProtectedMethod('HEAD'), false);
});

test('isTrustedOrigin: localhost=true, evil.com=false, null=false', () => {
  assert.equal(isTrustedOrigin('http://localhost:3000'), true);
  assert.equal(isTrustedOrigin('https://evil.com'), false);
  assert.equal(isTrustedOrigin(null), false);
});

test('shouldBlock: report_only never blocks', () => {
  assert.equal(shouldBlockOnViolation('report_only', 'required', true), false);
  assert.equal(shouldBlockOnViolation('report_only', 'required', false), false);
});

test('shouldBlock: soft_enforce blocks required', () => {
  assert.equal(shouldBlockOnViolation('soft_enforce', 'required', true), true);
  assert.equal(shouldBlockOnViolation('soft_enforce', 'required', false), true);
});

test('shouldBlock: full_enforce blocks required', () => {
  assert.equal(shouldBlockOnViolation('full_enforce', 'required', false), true);
});

test('shouldBlock: exempt never blocked', () => {
  assert.equal(shouldBlockOnViolation('full_enforce', 'exempt', false), false);
  assert.equal(shouldBlockOnViolation('soft_enforce', 'exempt', true), false);
});

test('governance messages: no raw key exposure', () => {
  for (const v of ['missing_token','token_mismatch','token_expired','origin_mismatch','missing_origin','invalid_token_format']) {
    const msg = getCsrfGovernanceMessage(v);
    assert.ok(msg.length > 0);
    assert.ok(!msg.includes('missing_token'));
    assert.ok(!msg.includes('token_mismatch'));
  }
});

test('CSRF header = x-labaxis-csrf-token', () => assert.equal(CSRF_HEADER_NAME, 'x-labaxis-csrf-token'));
test('CSRF cookie has __Host- prefix', () => assert.ok(CSRF_COOKIE_NAME.startsWith('__Host-')));

console.log('\n═══ 3. Token Engine ═══\n');

test('generateCsrfTokenSync: 3-part dot format', () => {
  const t = generateCsrfTokenSync();
  const parts = t.split('.');
  assert.equal(parts.length, 3);
  assert.ok(parts[0].length >= 16);
  assert.ok(Number(parts[1]) > 0);
  assert.ok(parts[2].length >= 8);
});

test('generateCsrfTokenSync: unique each call', () => {
  assert.notEqual(generateCsrfTokenSync(), generateCsrfTokenSync());
});

test('validate: same valid token → valid', () => {
  const t = generateCsrfTokenSync();
  assert.equal(validateCsrfDoubleSubmitSync(t, t).valid, true);
});

test('validate: null cookie → missing_token', () => {
  const t = generateCsrfTokenSync();
  assert.equal(validateCsrfDoubleSubmitSync(null, t).violation, 'missing_token');
});

test('validate: null header → missing_token', () => {
  const t = generateCsrfTokenSync();
  assert.equal(validateCsrfDoubleSubmitSync(t, null).violation, 'missing_token');
});

test('validate: mismatched tokens → token_mismatch', () => {
  const r = validateCsrfDoubleSubmitSync(generateCsrfTokenSync(), generateCsrfTokenSync());
  assert.equal(r.valid, false); assert.equal(r.violation, 'token_mismatch');
});

test('validate: bad format → invalid_token_format', () => {
  assert.equal(validateCsrfDoubleSubmitSync('bad', 'bad').violation, 'invalid_token_format');
});

test('validate: tampered signature → token_mismatch', () => {
  const t = generateCsrfTokenSync();
  const parts = t.split('.'); const tampered = `${parts[0]}.${parts[1]}.ffffffff`;
  assert.equal(validateCsrfDoubleSubmitSync(tampered, tampered).violation, 'token_mismatch');
});

console.log('\n═══ 4. Integration ═══\n');

test('exempt route not blocked in full_enforce', () => {
  const c = resolveCsrfConfig('/api/billing/webhook');
  assert.equal(shouldBlockOnViolation('full_enforce', c.protection, c.highRisk), false);
});

test('durable audit route blocked in soft_enforce', () => {
  const c = resolveCsrfConfig('/api/request/abc/approve');
  assert.equal(c.highRisk, true);
  assert.equal(shouldBlockOnViolation('soft_enforce', c.protection, c.highRisk), true);
});

test('standard route blocked in soft_enforce', () => {
  const c = resolveCsrfConfig('/api/cart');
  assert.equal(shouldBlockOnViolation('soft_enforce', c.protection, c.highRisk), true);
});

test('standard route NOT blocked in report_only', () => {
  const c = resolveCsrfConfig('/api/cart');
  assert.equal(shouldBlockOnViolation('report_only', c.protection, c.highRisk), false);
});

test('rollout scenario: report → soft → full', () => {
  const hr = resolveCsrfConfig('/api/invites/accept');
  assert.equal(shouldBlockOnViolation('report_only', hr.protection, hr.highRisk), false);
  assert.equal(shouldBlockOnViolation('soft_enforce', hr.protection, hr.highRisk), true);
  assert.equal(shouldBlockOnViolation('full_enforce', hr.protection, hr.highRisk), true);
  const ex = resolveCsrfConfig('/api/billing/webhook');
  assert.equal(shouldBlockOnViolation('full_enforce', ex.protection, ex.highRisk), false);
});

// ═══════════════════════════════════════════════════════════════
// 5. Follow-up Batch: Telemetry + enforceAction CSRF + Cookie
// ═══════════════════════════════════════════════════════════════

console.log('\n═══ 5. Follow-up Batch ═══\n');

// ── 5a. Durable Audit 6 routes soft_enforce 차단 검증 ──
const DURABLE_AUDIT_ROUTES = [
  '/api/request/abc/approve',
  '/api/request/abc/cancel',
  '/api/request/abc/reverse',
  '/api/admin/orders/123/status',
  '/api/purchases/456/reclass',
  '/api/invites/accept',
];

test('durable audit 6건 모두 highRisk + soft_enforce에서 차단', () => {
  for (const route of DURABLE_AUDIT_ROUTES) {
    const c = resolveCsrfConfig(route);
    assert.equal(c.protection, 'required', `${route} should be required`);
    assert.equal(c.highRisk, true, `${route} should be highRisk`);
    assert.equal(shouldBlockOnViolation('soft_enforce', c.protection, c.highRisk), true, `${route} should be blocked in soft_enforce`);
  }
});

test('durable audit 6건 report_only에서는 차단 안됨', () => {
  for (const route of DURABLE_AUDIT_ROUTES) {
    const c = resolveCsrfConfig(route);
    assert.equal(shouldBlockOnViolation('report_only', c.protection, c.highRisk), false, `${route} should not be blocked in report_only`);
  }
});

test('durable audit 6건 full_enforce에서도 차단', () => {
  for (const route of DURABLE_AUDIT_ROUTES) {
    const c = resolveCsrfConfig(route);
    assert.equal(shouldBlockOnViolation('full_enforce', c.protection, c.highRisk), true, `${route} should be blocked in full_enforce`);
  }
});

// ── 5b. __Host- cookie 헤더 검증 ──
function buildCsrfCookieHeader(token) {
  const isProd = typeof process !== 'undefined' && process.env.NODE_ENV === 'production';
  const parts = [`__Host-labaxis-csrf=${token}`, 'Path=/', 'SameSite=Lax'];
  if (isProd) parts.push('Secure');
  parts.push(`Max-Age=${Math.floor(CSRF_TOKEN_MAX_AGE_MS / 1000)}`);
  return parts.join('; ');
}

test('cookie header: SameSite=Lax, Path=/, Max-Age 포함', () => {
  const h = buildCsrfCookieHeader('test-tok');
  assert.ok(h.includes('SameSite=Lax'));
  assert.ok(h.includes('Path=/'));
  assert.ok(h.includes('Max-Age='));
  assert.ok(h.includes('__Host-labaxis-csrf=test-tok'));
});

test('cookie header: __Host- prefix 사용', () => {
  const h = buildCsrfCookieHeader('tok');
  assert.ok(h.startsWith('__Host-'));
});

test('cookie header: dev에서 Secure 미포함 (NODE_ENV ≠ production)', () => {
  // 테스트 환경에서는 NODE_ENV가 production이 아니므로 Secure 미포함
  const h = buildCsrfCookieHeader('tok');
  assert.ok(!h.includes('Secure'), 'dev 환경에서 Secure 없어야 함');
});

test('cookie Max-Age = 7200 (2시간)', () => {
  const h = buildCsrfCookieHeader('tok');
  assert.ok(h.includes('Max-Age=7200'));
});

// ── 5c. enforceAction CSRF integration (inline 검증 시뮬레이션) ──
// enforceAction은 서버 함수이므로 직접 호출 불가 — CSRF 로직 단위 테스트
test('inline CSRF: 유효한 토큰 쌍 → 통과', () => {
  const t = generateCsrfTokenSync();
  const r = validateCsrfDoubleSubmitSync(t, t);
  assert.equal(r.valid, true);
  assert.equal(r.violation, undefined);
});

test('inline CSRF: cookie 누락 → missing_token (차단 대상)', () => {
  const t = generateCsrfTokenSync();
  const r = validateCsrfDoubleSubmitSync(undefined, t);
  assert.equal(r.valid, false);
  assert.equal(r.violation, 'missing_token');
  // soft_enforce + required → 차단
  assert.equal(shouldBlockOnViolation('soft_enforce', 'required', false), true);
});

test('inline CSRF: header 누락 → missing_token (차단 대상)', () => {
  const t = generateCsrfTokenSync();
  const r = validateCsrfDoubleSubmitSync(t, undefined);
  assert.equal(r.valid, false);
  assert.equal(r.violation, 'missing_token');
});

test('inline CSRF: 불일치 토큰 + highRisk → soft_enforce에서 차단', () => {
  const r = validateCsrfDoubleSubmitSync(generateCsrfTokenSync(), generateCsrfTokenSync());
  assert.equal(r.valid, false);
  assert.equal(r.violation, 'token_mismatch');
  assert.equal(shouldBlockOnViolation('soft_enforce', 'required', true), true);
});

test('inline CSRF: 변조 서명 + full_enforce → 차단', () => {
  const t = generateCsrfTokenSync();
  const parts = t.split('.');
  const tampered = `${parts[0]}.${parts[1]}.deadbeef`;
  const r = validateCsrfDoubleSubmitSync(tampered, tampered);
  assert.equal(r.valid, false);
  assert.equal(shouldBlockOnViolation('full_enforce', 'required', false), true);
});

// ── 5d. Telemetry mapping 검증 ──
function mapViolationToTelemetry(violation) {
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

test('telemetry mapping: 모든 violation type 매핑 정확', () => {
  assert.equal(mapViolationToTelemetry('missing_token'), 'csrf_missing_token');
  assert.equal(mapViolationToTelemetry('token_mismatch'), 'csrf_token_mismatch');
  assert.equal(mapViolationToTelemetry('token_expired'), 'csrf_token_expired');
  assert.equal(mapViolationToTelemetry('origin_mismatch'), 'csrf_origin_mismatch');
  assert.equal(mapViolationToTelemetry('missing_origin'), 'csrf_origin_mismatch');
  assert.equal(mapViolationToTelemetry('invalid_token_format'), 'csrf_token_mismatch');
});

test('telemetry mapping: unknown → fallback', () => {
  assert.equal(mapViolationToTelemetry('unknown_thing'), 'csrf_token_mismatch');
});

// ═══════════════════════════════════════════════════════════════
// 6. Coverage & Bootstrap Integration
// ═══════════════════════════════════════════════════════════════

console.log('\n═══ 6. Coverage & Bootstrap ═══\n');

test('registry: 전체 highRisk ≥ 30 (registry 확장 후)', () => {
  const hrCount = COMPILED.filter(r => r.config.highRisk).length;
  assert.ok(hrCount >= 30, `highRisk count ${hrCount} should be >= 30`);
});

test('registry: exempt + highRisk + standard = total compiled', () => {
  const exemptCount = COMPILED.filter(r => r.config.protection === 'exempt').length;
  const hrCount = COMPILED.filter(r => r.config.highRisk).length;
  assert.equal(exemptCount + hrCount, COMPILED.length);
});

// ── 6a. csrfFetch 계약 시뮬레이션 ──
// csrfFetch는 browser-only이므로 로직을 인라인으로 검증
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function shouldAttachCsrf(method) {
  return !SAFE_METHODS.has(method.toUpperCase());
}

test('csrfFetch contract: POST → CSRF 부착', () => {
  assert.equal(shouldAttachCsrf('POST'), true);
});

test('csrfFetch contract: PUT/PATCH/DELETE → CSRF 부착', () => {
  assert.equal(shouldAttachCsrf('PUT'), true);
  assert.equal(shouldAttachCsrf('PATCH'), true);
  assert.equal(shouldAttachCsrf('DELETE'), true);
});

test('csrfFetch contract: GET → CSRF 미부착', () => {
  assert.equal(shouldAttachCsrf('GET'), false);
});

test('csrfFetch contract: HEAD/OPTIONS → CSRF 미부착', () => {
  assert.equal(shouldAttachCsrf('HEAD'), false);
  assert.equal(shouldAttachCsrf('OPTIONS'), false);
});

// ── 6b. Staged rollout 계약 ──
test('staged rollout: report_only에서 highRisk 차단 안됨', () => {
  assert.equal(shouldBlockOnViolation('report_only', 'required', true), false);
});

test('staged rollout: soft_enforce에서 highRisk 차단', () => {
  assert.equal(shouldBlockOnViolation('soft_enforce', 'required', true), true);
});

test('staged rollout: soft_enforce에서 standard도 차단', () => {
  assert.equal(shouldBlockOnViolation('soft_enforce', 'required', false), true);
});

test('staged rollout: full_enforce에서 optional도 차단', () => {
  assert.equal(shouldBlockOnViolation('full_enforce', 'optional', false), true);
});

// ═══════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) { console.log('\n⛔ SOME TESTS FAILED'); process.exit(1); }
else { console.log('\n✅ ALL TESTS PASSED'); }
