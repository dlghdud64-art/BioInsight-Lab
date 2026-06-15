# BASELINE — suite red 스냅샷 (2026-06-15)

> **목적:** `src/__tests__/dashboard` + `src/__tests__/regression` 전체 실행 시 현재 fail 집합을
> 고정. §main-dashboard-redesign P3~P6 "무회귀" 게이트를 **"baseline 대비 신규 fail file 0"**
> 으로 재정의(전수 수선은 별 트랙 §suite-red-cleanup). subset GREEN 이 아닌 baseline-delta 로
> 노이즈 속 신규 회귀를 식별한다.
>
> **측정:** `npx vitest run src/__tests__/dashboard src/__tests__/regression` (P2 `93b2cc48` 직후)
> **결과:** 91 file fail / 286 test fail / 3844 pass (총 4143, skip 13).
> **§main-dashboard-redesign 인과:** 0 (P1/P2 신규 파일 고립 — page.tsx 무수정, 기존 fail 이 신규 파일 import 0).

---

## P3+ 게이트 정의
- P3~P6 각 phase 후 동일 suite 실행 → fail file 목록이 **아래 91 의 subset** 이어야 GREEN.
- 91 외 신규 fail file = §main-dashboard-redesign 회귀 → STOP·수정.
- baseline 91 자체 수선 = 별 트랙 §suite-red-cleanup (호영님 승인 후 일괄).

---

## 분류

### A. 이번 세션 §log-consolidation 귀속 의심 (3) — redirect-only 화로 구 surface 검사 stale
- `src/__tests__/regression/activity-logs-korean-299.test.ts`
- `src/__tests__/regression/activity-logs-mobile-311a.test.ts`
- `src/__tests__/regression/audit-page-cleanup-300.test.ts`
> §log-consolidation 이 `activity-logs/page.tsx` 를 redirect-only 로 축소(통합 host = audit page) →
> 구 activity-logs surface 를 readFileSync/검사하던 sentinel stale. **진화 또는 retire 대상**(§suite-red-cleanup).

### B. 타 트랙 누적 UI/regression 기술부채 (88) — main-dashboard 무관
sourcing/quotes/inventory/mobile/touch-target/amber-sweep/traffic-light/korean/eyebrow/smart-receiving/
receiving/scan/ocr/coa/comparison/header 계열. 이전 세션부터 누적, 각 트랙이 관련 sentinel + build 만
검증하고 push(전체 suite 미실행)하며 stale 누적.

---

## 전체 91 fail file 목록 (P3 게이트 기준선)

### dashboard/ (45)
comparison-human-gate · dashboard-fab-collision-fix-271 · dashboard-sidebar-action-touch-target-266b ·
inventory-mobile-badge-contrast-273d · inventory-primary-tabs-touch-target-266d · mobile-brief-inline-257 ·
onboarding-dismiss-252d1 · operational-brief-fab-bottom-273e · operational-brief-fab-sweep-258sweep ·
page-send-to-supplier-visible-274b · quote-kpi-mobile-summary-bar-272c ·
quotes/operational-brief-emoji-caller-wiring · quotes/quote-batch-select-text-link-264h2 ·
quotes/quote-batch-selection-p1 · quotes/quote-bottom-sheet-dual-overlap-264i ·
quotes/quote-card-compact-collapse-264g · quotes/quote-card-keyboard-nav ·
quotes/quote-centerworkwindow-demote-363b · quotes/quote-dispatch-fixed-flow-264h5 ·
quotes/quote-dispatch-mobile-banner-272b · quotes/quote-dispatch-visible-gate-274 ·
quotes/quote-gate-blocks-removed-279 · quotes/quote-header-actions-responsive ·
quotes/quote-kpi-mobile-summary-timeout-272c-2 · quotes/quote-mode-chips-nowrap-264h ·
quotes/quote-mode-chips-touch-target-264h4 · quotes/quote-mode-reset-button-touch-target-264h5 ·
quotes/quote-table-readability · quotes/quote-table-v2-phase-a · quotes/quotes-filter-toolbar-compact-259c ·
quotes/quotes-kpi-mobile-scroll-259a · quotes/quotes-view-toggle-merge-259c2 ·
sourcing-action-dock-divider-268c · sourcing-autocomplete-258c · sourcing-autocomplete-desktop-258c2 ·
sourcing-filter-mobile-unified-263b · sourcing-hamburger-menu-254b · sourcing-header-mobile-spacer-263a ·
sourcing-mobile-inline-filter-hidden-265a · sourcing-search-toolbar-258b · sourcing-search-toolbar-258d ·
sourcing-vendor-facets-258d2 · system-insight-compact-252d3 · vendor-dispatch-workbench-aria-label-274 ·
verification-summary-mobile-hidden-275

### regression/ (46)
activity-logs-korean-299 · activity-logs-mobile-311a · audit-page-cleanup-300 · badge-header-amber-removed-302d6a1 ·
budget-category-amber-removed-302d6a2 · coa-doctype-348b1-4 · coa-inventory-surface ·
comparison-modal-error-message-305-2 · dashboard-cleanup-stale-files · dashboard-eyebrow-live-removed-308b ·
dashboard-pages-amber-removed-302d6d1 · data-table-dropdown-removal-303hotfix-f · enterprise-info-traffic-light-303c ·
header-help-profile-plain-button-295 · header-smart-receiving-308a-v2 · inventory-badge-traffic-light-302d1 ·
inventory-content-action-menu-297d · inventory-content-traffic-light-302d3 · inventory-context-panel-restructure-320 ·
inventory-header-brief-migration-317 · inventory-issue-alert-action-menu-297e · inventory-kpi-traffic-light-283a ·
landing-search-triage-cleanup-324 · lot-scan-source-badge-340 · mobile-nav-359-2-batch ·
new-purchase-order-prefill-310c · ocr-confidence-gate-378-native · operational-briefing-eyebrow-korean-279c ·
operational-comments-korean-279c-cont · orders-draft-api-310d · pilot-internal-key-removed-366g3 ·
pricing-plan-credit-removal-303 · quote-price-consistency-338 · quotes-dispatch-amber-removed-302d6b2 ·
quotes-quote-panel-plain-298d · reagent-label-scan-mobile-319 · receiving-draft-model-348a3 ·
receiving-packsize-split-326 · receiving-packsize-split-mobile-326b · reorder-recommendation-api-310b ·
reorder-review-sheet-310 · scan-hub-ia-379-mobile · smart-receiving-entry-308a ·
smart-receiving-naming-split-315b · smart-receiving-scanner-modal-309d · vendor-dispatch-pdf-wiring-314b2

---

## §suite-red-cleanup 별 트랙 (호영님 승인 후)
1. A 카테고리(activity-logs 3) — §log-consolidation redirect 설계 정합으로 진화/retire (즉시 quick-win).
2. ENOENT-class — 리타이어/이동 경로 참조 sentinel 삭제·repoint.
3. B 88 — assertion-level, 각 트랙 코드 현황 대조 후 진화 (대량, 우선순위 낮음).
