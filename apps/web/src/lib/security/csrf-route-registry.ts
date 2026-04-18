/**
 * CSRF Route Registry
 *
 * Security Batch 10: CSRF Full Enforcement
 *
 * 모든 API route의 CSRF 보호 수준을 단일 registry에서 관리합니다.
 * Next.js middleware에서 import하여 route별 CSRF 정책을 결정합니다.
 *
 * 설계 원칙:
 * - exempt 9건, highRisk(irreversible) 42건은 명시 등록
 * - 나머지 209건 eligible route는 기본값 { protection: 'required', highRisk: false }
 * - 패턴은 모듈 로드 시 regex로 pre-compile (middleware 성능 보장)
 * - route 추가/삭제 시 이 파일 + matrix만 갱신
 */

import { type CsrfProtectionLevel } from './csrf-contract';

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════

export interface CsrfRouteConfig {
  readonly protection: CsrfProtectionLevel;
  readonly highRisk: boolean;
  readonly exemptReason?: string;
}

// ═══════════════════════════════════════════════════════
// Default
// ═══════════════════════════════════════════════════════

const DEFAULT_CONFIG: CsrfRouteConfig = {
  protection: 'required',
  highRisk: false,
};

// ═══════════════════════════════════════════════════════
// Exempt Routes (9건)
// CSRF 보호 대상에서 제외 — 각각 고유한 인증 방식 보유
// ═══════════════════════════════════════════════════════

const EXEMPT_ROUTES: ReadonlyArray<{ pattern: string; reason: string }> = [
  { pattern: '/api/auth/[...nextauth]',                 reason: 'framework_csrf_builtin' },
  { pattern: '/api/billing/webhook',                    reason: 'webhook_signature' },
  { pattern: '/api/inbound/sendgrid/[secret]',          reason: 'webhook_signature' },
  { pattern: '/api/invite/[token]',                     reason: 'public_token_auth' },
  { pattern: '/api/vendor-requests/[token]/response',   reason: 'public_token_auth' },
  { pattern: '/api/mobile/auth/signin',                 reason: 'bearer_token_auth' },
  { pattern: '/api/mobile/auth/refresh',                reason: 'bearer_token_auth' },
  { pattern: '/api/vendor/auth/send-link',              reason: 'vendor_token_auth' },
  { pattern: '/api/vendor/quotes/[quoteId]/response',   reason: 'vendor_token_auth' },
];

// ═══════════════════════════════════════════════════════
// High-Risk Routes (irreversible mutations)
// soft_enforce 모드에서도 CSRF 위반 시 차단
// ═══════════════════════════════════════════════════════

const HIGH_RISK_ROUTE_PATTERNS: readonly string[] = [
  // ── Durable Audit 6건 (Batch 6, 최우선) ──
  '/api/request/[id]/approve',
  '/api/request/[id]/cancel',
  '/api/request/[id]/reverse',
  '/api/admin/orders/[id]/status',
  '/api/purchases/[id]/reclass',
  '/api/invites/accept',

  // ── 나머지 irreversible routes ──
  '/api/admin/products/[id]',
  '/api/billing/payment-methods',
  '/api/budgets/[id]',
  '/api/cart/items/[id]',
  '/api/compliance-links/[id]',
  '/api/groupware/send',
  '/api/inventory/[id]',
  '/api/inventory/import/commit',
  '/api/notifications',
  '/api/organizations/[id]',
  '/api/organizations/[id]/logo',
  '/api/organizations/[id]/members',
  '/api/purchases/import/commit',
  '/api/quote-items/[id]',
  '/api/quotes/[id]',
  '/api/quotes/[id]/status',
  '/api/quotes/generate-english',
  '/api/reviews/[id]',
  '/api/team/[id]/members',
  '/api/templates/[id]',
  '/api/user-inventory/[id]',
  '/api/workspaces/[id]',
  '/api/workspaces/[id]/invites',
  '/api/workspaces/[id]/members/[memberId]',
];

// ═══════════════════════════════════════════════════════
// Pattern → Regex Compiler
// ═══════════════════════════════════════════════════════

interface CompiledRoute {
  readonly regex: RegExp;
  readonly config: CsrfRouteConfig;
  readonly pattern: string;
}

function patternToRegex(pattern: string): RegExp {
  const regexStr = pattern
    .replace(/\[\.\.\.([^\]]+)\]/g, '(.+)')       // catch-all: [...param]
    .replace(/\[([^\]]+)\]/g, '([^/]+)');          // dynamic segment: [param]
  return new RegExp(`^${regexStr}$`);
}

// ═══════════════════════════════════════════════════════
// Pre-compiled Registry (모듈 로드 시 1회 실행)
// ═══════════════════════════════════════════════════════

const COMPILED_ROUTES: CompiledRoute[] = [];

// 1. Exempt routes
for (const entry of EXEMPT_ROUTES) {
  COMPILED_ROUTES.push({
    regex: patternToRegex(entry.pattern),
    config: { protection: 'exempt', highRisk: false, exemptReason: entry.reason },
    pattern: entry.pattern,
  });
}

// 2. High-risk routes
for (const pattern of HIGH_RISK_ROUTE_PATTERNS) {
  COMPILED_ROUTES.push({
    regex: patternToRegex(pattern),
    config: { protection: 'required', highRisk: true },
    pattern,
  });
}

// ═══════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════

/**
 * 요청 pathname에 대한 CSRF 설정 반환
 *
 * 매칭 순서: exempt → highRisk → default(required, not highRisk)
 * O(n) scan — 전체 ~40 entries, middleware 레벨에서 무시할 수 있는 비용
 */
export function resolveCsrfConfig(pathname: string): CsrfRouteConfig {
  for (const route of COMPILED_ROUTES) {
    if (route.regex.test(pathname)) {
      return route.config;
    }
  }
  return DEFAULT_CONFIG;
}

/**
 * Registry 내부 접근 (테스트 / matrix 검증용)
 */
export function getRegistryEntries(): ReadonlyArray<{
  pattern: string;
  config: CsrfRouteConfig;
}> {
  return COMPILED_ROUTES.map(r => ({ pattern: r.pattern, config: r.config }));
}

/**
 * Registry 통계 (보고용)
 */
export function getRegistryStats(): {
  exempt: number;
  highRisk: number;
  exemptReasons: Record<string, number>;
} {
  let exempt = 0;
  let highRisk = 0;
  const exemptReasons: Record<string, number> = {};

  for (const route of COMPILED_ROUTES) {
    if (route.config.protection === 'exempt') {
      exempt++;
      const reason = route.config.exemptReason || 'unknown';
      exemptReasons[reason] = (exemptReasons[reason] || 0) + 1;
    }
    if (route.config.highRisk) {
      highRisk++;
    }
  }

  return { exempt, highRisk, exemptReasons };
}
