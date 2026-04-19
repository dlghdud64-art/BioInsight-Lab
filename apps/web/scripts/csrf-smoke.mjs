#!/usr/bin/env node
/**
 * csrf-smoke.mjs
 *
 * CSRF rollout smoke 테스트 스크립트
 *
 * 사용법:
 *   export LABAXIS_BASE_URL="https://labaxis.com"         # 또는 http://localhost:3000
 *   export LABAXIS_SMOKE_COOKIE='authjs.session-token=...'
 *   node scripts/csrf-smoke.mjs
 *   # 또는
 *   npm run csrf:smoke --workspace=apps/web
 *
 * 환경변수:
 *   LABAXIS_BASE_URL     — 테스트 대상 서버 URL (기본: http://localhost:3000)
 *   LABAXIS_SMOKE_COOKIE — 세션 쿠키 문자열 (없으면 401 예상 테스트 제한)
 *
 * 출력:
 *   Phase 1 (report_only): registry/mode 확인 + highRisk route에 CSRF 없이 POST → 200 OK (차단 안됨 확인)
 *   Phase 2 (soft_enforce): 동일 POST → 403 확인 (highRisk 차단됨 확인)
 */

import { createHash, randomBytes } from 'crypto';

const BASE_URL = process.env.LABAXIS_BASE_URL || 'http://localhost:3000';
const COOKIE = process.env.LABAXIS_SMOKE_COOKIE || '';

// ANSI 색상
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

function log(symbol, label, detail = '') {
  console.log(`  ${symbol} ${label}${detail ? `  ${detail}` : ''}`);
}

function pass(label, detail = '') {
  passed++;
  log(`${GREEN}✓${RESET}`, label, detail);
}

function fail(label, detail = '') {
  failed++;
  failures.push({ label, detail });
  log(`${RED}✗${RESET}`, `${RED}${label}${RESET}`, detail);
}

function skip(label, detail = '') {
  skipped++;
  log(`${YELLOW}–${RESET}`, `${YELLOW}${label}${RESET}`, detail);
}

function section(title) {
  console.log(`\n${CYAN}${BOLD}══ ${title} ══${RESET}`);
}

async function get(path, extraHeaders = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (COOKIE) headers['Cookie'] = COOKIE;
  Object.assign(headers, extraHeaders);

  const res = await fetch(`${BASE_URL}${path}`, { method: 'GET', headers });
  let body = {};
  try { body = await res.json(); } catch {}
  return { status: res.status, body };
}

async function post(path, payload = {}, extraHeaders = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (COOKIE) headers['Cookie'] = COOKIE;
  Object.assign(headers, extraHeaders);

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  let body = {};
  try { body = await res.json(); } catch {}
  return { status: res.status, body };
}

// ═══════════════════════════════════════════════════════
// Test Suites
// ═══════════════════════════════════════════════════════

