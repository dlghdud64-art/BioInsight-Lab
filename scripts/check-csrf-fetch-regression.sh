#!/usr/bin/env bash
#
# CSRF Fetch Regression Guard
#
# Client-side 코드에서 raw fetch()로 mutation API를 호출하면 실패합니다.
# 모든 POST/PUT/PATCH/DELETE → /api/* 호출은 csrfFetch()를 사용해야 합니다.
#
# 허용:
#   - csrfFetch("/api/...", { method: "POST" })
#   - api.post("/api/...")
#   - apiClient("/api/...", { method: "POST" })
#   - fetch("/api/...", { method: "GET" })  ← safe method
#   - fetch("/api/...) without method       ← GET (default)
#   - server-side: app/api/*, lib/ai/*, lib/email.ts
#
# 차단:
#   - fetch("/api/...", { method: "POST" })   ← csrfFetch 사용 필요
#   - fetch("/api/...", { method: "PUT" })
#   - fetch("/api/...", { method: "PATCH" })
#   - fetch("/api/...", { method: "DELETE" })
#
# Usage: scripts/check-csrf-fetch-regression.sh
# Exit code: 0 = clean, 1 = violations found

set -euo pipefail

VIOLATIONS=0
SRC_DIR="apps/web/src"

# Directories exempt from this check (server-side code)
EXCLUDE_DIRS=(
  "app/api"
  "lib/ai"
  "lib/ai-pipeline"
  "lib/email.ts"
  "lib/security/__tests__"
)

# Build grep exclude pattern
EXCLUDE_ARGS=""
for dir in "${EXCLUDE_DIRS[@]}"; do
  EXCLUDE_ARGS="$EXCLUDE_ARGS --glob=!${SRC_DIR}/${dir}/**"
done

# Find raw fetch() with mutation methods to /api/* endpoints
# Pattern: fetch("/api/  followed within ~300 chars by method: "POST/PUT/PATCH/DELETE"
# We use a two-pass approach:

echo "═══ CSRF Fetch Regression Check ═══"
echo ""

# Pass 1: Find all files with raw fetch("/api/...") calls (not csrfFetch)
RAW_FETCH_FILES=$(rg -l 'fetch\s*\(\s*["\x27]/api/' \
  --type ts --type tsx $EXCLUDE_ARGS "$SRC_DIR" 2>/dev/null \
  | grep -v 'api-client' || true)

# Pass 2: For each file, check if any raw fetch has a mutation method
for file in $RAW_FETCH_FILES; do
  # Find line numbers with raw fetch("/api/...")
  FETCH_LINES=$(rg -n '(?<!csrf)fetch\s*\(\s*["\x27]/api/' "$file" 2>/dev/null || true)

  while IFS= read -r line; do
    [ -z "$line" ] && continue
    LINE_NUM=$(echo "$line" | cut -d: -f1)

    # Read surrounding context (next 10 lines) to check for mutation method
    CONTEXT=$(sed -n "${LINE_NUM},$((LINE_NUM + 10))p" "$file")

    if echo "$CONTEXT" | grep -qE 'method:\s*["\x27](POST|PUT|PATCH|DELETE)["\x27]'; then
      REL_PATH=$(echo "$file" | sed "s|^${SRC_DIR}/||")
      echo "  ⛔ ${REL_PATH}:${LINE_NUM} — raw fetch() with mutation method → use csrfFetch()"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  done <<< "$FETCH_LINES"
done

echo ""
if [ "$VIOLATIONS" -gt 0 ]; then
  echo "══ ${VIOLATIONS} violation(s) found ══"
  echo ""
  echo "Fix: replace fetch(...) with csrfFetch(...) from @/lib/api-client"
  echo "     import { csrfFetch } from '@/lib/api-client';"
  echo ""
  exit 1
else
  echo "✅ No raw fetch mutation regressions detected"
  exit 0
fi
