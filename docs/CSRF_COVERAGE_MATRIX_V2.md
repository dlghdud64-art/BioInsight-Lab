# CSRF Batch 10 — Route Coverage Matrix v2
# Generated: 2026-04-14
# Status: engineering-complete / rollout-ready

## Denominator Definitions (감사·회고 기준선)

아래 분모 정의는 Batch 10 close까지 고정합니다. route 추가/삭제 시 이 섹션을 먼저 갱신합니다.

| Term | Definition | Count | Source |
|------|-----------|-------|--------|
| **Total unsafe route inventory** | `apps/web/src/app/api/**/route.ts` 전수 — 모든 HTTP method 포함 | 278 | filesystem scan |
| **CSRF eligible** | Total에서 exempt 9건을 뺀 나머지. middleware gate가 CSRF 검증을 수행하는 대상 | 269 | csrf-route-registry.ts |
| **Exempt** | 고유 인증 방식 보유 route (webhook_signature, bearer_token, public_token, framework_builtin, vendor_token) | 9 | csrf-route-registry.ts EXEMPT_ROUTES |
| **Frontend mutation callsites** | Eligible route 중 POST/PUT/PATCH/DELETE handler가 있는 route | 182 | route.ts export function scan |
| **High-risk subset** | irreversible mutation — soft_enforce에서도 차단 대상 | 47 | csrf-route-registry.ts HIGH_RISK_ROUTE_PATTERNS |

주의: 이전 문서에서 "209 eligible"로 표기된 수치는 Batch 8 시점의 측정값이며, Batch 10 이후 route 추가로 269로 증가했습니다.

## Summary

| Metric | Count |
|--------|-------|
| Total API routes | 278 |
| Mutation routes (POST/PUT/PATCH/DELETE) | 190 |
| GET-only routes | 88 |
| Exempt routes | 9 |
| High-risk (irreversible) routes | 47 |
| Standard (required, not highRisk) | 222 |
| **Eligible for CSRF** (exempt 제외) | **269** |
| Eligible + mutation | 182 |

## Server-Side Coverage (middleware.ts)

