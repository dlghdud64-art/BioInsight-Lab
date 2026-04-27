#!/usr/bin/env bash
#
# LabAxis No Inline Hex Background Regression Guard (§11.45)
#
# Dashboard 페이지(`apps/web/src/app/dashboard/**`) 에서 inline
# `style={{ backgroundColor: '#XXXXXX' }}` 같은 hex 컬러는
# LabAxis surface 토큰(`bg-sh` / `bg-pn` / `bg-el`)을 우회합니다.
# 이는 §11.43에서 발견된 "다크 테마 잔재가 라이트 chrome 위에 박혀
# 검정-on-검정 invisible body를 만든" 회귀 패턴의 진짜 원인이었습니다.
#
# 허용:
#   - className="bg-sh"        ← LabAxis page shell 토큰
#   - className="bg-pn"        ← LabAxis panel 토큰
#   - className="bg-el"        ← LabAxis elevated 토큰
#   - className="bg-white"     ← Tailwind 표준
#   - className="bg-blue-50"   ← Tailwind 표준 (특정 의미 색)
#   - style={{ backgroundColor: 'rgba(...)' }}   ← 동적 알파 (검토 후 허용)
#   - style={{ backgroundColor: 'transparent' }} ← 의도적 투명
#
# 차단:
#   - style={{ backgroundColor: '#2d2f33' }}     ← 다크 hex
#   - style={{ backgroundColor: "#FFFFFF" }}     ← 라이트 hex (토큰 우회)
#   - style={{ background: '#3b82f6' }}          ← shorthand hex
#
# Usage: scripts/check-no-inline-hex-bg.sh
# Exit code: 0 = clean, 1 = violations found
#
# Scope: apps/web/src/app/dashboard/** only.
# Charts (Recharts <Cell fill="#…">, <Pie fill="#…">) are NOT inline
# style — those use the `fill` prop and are intentionally hex-coded
# for chart palette.  This guard targets `style={{ backgroundColor: …
# `}}` and `style={{ background: …` only.

set -euo pipefail

VIOLATIONS=0
SRC_DIR="apps/web/src/app/dashboard"

echo "═══ LabAxis Inline Hex Background Guard (§11.45) ═══"
echo ""

# Pattern: style={{ background[Color]?: '#hex' }} or "..."
# We allow rgba(), transparent, var(--…), and any value that does NOT start with #.
# We grep for the literal sequence: style={{ ... background[Color]: '#
# Both single and double quotes covered.
# NOTE: rg has no `tsx` file type — `-t ts` already covers both
# `*.ts` and `*.tsx`. Passing `-t tsx` would cause rg to error
# silently (and the caller would think the result was clean).
HITS=$(rg -n -t ts \
  "style\s*=\s*\{\{[^}]*background(Color)?\s*:\s*['\"]#" \
  "$SRC_DIR" 2>/dev/null || true)

if [ -n "$HITS" ]; then
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    REL_PATH=$(echo "$line" | sed "s|^${SRC_DIR}/||" | cut -d: -f1)
    LINE_NUM=$(echo "$line" | cut -d: -f2)
    SNIPPET=$(echo "$line" | cut -d: -f3- | sed 's/^[[:space:]]*//')
    echo "  ⛔ ${REL_PATH}:${LINE_NUM}"
    echo "       ${SNIPPET}"
    VIOLATIONS=$((VIOLATIONS + 1))
  done <<< "$HITS"
fi

echo ""
if [ "$VIOLATIONS" -gt 0 ]; then
  echo "══ ${VIOLATIONS} violation(s) found ══"
  echo ""
  echo "Fix: replace inline hex with LabAxis surface token in className:"
  echo "  '#F8FAFC' (page shell)     → className=\"bg-sh\""
  echo "  '#FFFFFF' (panel / white)  → className=\"bg-pn\"  (or bg-white)"
  echo "  '#F1F5F9' (elevated)       → className=\"bg-el\""
  echo ""
  echo "See ADR-002 §11.43 / §11.45 for the original surface-token migration."
  echo ""
  exit 1
else
  echo "✅ No inline hex backgrounds detected in apps/web/src/app/dashboard/**"
  exit 0
fi
