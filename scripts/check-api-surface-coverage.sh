#!/usr/bin/env bash
#
# LabAxis API Surface Coverage Guard (§11.60 / #api-surface-coverage-test)
#
# 회귀 class: "operating surface absence" — backend mutation endpoint 는
# 있지만 frontend caller 가 0건인 dead capability.
# §11.55 (manual_upload UI 자체가 backend 미구현) + §11.59 (admin orders UI
# 자체 부재 — endpoint 만 있고 운영자 진입점 없음) 두 트랙에서 같은 패턴
# 누적된 후 자동 catch 도구로 신설.
#
# 검사 대상:
#   - apps/web/src/app/api/**/route.ts 의 mutation method export
#     (POST / PATCH / PUT / DELETE — GET 은 SSR/server component 호출
#     가능하므로 별도 트랙에서 처리)
#
# 검사 방법:
#   - 각 mutation endpoint 의 URL 패턴을 산출 (file path → /api/...)
#   - 그 패턴이 apps/web/src 의 client-side caller (fetch / csrfFetch /
#     axios.{post|patch|put|delete}) URL 인자에 매치되는지 grep
#   - 매치 0 건이면 dead capability — violation
#
# Exempt:
#   - /api/vendor-requests/[token]/...   (vendor token — email/SDK 진입)
#   - /api/share/[token]/...             (share token — public link)
#   - /api/webhooks/...                  (외부 system → 웹훅)
#   - /api/sendgrid/...                  (sendgrid inbound webhook)
#   - /api/mobile/...                    (apps/mobile 의 axios 호출 — 별도 codebase)
#   - /api/cron/...                      (Vercel cron job)
#   - /api/health                        (uptime probe)
#   - /api/auth/...                      (NextAuth.js 자동 라우트)
#
# 신규 exempt 추가 시 반드시 이 docblock 에 이유 명시.
# Production endpoint 가 dead 라면 본 트랙은 별도 cleanup PR 로 처리하지 않고
# 노출만 — 정리는 별도 트랙 (#dead-capability-cleanup-batch-N).
#
# Usage: scripts/check-api-surface-coverage.sh
# Exit: 0 = clean (또는 exempt-justified), 1 = dead capability 발견

set -euo pipefail

VIOLATIONS=0
WEB_API_DIR="apps/web/src/app/api"
WEB_SRC_DIR="apps/web/src"

# ── Exempt prefix list (정확한 prefix-match) ──────────────────────────────
# 두 가지 종류:
#   1) External-trigger endpoints — vendor token, webhook, mobile, cron 등
#      (frontend 가 부르지 않는 게 정상)
#   2) Internal admin/CLI tools — canary, seed, ai-ops, governance 등
#      (운영 총괄이 별도 admin tool/CLI 로만 사용, 일반 dashboard surface 없음)
# 신규 추가 시 반드시 이유 주석.
EXEMPT_PREFIXES=(
  # External triggers (vendor token / webhook / mobile / cron / health / auth)
  "/api/vendor-requests/[token]"
  "/api/share/[token]"
  "/api/webhooks/"
  "/api/sendgrid/"
  "/api/inbound/"
  "/api/mobile/"
  "/api/cron/"
  "/api/health"
  "/api/auth/"
  "/api/billing/webhook"

  # Internal admin/CLI tools (§11.60 첫 분류 — Category A)
  "/api/admin/canary-"
  "/api/admin/seed"
  "/api/ai-ops/"
  "/api/ai-actions/generate/"
  "/api/analytics/"
  "/api/governance/"
  "/api/datasheet/"
  "/api/protocol/extract-pdf"
  "/api/ingestion"
  "/api/inventory/auto-reorder"
  "/api/inventory/alerts/send"
  "/api/recommendations/optimized"
  "/api/sds/[id]/signed-url"
  "/api/dashboard/layout"
  "/api/work-queue/purchase-conversion/bulk-po"
  "/api/order-queue/bulk"
  "/api/products/[id]/embedding"
  "/api/products/[id]/safety-extract"
)

echo "═══ LabAxis API Surface Coverage Guard (§11.60) ═══"
echo ""

# ── Step 1: mutation endpoint inventory ──────────────────────────────────
TEMP_ENDPOINTS=$(mktemp)
TEMP_CALLERS=$(mktemp)
trap 'rm -f "$TEMP_ENDPOINTS" "$TEMP_CALLERS"' EXIT