| Layer | Status | Detail |
|-------|--------|--------|
| middleware.ts CSRF gate | ✅ Active | 모든 /api/* POST/PUT/PATCH/DELETE |
| Rollout mode | report_only | LABAXIS_CSRF_MODE env |
| Structured telemetry | ✅ Active | recordSecurityEvent + provenance |
| Route registry | ✅ Complete | 9 exempt + 47 highRisk |
| enforceAction() CSRF | ✅ Active | defense-in-depth for inline enforcement |

## Frontend Coverage (Client-Side)

| Layer | Status | Detail |
|-------|--------|--------|
| apiClient (api-client.ts) | ✅ CSRF attached | auto token bootstrap + header |
| csrfFetch wrapper | ✅ Available | drop-in fetch replacement |
| api.post/put/patch/delete | ✅ CSRF attached | apiClient 기반 |
| Raw fetch (mutation) files | ⚠️ 29 files unprotected | CSRF header 미부착 |

## High-Risk Routes (47건)

| Route | Methods | Frontend Caller | CSRF Status |
|-------|---------|----------------|-------------|
| `/api/admin/orders/[id]/status` | GET, PATCH | — | ✅ Server-only |
| `/api/admin/products/[id]` | PATCH | — | ✅ Server-only |
| `/api/billing/payment-methods` | GET, POST, DELETE | — | ✅ Server-only |
| `/api/budgets/[id]` | GET, PATCH, DELETE | — | ✅ Server-only |
| `/api/cart/items/[id]` | PATCH, DELETE | — | ✅ Server-only |
| `/api/compliance-links/[id]` | GET, PATCH, DELETE | — | ✅ Server-only |
| `/api/groupware/send` | POST | — | ✅ Server-only |
| `/api/inventory/[id]` | GET, PATCH, DELETE | — | ✅ Server-only |
| `/api/inventory/auto-reorder` | POST | — | ✅ Server-only |
| `/api/inventory/bulk` | POST | — | ✅ Server-only |
| `/api/inventory/export-labels` | GET | ⚠️ rawFetch | ⚠️ Raw fetch |
| `/api/inventory/import` | POST | — | ✅ Server-only |
| `/api/inventory/import/commit` | POST | — | ✅ Server-only |
| `/api/inventory/lookup` | GET | — | ✅ Server-only |
| `/api/inventory/reorder-recommendations` | GET | ⚠️ rawFetch | ⚠️ Raw fetch |
| `/api/inventory/scan` | GET | — | ✅ Server-only |
| `/api/inventory/scan-label` | POST | — | ✅ Server-only |
| `/api/inventory/usage` | GET, POST | — | ✅ Server-only |
| `/api/invites/accept` | POST | — | ✅ Server-only |
| `/api/notifications` | GET, POST | — | ✅ Server-only |
| `/api/organizations/[id]` | GET, PATCH, DELETE | — | ✅ Server-only |
| `/api/organizations/[id]/logo` | POST, DELETE | — | ✅ Server-only |
| `/api/organizations/[id]/members` | GET, PATCH, DELETE | — | ✅ Server-only |
| `/api/organizations/check-slug` | GET | — | ✅ Server-only |
| `/api/purchases/[id]/reclass` | POST | — | ✅ Server-only |
| `/api/purchases/import/commit` | POST | — | ✅ Server-only |
| `/api/quote-items/[id]` | PUT, DELETE | — | ✅ Server-only |
| `/api/quotes/[id]` | GET, PATCH, DELETE | — | ✅ Server-only |
| `/api/quotes/[id]/status` | GET, PATCH | — | ✅ Server-only |
| `/api/quotes/cost-optimization` | POST | — | ✅ Server-only |
| `/api/quotes/from-cart` | POST | — | ✅ Server-only |
| `/api/quotes/generate-english` | POST | — | ✅ Server-only |
| `/api/quotes/my` | GET | — | ✅ Server-only |
| `/api/quotes/optimize-combination` | POST | — | ✅ Server-only |
| `/api/quotes/parse-image` | POST | — | ✅ Server-only |
| `/api/quotes/parse-pdf` | POST | — | ✅ Server-only |
| `/api/quotes/request` | POST | — | ✅ Server-only |
| `/api/request/[id]/approve` | POST | — | ✅ Server-only |
| `/api/request/[id]/cancel` | POST | — | ✅ Server-only |
| `/api/request/[id]/reverse` | POST | — | ✅ Server-only |
| `/api/reviews/[id]` | DELETE | — | ✅ Server-only |
| `/api/team/[id]/members` | GET, PATCH, DELETE | — | ✅ Server-only |
| `/api/templates/[id]` | GET, DELETE | — | ✅ Server-only |
| `/api/user-inventory/[id]` | GET, PATCH, DELETE | — | ✅ Server-only |
| `/api/workspaces/[id]` | GET, PATCH, DELETE | — | ✅ Server-only |
| `/api/workspaces/[id]/invites` | GET, POST, DELETE | — | ✅ Server-only |
| `/api/workspaces/[id]/members/[memberId]` | PATCH, DELETE | — | ✅ Server-only |

## Exempt Routes (9건)

| Route | Reason | Methods |
|-------|--------|---------|
| `/api/auth/[...nextauth]` | framework_csrf_builtin | ? |
| `/api/billing/webhook` | webhook_signature | POST |
| `/api/inbound/sendgrid/[secret]` | webhook_signature | POST |
| `/api/invite/[token]` | public_token_auth | GET, POST |
| `/api/mobile/auth/refresh` | bearer_token_auth | POST |
| `/api/mobile/auth/signin` | bearer_token_auth | POST |
| `/api/vendor-requests/[token]/response` | public_token_auth | POST |
| `/api/vendor/auth/send-link` | vendor_token_auth | POST |
| `/api/vendor/quotes/[quoteId]/response` | vendor_token_auth | POST |

## Raw Fetch Gap Analysis (Unprotected Mutation Callers)

| API Route | Risk Level | Calling File |
|-----------|-----------|-------------|
| `/api/budgets` | 🟡 standard | `app/dashboard/budget/details/[id]/page.tsx` |
| `/api/budgets` | 🟡 standard | `app/dashboard/budget/page.tsx` |
| `/api/budgets` | 🟡 standard | `app/dashboard/reports/page.tsx` |
| `/api/budgets` | 🟡 standard | `lib/store/budget-store.ts` |
| `/api/inventory` | 🟡 standard | `app/dashboard/inventory/blocks/inventory-summary-block.tsx` |
| `/api/inventory` | 🟡 standard | `app/dashboard/inventory/blocks/inventory-table-block.tsx` |
| `/api/inventory` | 🟡 standard | `app/dashboard/inventory/inventory-content.tsx` |
| `/api/inventory` | 🟡 standard | `app/dashboard/inventory/inventory-main.tsx` |
| `/api/organizations` | 🟡 standard | `app/admin/safety/page.tsx` |
| `/api/organizations` | 🟡 standard | `app/dashboard/organizations/[id]/page.tsx` |
| `/api/organizations` | 🟡 standard | `app/dashboard/organizations/page.tsx` |
| `/api/organizations` | 🟡 standard | `app/dashboard/safety-spend/page.tsx` |
| `/api/organizations` | 🟡 standard | `app/dashboard/settings/enterprise/page.tsx` |
| `/api/organizations` | 🟡 standard | `app/dashboard/settings/plans/page.tsx` |
| `/api/organizations` | 🟡 standard | `app/settings/audit/page.tsx` |
| `/api/organizations` | 🟡 standard | `app/settings/billing/page.tsx` |
| `/api/organizations` | 🟡 standard | `app/settings/compliance-links/page.tsx` |
| `/api/organizations` | 🟡 standard | `app/settings/security/page.tsx` |
| `/api/organizations` | 🟡 standard | `app/settings/workspace/page.tsx` |
| `/api/organizations` | 🟡 standard | `components/inventory/BulkImportModal.tsx` |
| `/api/organizations` | 🟡 standard | `components/workspace/workspace-switcher.tsx` |
| `/api/organizations` | 🟡 standard | `hooks/use-permission.ts` |
| `/api/quotes` | 🟡 standard | `lib/api/quotes-client.ts` |
| `/api/team` | 🟡 standard | `app/admin/requests/page.tsx` |
| `/api/team` | 🟡 standard | `app/dashboard/inventory/inventory-content.tsx` |
| `/api/team` | 🟡 standard | `app/dashboard/inventory/inventory-main.tsx` |
| `/api/team` | 🟡 standard | `app/inventory/page.tsx` |
| `/api/team` | 🟡 standard | `app/quotes/[id]/page.tsx` |
| `/api/team` | 🟡 standard | `app/team/settings/page.tsx` |
| `/api/templates` | 🟡 standard | `app/templates/page.tsx` |
| `/api/user-inventory` | 🟡 standard | `app/inventory/page.tsx` |
| `/api/vendor/billing` | 🟡 standard | `app/dashboard/vendor/billing/page.tsx` |
| `/api/vendor/premium` | 🟡 standard | `app/dashboard/vendor/billing/page.tsx` |

## Coverage Score

| Metric | Value |
|--------|-------|
| Server-side coverage (middleware gate) | **269/269 (100.0%)** |
| Frontend mutation coverage (apiClient/csrfFetch) | **173/182 (95.1%)** |
| Raw fetch mutation gap | **9** routes with unprotected callers |
| Unprotected caller files | **29** files |

## Staged Rollout Recommendation

| Phase | Scope | Mode | Condition |
|-------|-------|------|-----------|
| Current | All 268 eligible | report_only | — |
| Phase 1 | 47 highRisk routes | soft_enforce | Raw fetch gap 해소 후 |
| Phase 2 | All eligible mutation | soft_enforce | Phase 1 모니터링 정상 후 |
| Phase 3 | All 269 eligible | full_enforce | E2E 검증 완료 후 |