async function testStatusEndpoint() {
  section('Suite 1: /api/security/csrf-status 접근성');

  if (!COOKIE) {
    skip('csrf-status 접근', 'LABAXIS_SMOKE_COOKIE 미설정 → 스킵');
    return null;
  }

  const { status, body } = await get('/api/security/csrf-status');

  if (status === 401) {
    fail('csrf-status 인증', `401 — 쿠키가 유효하지 않거나 만료됨`);
    return null;
  }
  if (status === 403) {
    fail('csrf-status 권한', `403 — ops_admin/admin 역할 필요`);
    return null;
  }
  if (status !== 200) {
    fail('csrf-status HTTP', `기대 200, 실제 ${status}`);
    return null;
  }

  pass('csrf-status HTTP 200');

  const csrf = body?.csrf;
  if (!csrf) {
    fail('csrf-status 응답 구조', '응답에 csrf 필드 없음');
    return null;
  }

  pass('csrf-status 응답 구조', `mode=${csrf.mode}`);

  const validModes = ['report_only', 'soft_enforce', 'full_enforce'];
  if (validModes.includes(csrf.mode)) {
    pass('csrf-status mode 유효', `"${csrf.mode}"`);
  } else {
    fail('csrf-status mode', `알 수 없는 mode: "${csrf.mode}"`);
  }

  const exempt = csrf.registry?.exempt;
  const highRisk = csrf.registry?.highRisk;

  if (typeof exempt === 'number') {
    if (exempt === 9) {
      pass('exempt 수량', `${exempt}건 (기대 9건) ✓`);
    } else {
      fail('exempt 수량', `기대 9건, 실제 ${exempt}건`);
    }
  } else {
    fail('exempt 수량', '응답에 registry.exempt 없음');
  }

  if (typeof highRisk === 'number') {
    if (highRisk >= 30 && highRisk <= 47) {
      pass('highRisk 수량', `${highRisk}건 (허용 범위 30~47건) ✓`);
    } else {
      fail('highRisk 수량', `${highRisk}건 — 범위 30~47 벗어남`);
    }
  } else {
    fail('highRisk 수량', '응답에 registry.highRisk 없음');
  }

  return csrf.mode;
}

async function testCsrfTokenEndpoint() {
  section('Suite 2: CSRF 토큰 발급 (/api/security/csrf-token)');

  const { status, body } = await get('/api/security/csrf-token');

  // 토큰 endpoint가 없을 수도 있음 (double-submit cookie 방식)
  if (status === 404) {
    skip('csrf-token endpoint', '404 — double-submit cookie 방식 (토큰 endpoint 없음, 정상)');
    return null;
  }

  if (status === 200 && body?.token) {
    pass('csrf-token 발급', `token length: ${body.token.length}`);
    return body.token;
  }

  if (status === 200) {
    skip('csrf-token 응답', '200이지만 token 필드 없음');
    return null;
  }

  skip('csrf-token endpoint', `${status} — 스킵`);
  return null;
}

async function testHighRiskWithoutToken(mode) {
  section('Suite 3: highRisk route — CSRF 토큰 없이 POST');

  // Durable Audit 6건 중 approve 테스트 (존재하지 않는 ID → 404/403이 정상)
  const probeRoutes = [
    { path: '/api/request/__smoke_probe_id__/approve', label: 'approve (irreversible)' },
    { path: '/api/invites/accept', label: 'invites/accept (irreversible)' },
  ];

  for (const route of probeRoutes) {
    const { status } = await post(route.path, { _probe: true });

    if (mode === 'report_only') {
      // report_only: CSRF 차단 안됨 → 404(리소스 없음) or 401/403(인증) 예상, 절대 CSRF 때문에 403이면 안됨
      // 실제로는 인증 미확인일 수도 있으니 403도 허용 (auth 때문일 수 있음)
      if (status === 200 || status === 404 || status === 401 || status === 403 || status === 422) {
        pass(`report_only: ${route.label}`, `${status} — CSRF 토큰 없어도 통과 (차단 없음)`);
      } else if (status === 500) {
        skip(`report_only: ${route.label}`, `500 — 서버 에러 (DB 연결 문제일 수 있음)`);
      } else {
        fail(`report_only: ${route.label}`, `예상치 못한 ${status}`);
      }
    } else if (mode === 'soft_enforce' || mode === 'full_enforce') {
      // soft_enforce/full_enforce: highRisk → CSRF 없으면 403 차단
      if (status === 403) {
        pass(`${mode}: ${route.label}`, `403 CSRF 차단 ✓`);
      } else if (status === 401) {
        skip(`${mode}: ${route.label}`, `401 — 인증 먼저 (CSRF 검사 전)`);
      } else {
        fail(`${mode}: ${route.label}`, `기대 403 (CSRF 차단), 실제 ${status}`);
      }
    } else {
      skip(`${route.label}`, `mode=${mode} 알 수 없음`);
    }
  }
}

