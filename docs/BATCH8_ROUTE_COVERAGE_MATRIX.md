# CSRF Route Coverage Matrix

Security Batch 10: CSRF Shared Middleware

## Summary

| Metric | Count |
|---|---|
| Total API routes | 277 |
| Read-only (GET/HEAD) | 87 |
| CSRF eligible (state-changing) | 190 |
| Exempt (own auth mechanism) | 8 |
| High-risk (irreversible) | 30 |
| Standard protection | 152 |
| **CSRF Present (middleware)** | **182** |

Coverage: 182/190 eligible routes protected = **95.8%**

## Implementation

- **Enforcement layer**: Next.js middleware (`middleware.ts`)
- **Route registry**: `csrf-route-registry.ts` (pre-compiled regex)
- **Token strategy**: Same-site Origin/Referer + HMAC-SHA256 signed double-submit cookie
- **Rollout mode**: `LABAXIS_CSRF_MODE` env → `report_only` (default) → `soft_enforce` → `full_enforce`
- **High-risk behavior**: Blocked even in `soft_enforce` mode

## Exempt Routes (9)

| Route | Reason |
|---|---|
| `/api/auth/[...nextauth]` | framework_csrf_builtin |
| `/api/billing/webhook` | webhook_signature |
| `/api/inbound/sendgrid/[secret]` | webhook_signature |
| `/api/invite/[token]` | public_token_auth |
| `/api/vendor-requests/[token]/response` | public_token_auth |
| `/api/mobile/auth/signin` | bearer_token_auth |
| `/api/mobile/auth/refresh` | bearer_token_auth |
| `/api/vendor/auth/send-link` | vendor_token_auth |
| `/api/vendor/quotes/[quoteId]/response` | vendor_token_auth |

## Full Route Matrix

