#!/usr/bin/env bash
#
# LabAxis Frontend Page Entry Coverage Guard
# (§11.91 / #frontend-page-entry-coverage-test)
#
# 회귀 class: §11.83 #purchase-orders-sidebar-entry-add 에서 surface 된
# "alive page surface vs entry surface" mismatch — `/dashboard/purchase-orders`
# 가 643 lines alive surface 였으나 desktop sidebar 에 진입점 없고 모바일
# bottom-nav 에만 있던 mobile/desktop entry drift. backend dead-capability 의
# inverse — frontend page 는 alive 인데 메뉴 진입점 부재.
#
# §11.55 dead-end 패턴 9번째 회귀로 누적된 후 자동 catch grep guard 신설.
#
# 검사 대상:
#   - apps/web/src/app/dashboard/**/page.tsx — 단 top-level only
#     (depth 1 — `/dashboard/X` 만, sub-route `/dashboard/X/Y` 는 detail
#     page 이므로 제외)
#
# 검사 방법:
#   - 각 top-level dashboard route 의 URL 산출 (file path → /dashboard/X)
#   - 그 URL 이 menu source 들에 href 로 존재하는지 grep
#     · apps/web/src/app/_components/dashboard-sidebar.tsx
#     · apps/web/src/components/layout/bottom-nav.tsx
#     · apps/web/src/components/layout/bottom-nav-more-sheet.tsx
#   - 매치 0 건이면 entry coverage 부재 — violation
#
# Exempt:
#   - dynamic segment 포함 ([param]) 루트
#   - 시스템 redirect-only stub (e.g. /dashboard/orders 는 28-line
#     redirect, §11.59 finding)
#
# Advisory mode (default): violations 만 노출, exit 0.
# LABAXIS_PAGE_ENTRY_COVERAGE_BLOCK=1 시 enforce (exit 1).
#
# Usage: scripts/check-frontend-page-entry-coverage.sh

set -euo pipefail

VIOLATIONS=0
WEB_SRC_DIR="apps/web/src"
DASH_DIR="${WEB_SRC_DIR}/app/dashboard"

# Menu source files
MENU_SOURCES=(
  "${WEB_SRC_DIR}/app/_components/dashboard-sidebar.tsx"
  "${WEB_SRC_DIR}/components/layout/bottom-nav.tsx"
  "${WEB_SRC_DIR}/components/layout/bottom-nav-more-sheet.tsx"
)

# Exempt URL list — page exists but intentionally without menu entry.
# 신규 추가 시 반드시 이유 주석.
EXEMPT_URLS=(
  # /dashboard 자체는 menu 의 root (대시보드 항목 — 별도 처리)
  "/dashboard"
  # /dashboard/orders 는 §11.59 redirect-only stub (다음 release 디렉토리 삭제 예정)
  "/dashboard/orders"
)

echo "═══ LabAxis Frontend Page Entry Coverage Guard (§11.91) ═══"
echo ""

# ── Step 1: top-level dashboard pages discovery ─────────────────────────
TEMP_PAGES=$(mktemp)
trap 'rm -f "$TEMP_PAGES"' EXIT

# `find` 로 dashboard/{X}/page.tsx 만 (depth 2 — dashboard/X/page.tsx).
# dashboard/X/Y/page.tsx (depth 3+) 는 sub-route 이므로 제외.
# dashboard/page.tsx (depth 1) 는 root 페이지 — exempt 처리.
while IFS= read -r f; do
  # Skip dynamic segment routes ([param])
  if echo "$f" | grep -q '\['; then
    continue
  fi
  # Extract URL from path
  rel="${f#${WEB_SRC_DIR}/app}"
  url="${rel%/page.tsx}"
  # Only top-level (single segment under /dashboard/)
  segment_count=$(echo "${url#/dashboard/}" | tr '/' '\n' | wc -l | tr -d ' ')
  if [ "$segment_count" != "1" ]; then
    continue
  fi
  echo "$url"
done < <(find "$DASH_DIR" -mindepth 2 -maxdepth 2 -name "page.tsx" -type f) \
  | sort -u > "$TEMP_PAGES"

PAGE_COUNT=$(wc -l < "$TEMP_PAGES" | tr -d ' ')
echo "Top-level dashboard pages discovered: $PAGE_COUNT"
echo ""

# ── Step 2: menu hrefs inventory ─────────────────────────────────────────
# Pattern: `href: "/dashboard/X"` 또는 `href: '/dashboard/X'` 또는
#          `href: "\`/dashboard/X..."` (template literal)
# 모든 menu source 파일에서 collect.

TEMP_MENU=$(mktemp)
trap 'rm -f "$TEMP_PAGES" "$TEMP_MENU"' EXIT

for src in "${MENU_SOURCES[@]}"; do
  if [ -f "$src" ]; then
    # href: "/dashboard/..." 또는 'href: '/dashboard/...' 추출
    # path prefix `/dashboard/` 까지 매치 + 다음 segment 만 capture
    grep -oE 'href:\s*[`"\x27]/dashboard/[^"\x27`?#]*' "$src" 2>/dev/null \
      | sed -E 's|^href:[[:space:]]*[`"\x27]||' \
      | sed -E 's|/$||' \
      | awk -F'/' '{ if (NF >= 3) { print "/" $2 "/" $3 } else { print $0 } }' \
      || true
  fi
done | sort -u > "$TEMP_MENU"

MENU_COUNT=$(wc -l < "$TEMP_MENU" | tr -d ' ')
echo "Distinct top-level menu hrefs: $MENU_COUNT"
echo ""

# ── Step 3: violation check ──────────────────────────────────────────────
echo "── Page entry coverage scan ──"
while IFS= read -r url; do
  # exempt check
  is_exempt=0
  for ex in "${EXEMPT_URLS[@]}"; do
    if [ "$url" = "$ex" ]; then
      is_exempt=1
      break
    fi
  done
  [ "$is_exempt" = "1" ] && continue

  # menu href match check
  if grep -qF "$url" "$TEMP_MENU"; then
    continue
  fi

  echo "  ⛔ $url"
  VIOLATIONS=$((VIOLATIONS + 1))
done < "$TEMP_PAGES"

echo ""
if [ "$VIOLATIONS" -gt 0 ]; then
  echo "══ ${VIOLATIONS} page(s) without menu entry ══"
  echo ""
  echo "Each page above is alive (page.tsx exists) but no menu source"
  echo "(sidebar / bottom-nav / bottom-nav-more-sheet) has it as href."
  echo ""
  echo "Resolve by either:"
  echo "  1) Add href entry to dashboard-sidebar.tsx or bottom-nav.tsx"
  echo "     (preferred — operator entry surface 부여)"
  echo "  2) Delete page.tsx if truly orphan"
  echo "  3) Add to EXEMPT_URLS with justification comment"
  echo ""
  echo "See ADR-002 §11.83 (#purchase-orders-sidebar-entry-add) /"
  echo "         §11.91 (#frontend-page-entry-coverage-test)."
  echo ""

  # Advisory vs block
  if [ "${LABAXIS_PAGE_ENTRY_COVERAGE_BLOCK:-0}" = "1" ]; then
    echo "(LABAXIS_PAGE_ENTRY_COVERAGE_BLOCK=1 — enforcing as CI block)"
    exit 1
  else
    echo "(advisory mode — set LABAXIS_PAGE_ENTRY_COVERAGE_BLOCK=1 to enforce)"
    exit 0
  fi
else
  echo "✅ All top-level dashboard pages have menu entry"
  exit 0
fi
