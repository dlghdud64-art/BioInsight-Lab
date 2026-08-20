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
# @@ §gate-script-silent-fail — 도구 실패를 '위반 0' 으로 통과시키지 않는다 @@
#
# 실측 2026-08-19 — 이 스크립트는 **한 번도 스캔한 적이 없다.** 두 결함이 겹쳤다:
#   (1) --type tsx 는 rg 에 없는 타입이다 → 'unrecognized file type: tsx' · exit 2
#       (-t ts 가 이미 .ts 와 .tsx 를 모두 포함한다)
#   (2) Pass 2 의 (?<!csrf) lookbehind 는 rg 기본 엔진(Rust regex) 미지원 → exit 2
#   두 오류를 2>/dev/null + || true 가 삼켜 RAW_FETCH_FILES 가 비었고,
#   루프가 0회 돌아 항상 'No raw fetch mutation regressions detected · exit 0' 이었다.

# (1) 닿았음 단언 — 제외 glob 적용 후 스캔 대상 (실측 2026-08-19: 2,184 파일)
#     임계는 '0 초과' 가 아니라 실측값 근처다.
SCANNED_MIN=2000
SCAN_STATUS=0
SCANNED=$(rg --files --type ts $EXCLUDE_ARGS "$SRC_DIR" | wc -l) || SCAN_STATUS=$?
if [ "$SCAN_STATUS" -ne 0 ] || [ "$SCANNED" -lt "$SCANNED_MIN" ]; then
  echo "  [X] 스캔 대상 부족 — ${SCANNED}개 (기대 ${SCANNED_MIN}+, rg exit ${SCAN_STATUS})"
  echo "      검증이 대상에 닿지 못했다. 이건 통과가 아니라 실패다."
  exit 2
fi

# (2) Pass 1 — raw fetch("/api/…") 를 가진 파일 목록. exit 2 만 실패시킨다.
RG1_STATUS=0
RAW_ALL=$(rg -l 'fetch\s*\(\s*[\"\x27]/api/' \
  --type ts $EXCLUDE_ARGS "$SRC_DIR") || RG1_STATUS=$?
if [ "$RG1_STATUS" -gt 1 ]; then
  echo "  [X] Pass 1 스캔 실패 (rg exit ${RG1_STATUS})"
  exit 2
fi
GREP1_STATUS=0
RAW_FETCH_FILES=$(printf '%s' "$RAW_ALL" | grep -v 'api-client') || GREP1_STATUS=$?
if [ "$GREP1_STATUS" -gt 1 ]; then
  echo "  [X] Pass 1 필터 실패 (grep exit ${GREP1_STATUS})"
  exit 2
fi

# Pass 2: For each file, check if any raw fetch has a mutation method
for file in $RAW_FETCH_FILES; do
  # Find line numbers with raw fetch("/api/...")
  # 🛑 -P (PCRE2) 필수 — (?<!csrf) lookbehind 는 rg 기본 엔진에서 parse error 다.
  RG2_STATUS=0
  FETCH_LINES=$(rg -P -n '(?<!csrf)fetch\s*\(\s*[\"\x27]/api/' "$file") || RG2_STATUS=$?
  if [ "$RG2_STATUS" -gt 1 ]; then
    echo "  [X] Pass 2 스캔 실패 (rg exit ${RG2_STATUS}) — ${file}"
    exit 2
  fi

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
