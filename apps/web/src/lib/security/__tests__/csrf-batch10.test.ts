/**
 * CSRF Batch 10 Contract Tests
 *
 * 검증 대상:
 * 1. csrf-route-registry — exempt/highRisk/default 분류 정확성
 * 2. csrf-contract — rollout mode 차단 판정
 * 3. csrf-token-engine — 토큰 생성/검증/만료/서명
 * 4. middleware wiring — exempt 미파괴, body stream 호환
 */

// Jest — @testing-library/jest-dom 기반

// ── Route Registry ──
import {
  resolveCsrfConfig,
  getRegistryEntries,
  getRegistryStats,
} from '../csrf-route-registry';

// ── Contract ──
import {
  isProtectedMethod,
  isTrustedOrigin,
  shouldBlockOnViolation,
  getCsrfGovernanceMessage,
  getCsrfRolloutMode,
  CSRF_HEADER_NAME,
  CSRF_COOKIE_NAME,
  type CsrfViolationType,
} from '../csrf-contract';

// ── Token Engine ──
import {
  generateCsrfTokenSync,
  validateCsrfDoubleSubmitSync,
  isCsrfTokenExpired,
  shouldRefreshCsrfToken,
  buildCsrfCookieHeader,
} from '../csrf-token-engine';

// ═══════════════════════════════════════════════════════════════
// 1. Route Registry
// ═══════════════════════════════════════════════════════════════

