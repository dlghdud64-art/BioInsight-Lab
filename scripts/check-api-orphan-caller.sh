#!/usr/bin/env bash
#
# LabAxis API Orphan Caller Guard (§11.103 / #api-orphan-caller-test)
#
# §11.60 #api-surface-coverage-test 의 inverse 패턴.
# §11.60 = backend mutation endpoint 중 frontend caller 0건 (dead capability)
# §11.103 = frontend caller URL 중 backend route.ts 0건 (silent 404 회귀)
#
# 차단 대상:
#   apps/web/src/ 안의 csrfFetch / fetch / axios 호출 URL 이 `/api/...` 인데
#   apps/web/src/app/api/ 의 어떤 route.ts 와도 매치 안 되는 경우.
#
# 검사 방법:
#   1) caller URL inventory — §11.60 와 동일 grep pattern (csrfFetch / fetch /
#      axios.{post|patch|put|delete|get})
#   2) endpoint inventory — apps/web/src/app/api/**/route.ts (모든 method,
#      §11.60 와 달리 GET 도 포함)
#   3) 각 caller URL 이 endpoint pattern (regex) 과 매치되는지 확인
#   4) 매치 0 건이면 orphan caller — silent 404 회귀
#
# Exempt:
#   - 외부 URL (https://, http://)
#   - placeholder URL ('${...}', '{...}')
#   - api/auth/* (NextAuth catch-all)
#
# Advisory mode (default): violations 만 노출, exit 0.
# LABAXIS_API_ORPHAN_CALLER_BLOCK=1 시 enforce (exit 1).

set -euo pipefail

VIOLATIONS=0
WEB_API_DIR="apps/web/src/app/api"
WEB_SRC_DIR="apps/web/src"

# Exempt prefix list — 검사에서 제외.
# 신규 추가 시 반드시 이유 주석.
EXEMPT_PREFIXES=(
  # NextAuth catch-all — /api/auth/[...nextauth]
  "/api/auth/"
)

echo "═══ LabAxis API Orphan Caller Guard (§11.103) ═══"
echo ""

TEMP_CALLERS=$(mktemp)
TEMP_ENDPOINTS=$(mktemp)
TEMP_ENDPOINT_REGEXES=$(mktemp)
trap 'rm -f "$TEMP_CALLERS" "$TEMP_ENDPOINTS" "$TEMP_ENDPOINT_REGEXES"' EXIT

# ── Step 1: caller URL inventory (§11.60 패턴 재사용) ─────────────────────
# `-U` (multiline) — caller 가 줄바꿈으로 split 된 형태 지원.
# `!**/app/api/**` — route handler 자체 exclude (caller 만 scan).
rg -oU \
  '(csrfFetch|fetch|axios\.(post|patch|put|delete|get))\s*\(\s*[`"][^`"]+' \
  "$WEB_SRC_DIR" \
  -t ts \
  -g '!**/app/api/**' \
  2>/dev/null \
  | grep -oE '[`"][^`"]*$' \
  | sed -E 's/^.//' \
  | grep -E '^/api/' \
  | sort -u \
  > "$TEMP_CALLERS" || true

CALLER_COUNT=$(wc -l < "$TEMP_CALLERS" | tr -d ' ')
echo "Distinct /api/ caller URLs: $CALLER_COUNT"
echo ""

# ── Step 2: endpoint inventory (모든 method 포함) ────────────────────────
# §11.60 와 달리 GET 도 포함 — caller 가 GET 요청도 검사.
while IFS= read -r f; do
  rel=${f#"apps/web/src/app"}
  rel=${rel%/route.ts}
  echo "$rel"
done < <(find "$WEB_API_DIR" -name "route.ts" -type f) | sort -u > "$TEMP_ENDPOINTS"

# Convert each endpoint pattern to anchored regex (replace [param] with [^/]+)
while IFS= read -r endpoint; do
  pattern=$(echo "$endpoint" | sed -E 's|\[\.\.\.[^]]*\]|.+|g; s|\[[^]]*\]|[^/]+|g')
  echo "^${pattern}([/?#]|$)"
done < "$TEMP_ENDPOINTS" > "$TEMP_ENDPOINT_REGEXES"

ENDPOINT_COUNT=$(wc -l < "$TEMP_ENDPOINTS" | tr -d ' ')
echo "Distinct backend endpoints (all methods): $ENDPOINT_COUNT"
echo ""

# ── Step 3: orphan caller check ─────────────────────────────────────────
# Strategy:
#   - Strip query string from caller (?... or #... 이후 제거)
#   - Substitute caller ${var} with concrete placeholder "X" (path segment)
#   - Match against endpoint regex (where [id] → [^/]+)
#   - 양쪽 변수 모두 placeholder 로 normalize → regex-on-regex 충돌 회피
echo "── Orphan caller scan ──"
while IFS= read -r caller_url; do
  # exempt check
  is_exempt=0
  for ex in "${EXEMPT_PREFIXES[@]}"; do
    case "$caller_url" in
      "$ex"*) is_exempt=1; break ;;
    esac
  done
  [ "$is_exempt" = "1" ] && continue

  # 1) query string / fragment 제거 (caller 의 path 만 추출)
  caller_path="${caller_url%%[?#]*}"
  # 2) Two interpretation candidates for ${var}:
  #    A) path segment ('X' placeholder) — `/api/x/${id}` 같은 경우
  #    B) query string suffix (strip ${var} + everything after) —
  #       `/api/x${params}` 에서 params 가 ?...... 일 때
  caller_path_A=$(echo "$caller_path" | sed -E 's|\$\{[^}]+\}|X|g')
  caller_path_B=$(echo "$caller_path" | sed -E 's|\$\{[^}]+\}.*||')

  # Check if either interpretation matches any endpoint regex
  matched=0
  while IFS= read -r endpoint_regex; do
    if echo "$caller_path_A" | grep -qE "$endpoint_regex"; then
      matched=1
      break
    fi
    if [ -n "$caller_path_B" ] && [ "$caller_path_B" != "$caller_path_A" ]; then
      if echo "$caller_path_B" | grep -qE "$endpoint_regex"; then
        matched=1
        break
      fi
    fi
  done < "$TEMP_ENDPOINT_REGEXES"

  if [ "$matched" = "0" ]; then
    echo "  ⛔ $caller_url"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done < "$TEMP_CALLERS"

echo ""
if [ "$VIOLATIONS" -gt 0 ]; then
  echo "══ ${VIOLATIONS} orphan caller(s) found ══"
  echo ""
  echo "Each caller URL above does NOT match any backend route.ts pattern."
  echo "These produce silent 404 errors at runtime — fix by either:"
  echo "  1) Update caller URL to match existing endpoint"
  echo "  2) Add backend route.ts (preferred — wire actual capability)"
  echo "  3) Delete dead caller code"
  echo "  4) Add prefix to EXEMPT_PREFIXES with justification"
  echo ""
  echo "See ADR-002 §11.60 (#api-surface-coverage-test inverse) /"
  echo "         §11.103 (#api-orphan-caller-test)."
  echo ""

  if [ "${LABAXIS_API_ORPHAN_CALLER_BLOCK:-0}" = "1" ]; then
    echo "(LABAXIS_API_ORPHAN_CALLER_BLOCK=1 — enforcing as CI block)"
    exit 1
  else
    echo "(advisory mode — set LABAXIS_API_ORPHAN_CALLER_BLOCK=1 to enforce)"
    exit 0
  fi
else
  echo "✅ All caller URLs match existing endpoints"
  exit 0
fi