| Route | Methods | State-Changing | CSRF Present | CSRF Mode | Risk | Exempt Reason | Audit | Enforce |
|---|---|---|---|---|---|---|---|---|
| `/api/activity-logs` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/activity-logs/stats` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/admin/activity` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/admin/canary-control` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/admin/canary-preflight` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/admin/canary-promotion` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/admin/canary-watchboard` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/admin/charts` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/admin/inbound-emails` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/admin/inbound-emails/[id]/attach-to-quote` | POST | POST | middleware | required | standard | - | - | yes |
| `/api/admin/orders` | POST | POST | middleware | required | standard | - | - | - |
| `/api/admin/orders/[id]/status` | GET, PATCH | PATCH | middleware | required | high | - | ✓ Durable | yes |
| `/api/admin/products` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/admin/products/[id]` | PATCH | PATCH | middleware | required | high | - | - | - |
| `/api/admin/quotes` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/admin/quotes/[id]` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/admin/quotes/[id]/items` | PATCH | PATCH | middleware | required | standard | - | - | - |
| `/api/admin/rollout-gate` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/admin/seed` | POST | POST | middleware | required | standard | - | - | - |
| `/api/admin/shadow-report` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/admin/shadow-sampling` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/admin/stats` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/admin/users` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/ai-actions` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/ai-actions/[id]` | GET, PATCH | PATCH | middleware | required | standard | - | - | - |
| `/api/ai-actions/[id]/approve` | POST | POST | middleware | required | standard | - | - | - |
| `/api/ai-actions/generate/order-followup` | POST | POST | middleware | required | standard | - | - | - |
| `/api/ai-actions/generate/quote-draft` | POST | POST | middleware | required | standard | - | - | - |
| `/api/ai-actions/generate/reorder-suggestions` | POST | POST | middleware | required | standard | - | - | - |
| `/api/ai-actions/generate/vendor-email-draft` | POST | POST | middleware | required | standard | - | - | - |
| `/api/ai-ops/auto-verify` | POST | POST | middleware | required | standard | - | - | - |
| `/api/ai-ops/hold` | POST | POST | middleware | required | standard | - | - | - |
| `/api/ai-ops/kill-switch` | POST | POST | middleware | required | standard | - | - | - |
| `/api/ai-ops/promote` | POST | POST | middleware | required | standard | - | - | - |
| `/api/ai-ops/rollback` | POST | POST | middleware | required | standard | - | - | - |
| `/api/ai-ops/status` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/ai/bom-parse` | POST | POST | middleware | required | standard | - | - | - |
| `/api/ai/budget-anomaly` | POST | POST | middleware | required | standard | - | - | - |
| `/api/ai/compare-analysis` | POST | POST | middleware | required | standard | - | - | - |
| `/api/ai/impact-analysis` | POST | POST | middleware | required | standard | - | - | - |
| `/api/ai/quote-compare` | POST | POST | middleware | required | standard | - | - | - |
| `/api/ai/safety-check` | POST | POST | middleware | required | standard | - | - | - |
| `/api/analytics/ai-insight` | POST | POST | middleware | required | standard | - | - | - |
| `/api/analytics/dashboard` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/analytics/kpi` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/analytics/recommendation-metrics` | POST | POST | middleware | required | standard | - | - | - |
| `/api/analytics/search-history` | POST | POST | middleware | required | standard | - | - | - |
| `/api/analytics/track` | POST | POST | middleware | required | standard | - | - | - |
| `/api/analytics/user-behavior` | POST | POST | middleware | required | standard | - | - | - |
| `/api/audit-logs` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/auth/[...nextauth]` | - | - | n/a | n/a | exempt | read_only | - | - |
| `/api/billing` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/billing/checkout` | POST | POST | middleware | required | standard | - | - | - |
| `/api/billing/invoices` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/billing/payment-methods` | GET, POST, DELETE | POST, DELETE | middleware | required | high | - | - | - |
| `/api/billing/portal` | POST | POST | middleware | required | standard | - | - | - |
| `/api/billing/webhook` | POST | POST | exempt | exempt | exempt | webhook_signature | - | - |
| `/api/budget/predict` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/budget/predict/list` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/budget/report` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/budgets` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/budgets/[id]` | GET, PATCH, DELETE | PATCH, DELETE | middleware | required | high | - | - | - |
| `/api/cart` | GET, POST, DELETE | POST, DELETE | middleware | required | standard | - | - | - |
| `/api/cart/from-inventory` | POST | POST | middleware | required | standard | - | - | - |
| `/api/cart/items/[id]` | PATCH, DELETE | PATCH, DELETE | middleware | required | high | - | - | - |
| `/api/category-budgets` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/category-budgets/[id]` | PATCH, DELETE | PATCH, DELETE | middleware | required | standard | - | - | - |
| `/api/category-spending` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/compare-sessions` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/compare-sessions/[id]` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/compare-sessions/[id]/decision` | PATCH | PATCH | middleware | required | standard | - | - | - |
| `/api/compare-sessions/[id]/inquiry-draft` | GET, POST, PATCH | POST, PATCH | middleware | required | standard | - | - | - |
| `/api/compare-sessions/[id]/insight` | POST | POST | middleware | required | standard | - | - | - |
| `/api/compare-sessions/[id]/quote-draft` | POST | POST | middleware | required | standard | - | - | - |
| `/api/compliance-links` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/compliance-links/[id]` | GET, PATCH, DELETE | PATCH, DELETE | middleware | required | high | - | - | - |
| `/api/config` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/cron/inventory-check` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/cron/order-followup-check` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/dashboard/layout` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/dashboard/stats` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/data-audit-logs` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/datasheet/extract` | POST | POST | middleware | required | standard | - | - | - |
| `/api/datasheet/extract-pdf` | POST | POST | middleware | required | standard | - | - | - |
| `/api/datasheet/extract-url` | POST | POST | middleware | required | standard | - | - | - |
| `/api/exchange-rates` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/export/presets` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/favorites` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/governance/approval-baseline` | GET, POST, DELETE | POST, DELETE | middleware | required | standard | - | - | - |
| `/api/governance/event-dedupe` | POST, DELETE | POST, DELETE | middleware | required | standard | - | - | - |
| `/api/governance/outbound-history` | GET, POST, DELETE | POST, DELETE | middleware | required | standard | - | - | - |
| `/api/governance/review-queue-draft` | GET, POST, DELETE | POST, DELETE | middleware | required | standard | - | - | - |
| `/api/groupware/send` | POST | POST | middleware | required | high | - | - | - |
| `/api/inbound/sendgrid/[secret]` | POST | POST | exempt | exempt | exempt | webhook_signature | - | - |
| `/api/ingestion` | POST | POST | middleware | required | standard | - | - | - |
| `/api/inventory` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/inventory/[id]` | GET, PATCH, DELETE | PATCH, DELETE | middleware | required | high | - | - | yes |
| `/api/inventory/[id]/inspection` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/inventory/[id]/receive` | POST | POST | middleware | required | standard | - | - | - |
| `/api/inventory/[id]/restock` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/inventory/[id]/restock-request` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/inventory/[id]/use` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/inventory/alerts/send` | POST | POST | middleware | required | standard | - | - | - |
| `/api/inventory/auto-reorder` | POST | POST | middleware | required | standard | - | - | - |
| `/api/inventory/bulk` | POST | POST | middleware | required | standard | - | - | - |
| `/api/inventory/export-labels` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/inventory/import` | POST | POST | middleware | required | standard | - | - | - |
| `/api/inventory/import/commit` | POST | POST | middleware | required | high | - | - | - |
| `/api/inventory/import/preview` | POST | POST | middleware | required | standard | - | - | - |
| `/api/inventory/lookup` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/inventory/reorder-recommendations` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/inventory/scan` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/inventory/scan-label` | POST | POST | middleware | required | standard | - | - | - |
| `/api/inventory/usage` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/invite/[token]` | GET, POST | POST | exempt | exempt | exempt | public_token_auth | - | - |
| `/api/invites/accept` | POST | POST | middleware | required | high | - | ✓ Durable | yes |
| `/api/mobile/auth/refresh` | POST | POST | exempt | exempt | exempt | bearer_token_auth | - | - |
| `/api/mobile/auth/signin` | POST | POST | exempt | exempt | exempt | bearer_token_auth | - | - |
| `/api/mobile/products/search` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/notifications` | GET, POST | POST | middleware | required | high | - | - | - |
| `/api/notifications/[id]/read` | POST | POST | middleware | required | standard | - | - | - |
| `/api/notifications/drafts/[id]/approve` | POST | POST | middleware | required | standard | - | - | - |
| `/api/order-queue/bulk` | POST | POST | middleware | required | standard | - | - | - |
| `/api/orders` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/organizations` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/organizations/[id]` | GET, PATCH, DELETE | PATCH, DELETE | middleware | required | high | - | - | - |
| `/api/organizations/[id]/billing-info` | GET, PUT | PUT | middleware | required | standard | - | - | - |
| `/api/organizations/[id]/compliance-links` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/organizations/[id]/invites` | GET, POST, DELETE | POST, DELETE | middleware | required | standard | - | - | - |
| `/api/organizations/[id]/leave` | POST | POST | middleware | required | standard | - | - | yes |
| `/api/organizations/[id]/logo` | POST, DELETE | POST, DELETE | middleware | required | high | - | - | yes |
| `/api/organizations/[id]/members` | GET, PATCH, DELETE | PATCH, DELETE | middleware | required | high | - | - | yes |
| `/api/organizations/[id]/security` | GET, PATCH | PATCH | middleware | required | standard | - | - | - |
| `/api/organizations/[id]/sso` | GET, PUT | PUT | middleware | required | standard | - | - | - |
| `/api/organizations/[id]/sso/test` | POST | POST | middleware | required | standard | - | - | - |
| `/api/organizations/[id]/subscription` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/organizations/check-slug` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/po-candidates` | GET, POST, PATCH, DELETE | POST, PATCH, DELETE | middleware | required | standard | - | - | - |
| `/api/products/[id]` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/products/[id]/alternatives` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/products/[id]/embedding` | POST | POST | middleware | required | standard | - | - | - |
| `/api/products/[id]/reviews` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/products/[id]/safety` | PATCH | PATCH | middleware | required | standard | - | - | - |
| `/api/products/[id]/safety-extract` | POST | POST | middleware | required | standard | - | - | - |
| `/api/products/[id]/sds` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/products/[id]/sds/upload` | POST | POST | middleware | required | standard | - | - | - |
| `/api/products/[id]/update` | PATCH | PATCH | middleware | required | standard | - | - | - |
| `/api/products/[id]/usage` | POST | POST | middleware | required | standard | - | - | - |
| `/api/products/[id]/view` | POST | POST | middleware | required | standard | - | - | - |
| `/api/products/average-lead-time` | POST | POST | middleware | required | standard | - | - | - |
| `/api/products/brands` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/products/compare` | POST | POST | middleware | required | standard | - | - | - |
| `/api/products/compare-status` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/products/safety` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/products/search` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/protocol/bom` | POST | POST | middleware | required | standard | - | - | - |
| `/api/protocol/extract` | POST | POST | middleware | required | standard | - | - | - |
| `/api/protocol/extract-pdf` | POST | POST | middleware | required | standard | - | - | - |
| `/api/protocol/extract-pdf-text` | POST | POST | middleware | required | standard | - | - | - |
| `/api/protocol/extract-text` | POST | POST | middleware | required | standard | - | - | - |
| `/api/purchases` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/purchases/[id]/match` | POST | POST | middleware | required | standard | - | - | - |
| `/api/purchases/[id]/reclass` | POST | POST | middleware | required | high | - | ✓ Durable | yes |
| `/api/purchases/import` | POST | POST | middleware | required | standard | - | - | - |
| `/api/purchases/import-file` | POST | POST | middleware | required | standard | - | - | - |
| `/api/purchases/import/commit` | POST | POST | middleware | required | high | - | - | - |
| `/api/purchases/import/preview` | POST | POST | middleware | required | standard | - | - | - |
| `/api/purchases/summary` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/quote-items/[id]` | PUT, DELETE | PUT, DELETE | middleware | required | high | - | - | - |
| `/api/quote-items/[id]/mark-purchased` | POST | POST | middleware | required | standard | - | - | - |
| `/api/quote-lists` | POST | POST | middleware | required | standard | - | - | - |
| `/api/quote-lists/[id]` | GET, PUT | PUT | middleware | required | standard | - | - | - |
| `/api/quote-lists/[id]/export` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/quote-lists/[id]/items` | PUT | PUT | middleware | required | standard | - | - | - |
| `/api/quotes` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/quotes/[id]` | GET, PATCH, DELETE | PATCH, DELETE | middleware | required | high | - | - | - |
| `/api/quotes/[id]/detail` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/quotes/[id]/history` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/quotes/[id]/responses` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/quotes/[id]/responses/[responseId]` | GET, PATCH | PATCH | middleware | required | standard | - | - | - |
| `/api/quotes/[id]/rfq-token` | GET, POST, PATCH | POST, PATCH | middleware | required | standard | - | - | - |
| `/api/quotes/[id]/share` | GET, POST, DELETE | POST, DELETE | middleware | required | standard | - | - | - |
| `/api/quotes/[id]/status` | GET, PATCH | PATCH | middleware | required | high | - | - | yes |
| `/api/quotes/[id]/vendor-replies` | POST | POST | middleware | required | standard | - | - | - |
| `/api/quotes/[id]/vendor-requests` | GET, POST | POST | middleware | required | standard | - | - | yes |
| `/api/quotes/[id]/versions` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/quotes/cost-optimization` | POST | POST | middleware | required | standard | - | - | - |
| `/api/quotes/from-cart` | POST | POST | middleware | required | standard | - | - | - |
| `/api/quotes/generate-english` | POST | POST | middleware | required | high | - | - | - |
| `/api/quotes/my` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/quotes/optimize-combination` | POST | POST | middleware | required | standard | - | - | - |
| `/api/quotes/parse-image` | POST | POST | middleware | required | standard | - | - | - |
| `/api/quotes/parse-pdf` | POST | POST | middleware | required | standard | - | - | - |
| `/api/quotes/request` | POST | POST | middleware | required | standard | - | - | - |
| `/api/receiving/[id]/status` | PATCH | PATCH | middleware | required | standard | - | - | - |
| `/api/recent-products` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/recommendations/[id]/feedback` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/recommendations/feedback` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/recommendations/optimized` | POST | POST | middleware | required | standard | - | - | - |
| `/api/recommendations/organization` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/recommendations/personalized` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/recommendations/purchase-patterns` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/reports/purchase` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/request` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/request/[id]/approve` | POST | POST | middleware | required | high | - | ✓ Durable | yes |
| `/api/request/[id]/cancel` | POST | POST | middleware | required | high | - | ✓ Durable | yes |
| `/api/request/[id]/reject` | POST | POST | middleware | required | standard | - | - | yes |
| `/api/request/[id]/reverse` | POST | POST | middleware | required | high | - | ✓ Durable | yes |
| `/api/reviews/[id]` | DELETE | DELETE | middleware | required | high | - | - | - |
| `/api/safety-spend` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/safety-spend/unmapped` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/safety/products` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/safety/sds` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/safety/spend` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/safety/spend/export` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/safety/spend/map` | POST | POST | middleware | required | standard | - | - | - |
| `/api/safety/spend/summary` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/safety/spend/unmapped` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/sds/[id]/apply` | POST | POST | middleware | required | standard | - | - | - |
| `/api/sds/[id]/extract` | POST, DELETE | POST, DELETE | middleware | required | standard | - | - | - |
| `/api/sds/[id]/signed-url` | POST | POST | middleware | required | standard | - | - | - |
| `/api/search` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/search/intent` | POST | POST | middleware | required | standard | - | - | - |
| `/api/security/csrf-token` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/share/[token]` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/shared-links` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/shared-lists` | POST | POST | middleware | required | standard | - | - | - |
| `/api/shared-lists/[publicId]` | GET, PATCH | PATCH | middleware | required | standard | - | - | - |
| `/api/shared-lists/bulk` | DELETE | DELETE | middleware | required | standard | - | - | - |
| `/api/spending-categories` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/spending-categories/[id]` | PATCH, DELETE | PATCH, DELETE | middleware | required | standard | - | - | - |
| `/api/team` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/team/[id]/inventory` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/team/[id]/members` | GET, PATCH, DELETE | PATCH, DELETE | middleware | required | high | - | - | - |
| `/api/team/invite` | POST | POST | middleware | required | standard | - | - | - |
| `/api/team/user-role` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/templates` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/templates/[id]` | GET, DELETE | DELETE | middleware | required | high | - | - | - |
| `/api/templates/[id]/export` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/translate` | POST | POST | middleware | required | standard | - | - | - |
| `/api/user-budgets` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/user-budgets/[id]` | GET, PATCH, DELETE | PATCH, DELETE | middleware | required | standard | - | - | - |
| `/api/user-budgets/[id]/check` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/user-inventory` | GET, PATCH | PATCH | middleware | required | standard | - | - | - |
| `/api/user-inventory/[id]` | GET, PATCH, DELETE | PATCH, DELETE | middleware | required | high | - | - | - |
| `/api/validate-link` | POST | POST | middleware | required | standard | - | - | - |
| `/api/vendor-requests/[token]` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/vendor-requests/[token]/response` | POST | POST | exempt | exempt | exempt | public_token_auth | - | - |
| `/api/vendor/auth/send-link` | POST | POST | exempt | exempt | exempt | vendor_token_auth | - | - |
| `/api/vendor/billing` | POST | POST | middleware | required | standard | - | - | - |
| `/api/vendor/info` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/vendor/insights` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/vendor/premium` | POST | POST | middleware | required | standard | - | - | - |
| `/api/vendor/premium-featured` | POST | POST | middleware | required | standard | - | - | - |
| `/api/vendor/products` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/vendor/profile` | GET, PATCH | PATCH | middleware | required | standard | - | - | - |
| `/api/vendor/quotes` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/vendor/quotes/[quoteId]/response` | POST | POST | exempt | exempt | exempt | vendor_token_auth | - | - |
| `/api/vendor/requests` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/vendor/requests/[id]` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/vendor/requests/[id]/attachments` | POST | POST | middleware | required | standard | - | - | - |
| `/api/vendor/requests/[id]/respond` | POST | POST | middleware | required | standard | - | - | - |
| `/api/vendor/stats` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/vendors` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/work-queue` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/work-queue/assignment` | POST | POST | middleware | required | standard | - | - | - |
| `/api/work-queue/bottleneck-remediation` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/work-queue/cadence-governance` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/work-queue/compare-sync` | POST | POST | middleware | required | standard | - | - | - |
| `/api/work-queue/daily-review` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/work-queue/ops-execute` | POST | POST | middleware | required | standard | - | - | - |
| `/api/work-queue/ops-sync` | POST | POST | middleware | required | standard | - | - | - |
| `/api/workspaces` | GET, POST | POST | middleware | required | standard | - | - | - |
| `/api/workspaces/[id]` | GET, PATCH, DELETE | PATCH, DELETE | middleware | required | high | - | - | - |
| `/api/workspaces/[id]/invites` | GET, POST, DELETE | POST, DELETE | middleware | required | high | - | - | - |
| `/api/workspaces/[id]/members` | GET | - | n/a | n/a | n/a | read_only | - | - |
| `/api/workspaces/[id]/members/[memberId]` | PATCH, DELETE | PATCH, DELETE | middleware | required | high | - | - | - |

## 변경 이력

- **2026-04-14 — Batch 6: Durable Audit Sink (MutationAuditEvent) 연결.**
  - 6개 high-risk 라우트의 `Audit` 열을 `yes` → `✓ Durable` 로 갱신.
  - 갱신 대상: `/api/request/[id]/approve`, `/api/request/[id]/cancel`, `/api/request/[id]/reverse`, `/api/admin/orders/[id]/status`, `/api/purchases/[id]/reclass`, `/api/invites/accept`.
  - 같은 DB 트랜잭션 안에서 `MutationAuditEvent` append-only row 를 기록 (`auditEventKey` unique 로 idempotent).
  - 검증: `apps/web/src/lib/audit/__tests__/durable-mutation-audit-contract.mjs` (정적 분석, 네트워크 불필요).
- **2026-04-18 — Batch 6 + enum-drift closeout 검증.**
  - schema ↔ migrations ↔ live DB 3-way 정합 (양방향 `prisma migrate diff` empty) 확정.
  - `docs/plans/PLAN_prisma-enum-drift-and-mutation-audit.md` Phase 0 ~ Phase 2 종결.