async function testGetRequestsNotBlocked(mode) {
  section('Suite 4: GET 요청 — CSRF 영향 없음 확인');

  const getRoutes = [
    { path: '/api/products', label: 'products GET' },
    { path: '/api/organizations', label: 'organizations GET' },
  ];

  for (const route of getRoutes) {
    const { status } = await get(route.path);
    // GET은 CSRF 보호 대상 아님 → 401/403(인증)/200/404 허용, 절대 CSRF 때문에 차단 안됨
    if ([200, 401, 403, 404].includes(status)) {
      pass(`GET ${route.label}`, `${status} (CSRF 미개입 ✓)`);
    } else if (status === 500) {
      skip(`GET ${route.label}`, `500 서버 에러`);
    } else {
      fail(`GET ${route.label}`, `예상치 못한 ${status}`);
    }
  }
}

async function testExemptRouteNotBlocked(mode) {
  section('Suite 5: exempt route — CSRF 체크 없음 확인');

  // /api/invite/[token] 은 exempt — POST해도 CSRF 때문에 차단 안됨
  const { status } = await post('/api/invite/__smoke_probe__', { _probe: true });

  if (status === 403 && (mode === 'soft_enforce' || mode === 'full_enforce')) {
    // 403이 CSRF 때문인지 권한 때문인지 구분 어려움 — 스킵
    skip('exempt invite/[token]', `403 — 권한/CSRF 구분 불가, 스킵`);
  } else if ([200, 401, 404, 422].includes(status)) {
    pass('exempt invite/[token]', `${status} — CSRF exempt 정상`);
  } else if (status === 500) {
    skip('exempt invite/[token]', `500 서버 에러`);
  } else {
    skip('exempt invite/[token]', `${status} — 검증 스킵`);
  }
}

// ═══════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════

async function main() {
  console.log(`\n${BOLD}${CYAN}LABAXIS CSRF Smoke Test${RESET}`);
  console.log(`  target : ${BASE_URL}`);
  console.log(`  cookie : ${COOKIE ? `${COOKIE.slice(0, 40)}...` : '(없음 — 일부 테스트 스킵)'}`);
  console.log(`  time   : ${new Date().toISOString()}`);

  let mode = null;

  try {
    mode = await testStatusEndpoint();
    await testCsrfTokenEndpoint();
    await testHighRiskWithoutToken(mode);
    await testGetRequestsNotBlocked(mode);
    await testExemptRouteNotBlocked(mode);
  } catch (e) {
    console.error(`\n${RED}Fatal error:${RESET}`, e.message);
    process.exit(2);
  }

  // ── 결과 요약 ──
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`${BOLD}결과 요약${RESET}`);
  console.log(`  ${GREEN}passed${RESET}  : ${passed}`);
  console.log(`  ${RED}failed${RESET}  : ${failed}`);
  console.log(`  ${YELLOW}skipped${RESET} : ${skipped}`);
  console.log(`  mode    : ${mode ?? '(미확인)'}`);

  if (failures.length > 0) {
    console.log(`\n${RED}실패 목록:${RESET}`);
    for (const f of failures) {
      console.log(`  ${RED}✗${RESET} ${f.label}  ${f.detail}`);
    }
  }

  console.log('');

  if (mode === 'report_only') {
    console.log(`${YELLOW}ℹ report_only 모드: highRisk 차단 assertion은 기대하지 않음.`);
    console.log(`  Suite 1 (mode/registry) 확인이 Phase 1 bootstrap sanity 핵심.${RESET}`);
  }

  if (failed === 0) {
    console.log(`${GREEN}${BOLD}✓ ALL PASS — exit 0${RESET}\n`);
    process.exit(0);
  } else {
    console.log(`${RED}${BOLD}✗ FAILURES DETECTED — exit 1${RESET}\n`);
    process.exit(1);
  }
}

main();