while IFS= read -r f; do
  # NOTE: rg 의 -E 는 encoding flag (grep 의 ERE 가 아님 — ripgrep default 가
  # 이미 ERE-like). -E 를 붙이면 "grep config error: unknown encoding" 으로
  # silent fail 하므로 절대 추가하지 않는다.
  if rg -q "^export\s+(async\s+)?function\s+(POST|PATCH|PUT|DELETE)" "$f" 2>/dev/null; then
    rel=${f#"apps/web/src/app"}
    rel=${rel%/route.ts}
    echo "$rel"
  fi
done < <(find "$WEB_API_DIR" -name "route.ts" -type f) > "$TEMP_ENDPOINTS"

ENDPOINT_COUNT=$(wc -l < "$TEMP_ENDPOINTS" | tr -d ' ')
echo "Mutation endpoints discovered: $ENDPOINT_COUNT"
echo ""

# ── Step 2: caller URL inventory ─────────────────────────────────────────
# Pattern: csrfFetch / fetch / axios.{post|patch|put|delete} 의 첫 string 인자.
# 백틱 / 더블쿼트 / 싱글쿼트 모두 지원.
# Capture URL content (between quotes) → strip quotes → output.
rg -o \
  '(csrfFetch|fetch|axios\.(post|patch|put|delete))\s*\(\s*[`"][^`"]+' \
  "$WEB_SRC_DIR" \
  -t ts \
  -g '!**/api/**' \
  2>/dev/null \
  | grep -oE '[`"][^`"]*$' \
  | sed -E 's/^.//' \
  | sort -u \
  > "$TEMP_CALLERS" || true

CALLER_COUNT=$(wc -l < "$TEMP_CALLERS" | tr -d ' ')
echo "Distinct caller URL strings: $CALLER_COUNT"
echo ""

# ── Step 3: violation check ──────────────────────────────────────────────
echo "── Dead capability scan ──"
while IFS= read -r endpoint; do
  # exempt check
  is_exempt=0
  for ex in "${EXEMPT_PREFIXES[@]}"; do
    case "$endpoint" in
      "$ex"*) is_exempt=1; break ;;
    esac
  done
  [ "$is_exempt" = "1" ] && continue

  # endpoint pattern → regex (replace [param] with [^/]+)
  pattern=$(echo "$endpoint" | sed -E 's|\[[^]]*\]|[^/]+|g')

  # caller URL 이 endpoint pattern 으로 시작하는지 (prefix match — query/fragment 허용)
  # template literal `${var}` 도 [^/]+ 와 동일 매치되도록 처리
  if grep -qE "^${pattern}([/\\?#\$]|$)" "$TEMP_CALLERS" 2>/dev/null; then
    continue
  fi

  # template literal substitution check: ${...} 를 [^/]+ 로 가정하고 재시도
  caller_pattern_check=$(sed -E 's|\$\{[^}]+\}|[^/]+|g' "$TEMP_CALLERS")
  if echo "$caller_pattern_check" | grep -qE "^${pattern}([/\\?#\$]|$)"; then
    continue
  fi

  echo "  ⛔ $endpoint"
  VIOLATIONS=$((VIOLATIONS + 1))
done < "$TEMP_ENDPOINTS"

echo ""
if [ "$VIOLATIONS" -gt 0 ]; then
  echo "══ ${VIOLATIONS} dead capability(ies) found ══"
  echo ""
  echo "Each endpoint above has a backend route handler (POST/PATCH/PUT/DELETE)"
  echo "but no client-side caller in apps/web/src (excluding api/)."
  echo ""
  echo "Resolve by either:"
  echo "  1) Wire a frontend surface that invokes the endpoint (preferred)"
  echo "  2) Delete the endpoint if it's truly orphan (cleanup track)"
  echo "  3) Add prefix to EXEMPT_PREFIXES with justification comment"
  echo ""
  echo "See ADR-002 §11.55 / §11.59 / §11.60 for context."
  echo ""

  # ── Advisory vs block mode ────────────────────────────────────────────
  # Default: advisory (exit 0) — violations 만 가시화, CI 는 통과.
  # LABAXIS_API_COVERAGE_BLOCK=1 일 때만 enforce (exit 1).
  # §11.60 첫 commit 은 advisory 로 시작 — Category B (operator-driven gap)
  # cleanup batch 트랙들이 violations 를 점진적으로 0 으로 줄인 후 block 전환.
  if [ "${LABAXIS_API_COVERAGE_BLOCK:-0}" = "1" ]; then
    echo "(LABAXIS_API_COVERAGE_BLOCK=1 — enforcing as CI block)"
    exit 1
  else
    echo "(advisory mode — set LABAXIS_API_COVERAGE_BLOCK=1 to enforce)"
    exit 0
  fi
else
  echo "✅ All mutation endpoints have at least one client caller"
  exit 0
fi