describe('csrf-route-registry', () => {
  describe('exempt routes', () => {
    const exemptRoutes = [
      '/api/auth/callback/google',         // [...nextauth] catch-all
      '/api/auth/signin',                  // [...nextauth] catch-all
      '/api/billing/webhook',
      '/api/inbound/sendgrid/abc123',
      '/api/invite/some-token-value',
      '/api/vendor-requests/tkn-xyz/response',
      '/api/mobile/auth/signin',
      '/api/mobile/auth/refresh',
      '/api/vendor/auth/send-link',
      '/api/vendor/quotes/q-123/response',
    ];

    it.each(exemptRoutes)('should classify %s as exempt', (route) => {
      const config = resolveCsrfConfig(route);
      expect(config.protection).toBe('exempt');
      expect(config.exemptReason).toBeDefined();
    });

    it('exempt 수는 정확히 9개여야 함', () => {
      const stats = getRegistryStats();
      expect(stats.exempt).toBe(9);
    });

    it('exempt reason 분류가 올바름', () => {
      const stats = getRegistryStats();
      expect(stats.exemptReasons).toEqual({
        framework_csrf_builtin: 1,
        webhook_signature: 2,
        public_token_auth: 2,
        bearer_token_auth: 2,
        vendor_token_auth: 2,
      });
    });
  });

  describe('high-risk routes', () => {
    const highRiskRoutes = [
      // Durable audit 6건
      '/api/request/abc/approve',
      '/api/request/abc/cancel',
      '/api/request/abc/reverse',
      '/api/admin/orders/123/status',
      '/api/purchases/456/reclass',
      '/api/invites/accept',
      // Other irreversible
      '/api/admin/products/p1',
      '/api/billing/payment-methods',
      '/api/budgets/b1',
      '/api/organizations/org1',
      '/api/quotes/q1',
      '/api/quotes/q1/status',
      '/api/inventory/i1',
      '/api/workspaces/w1',
    ];

    it.each(highRiskRoutes)('should classify %s as required + highRisk', (route) => {
      const config = resolveCsrfConfig(route);
      expect(config.protection).toBe('required');
      expect(config.highRisk).toBe(true);
    });

    it('highRisk 수는 30개', () => {
      const stats = getRegistryStats();
      expect(stats.highRisk).toBe(30);
    });
  });

  describe('default (standard) routes', () => {
    const standardRoutes = [
      '/api/cart',
      '/api/favorites',
      '/api/search',
      '/api/products/p1/reviews',
      '/api/analytics/track',
    ];

    it.each(standardRoutes)('should classify %s as required + not highRisk', (route) => {
      const config = resolveCsrfConfig(route);
      expect(config.protection).toBe('required');
      expect(config.highRisk).toBe(false);
    });
  });

  describe('registry integrity', () => {
    it('모든 entry에 pattern이 존재', () => {
      const entries = getRegistryEntries();
      for (const entry of entries) {
        expect(entry.pattern).toBeTruthy();
        expect(entry.config).toBeDefined();
      }
    });

    it('exempt과 highRisk entry에 중복 패턴 없음', () => {
      const entries = getRegistryEntries();
      const patterns = entries.map(e => e.pattern);
      const uniquePatterns = new Set(patterns);
      expect(patterns.length).toBe(uniquePatterns.size);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. CSRF Contract
// ═══════════════════════════════════════════════════════════════

describe('csrf-contract', () => {
  describe('isProtectedMethod', () => {
    it('POST, PUT, PATCH, DELETE는 protected', () => {
      expect(isProtectedMethod('POST')).toBe(true);
      expect(isProtectedMethod('PUT')).toBe(true);
      expect(isProtectedMethod('PATCH')).toBe(true);
      expect(isProtectedMethod('DELETE')).toBe(true);
    });

    it('GET, HEAD, OPTIONS는 not protected', () => {
      expect(isProtectedMethod('GET')).toBe(false);
      expect(isProtectedMethod('HEAD')).toBe(false);
      expect(isProtectedMethod('OPTIONS')).toBe(false);
    });

    it('case insensitive', () => {
      expect(isProtectedMethod('post')).toBe(true);
      expect(isProtectedMethod('get')).toBe(false);
    });
  });

  describe('isTrustedOrigin', () => {
    it('localhost:3000은 trusted', () => {
      expect(isTrustedOrigin('http://localhost:3000')).toBe(true);
    });

    it('null/undefined는 not trusted', () => {
      expect(isTrustedOrigin(null)).toBe(false);
      expect(isTrustedOrigin(undefined)).toBe(false);
    });

    it('임의 origin은 not trusted', () => {
      expect(isTrustedOrigin('https://evil.com')).toBe(false);
    });
  });

  describe('shouldBlockOnViolation', () => {
    it('report_only 모드에서는 절대 차단하지 않음', () => {
      expect(shouldBlockOnViolation('report_only', 'required', true)).toBe(false);
      expect(shouldBlockOnViolation('report_only', 'required', false)).toBe(false);
    });

    it('soft_enforce 모드에서 highRisk는 차단', () => {
      expect(shouldBlockOnViolation('soft_enforce', 'required', true)).toBe(true);
    });

    it('soft_enforce 모드에서 required는 차단', () => {
      expect(shouldBlockOnViolation('soft_enforce', 'required', false)).toBe(true);
    });

    it('full_enforce 모드에서 required는 차단', () => {
      expect(shouldBlockOnViolation('full_enforce', 'required', false)).toBe(true);
    });

    it('exempt route는 어떤 모드에서도 차단하지 않음', () => {
      expect(shouldBlockOnViolation('full_enforce', 'exempt', false)).toBe(false);
      expect(shouldBlockOnViolation('soft_enforce', 'exempt', true)).toBe(false);
    });
  });

  describe('getCsrfGovernanceMessage', () => {
    it('모든 violation type에 대해 한국어 메시지 반환 (raw key 미노출)', () => {
      const violations: CsrfViolationType[] = [
        'missing_token', 'token_mismatch', 'token_expired',
        'origin_mismatch', 'missing_origin', 'invalid_token_format',
      ];
      for (const v of violations) {
        const msg = getCsrfGovernanceMessage(v);
        expect(msg).toBeTruthy();
        expect(msg).not.toContain('missing_token');
        expect(msg).not.toContain('token_mismatch');
        expect(msg).not.toContain('origin_mismatch');
      }
    });
  });

  describe('constants', () => {
    it('CSRF header name이 올바름', () => {
      expect(CSRF_HEADER_NAME).toBe('x-labaxis-csrf-token');
    });

    it('CSRF cookie name이 __Host- prefix를 가짐', () => {
      expect(CSRF_COOKIE_NAME).toMatch(/^__Host-/);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. Token Engine
// ═══════════════════════════════════════════════════════════════

describe('csrf-token-engine', () => {
  describe('generateCsrfTokenSync', () => {
    it('토큰은 3-part dot-separated format', () => {
      const token = generateCsrfTokenSync();
      const parts = token.split('.');
      expect(parts.length).toBe(3);
      expect(parts[0].length).toBeGreaterThanOrEqual(16); // random hex
      expect(Number(parts[1])).toBeGreaterThan(0);         // timestamp
      expect(parts[2].length).toBeGreaterThanOrEqual(8);   // signature
    });

    it('매번 다른 토큰 생성', () => {
      const t1 = generateCsrfTokenSync();
      const t2 = generateCsrfTokenSync();
      expect(t1).not.toBe(t2);
    });
  });

  describe('validateCsrfDoubleSubmitSync', () => {
    it('동일한 유효 토큰이면 valid', () => {
      const token = generateCsrfTokenSync();
      const result = validateCsrfDoubleSubmitSync(token, token);
      expect(result.valid).toBe(true);
      expect(result.violation).toBeUndefined();
    });

    it('cookie 또는 header 누락이면 missing_token', () => {
      const token = generateCsrfTokenSync();
      expect(validateCsrfDoubleSubmitSync(null, token).violation).toBe('missing_token');
      expect(validateCsrfDoubleSubmitSync(token, null).violation).toBe('missing_token');
      expect(validateCsrfDoubleSubmitSync(null, null).violation).toBe('missing_token');
    });

    it('cookie ≠ header이면 token_mismatch', () => {
      const t1 = generateCsrfTokenSync();
      const t2 = generateCsrfTokenSync();
      const result = validateCsrfDoubleSubmitSync(t1, t2);
      expect(result.valid).toBe(false);
      expect(result.violation).toBe('token_mismatch');
    });

    it('형식이 잘못된 토큰이면 invalid_token_format', () => {
      const result = validateCsrfDoubleSubmitSync('not-a-token', 'not-a-token');
      expect(result.valid).toBe(false);
      expect(result.violation).toBe('invalid_token_format');
    });

    it('서명이 변조된 토큰이면 token_mismatch', () => {
      const token = generateCsrfTokenSync();
      const parts = token.split('.');
      const tampered = `${parts[0]}.${parts[1]}.ffffffff`;
      const result = validateCsrfDoubleSubmitSync(tampered, tampered);
      expect(result.valid).toBe(false);
      expect(result.violation).toBe('token_mismatch');
    });
  });

  describe('isCsrfTokenExpired', () => {
    it('방금 생성한 토큰은 만료되지 않음', () => {
      const token = generateCsrfTokenSync();
      expect(isCsrfTokenExpired(token)).toBe(false);
    });

    it('잘못된 토큰은 만료로 처리', () => {
      expect(isCsrfTokenExpired('invalid')).toBe(true);
    });
  });

  describe('shouldRefreshCsrfToken', () => {
    it('방금 생성한 토큰은 갱신 불필요', () => {
      const token = generateCsrfTokenSync();
      expect(shouldRefreshCsrfToken(token)).toBe(false);
    });
  });

  describe('buildCsrfCookieHeader', () => {
    it('SameSite=Lax, Path=/, Max-Age 포함', () => {
      const header = buildCsrfCookieHeader('test-token');
      expect(header).toContain('SameSite=Lax');
      expect(header).toContain('Path=/');
      expect(header).toContain('Max-Age=');
      expect(header).toContain('__Host-labaxis-csrf=test-token');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. Integration: Registry + Contract 교차 검증
// ═══════════════════════════════════════════════════════════════

describe('CSRF integration', () => {
  it('exempt route가 report_only에서도 차단되지 않음', () => {
    const exemptConfig = resolveCsrfConfig('/api/billing/webhook');
    expect(shouldBlockOnViolation('full_enforce', exemptConfig.protection, exemptConfig.highRisk)).toBe(false);
  });

  it('durable audit route(highRisk)가 soft_enforce에서 차단됨', () => {
    const config = resolveCsrfConfig('/api/request/abc/approve');
    expect(config.highRisk).toBe(true);
    expect(shouldBlockOnViolation('soft_enforce', config.protection, config.highRisk)).toBe(true);
  });

  it('standard route가 soft_enforce에서 차단됨', () => {
    const config = resolveCsrfConfig('/api/cart');
    expect(config.protection).toBe('required');
    expect(shouldBlockOnViolation('soft_enforce', config.protection, config.highRisk)).toBe(true);
  });

  it('standard route가 report_only에서 차단되지 않음', () => {
    const config = resolveCsrfConfig('/api/cart');
    expect(shouldBlockOnViolation('report_only', config.protection, config.highRisk)).toBe(false);
  });

  it('전체 rollout 시나리오: report → soft → full', () => {
    // highRisk route
    const hr = resolveCsrfConfig('/api/invites/accept');
    expect(shouldBlockOnViolation('report_only', hr.protection, hr.highRisk)).toBe(false);
    expect(shouldBlockOnViolation('soft_enforce', hr.protection, hr.highRisk)).toBe(true);
    expect(shouldBlockOnViolation('full_enforce', hr.protection, hr.highRisk)).toBe(true);

    // standard route
    const std = resolveCsrfConfig('/api/favorites');
    expect(shouldBlockOnViolation('report_only', std.protection, std.highRisk)).toBe(false);
    expect(shouldBlockOnViolation('soft_enforce', std.protection, std.highRisk)).toBe(true);
    expect(shouldBlockOnViolation('full_enforce', std.protection, std.highRisk)).toBe(true);

    // exempt route
    const ex = resolveCsrfConfig('/api/billing/webhook');
    expect(shouldBlockOnViolation('report_only', ex.protection, ex.highRisk)).toBe(false);
    expect(shouldBlockOnViolation('soft_enforce', ex.protection, ex.highRisk)).toBe(false);
    expect(shouldBlockOnViolation('full_enforce', ex.protection, ex.highRisk)).toBe(false);
  });
});
