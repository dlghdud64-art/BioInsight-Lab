#!/usr/bin/env bash
#
# LabAxis Native <select> Ban Guard (§11.75 / #native-select-ban-guard)
#
# §11.71 에서 native `<select>` 7곳 → shadcn `<Select>` (Radix UI) 통일 후
# 신규 회귀 차단. shadcn Select 는 §11.73 hover/animation 강화 후 LabAxis
# 표준. native `<select>` 는 (a) hover/animation 약함 (b) 한국어/dark theme
# 잔재 invisible 위험 (c) Radix accessibility 미지원. 그래서 신규 추가 차단.
#
# 차단:
#   <select> ... </select>  (HTML element, JSX)
#
# 허용:
#   <Select>...</Select>     (shadcn Select component, capitalized)
#   - 본 스크립트는 lowercase `select` 만 잡음 (regex \b<select\b)
#
# Usage: scripts/check-no-native-select.sh
# Exit: 0 = clean (0 violations), 1 = native <select> 발견

set -euo pipefail

VIOLATIONS=0
SRC_DIR="apps/web/src"

echo "═══ LabAxis Native <select> Ban Guard (§11.75) ═══"
echo ""

# rg pattern: lowercase <select 단어 경계 (capitalized <Select component 와 구분).
# `<select` 다음에 `>` 또는 공백 또는 attribute 가 올 수 있음.
# Comment line filter: rg `-n` (no `-o`) 로 전체 line content 출력.
# `path:line:content` 형식에서 content 가 `//` / ` *` 로 시작하면 주석 — 제외.
# `-o` 사용 시 매치 substring 만 출력되어 주석 filter 동작 안 함 (§11.75 v1 bug).
HITS=$(rg -n '<select\b' "$SRC_DIR" -t ts 2>/dev/null \
  | grep -vE ':[[:space:]]*(//|\*)' \
  || true)

if [ -n "$HITS" ]; then
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    REL_PATH=$(echo "$line" | cut -d: -f1 | sed "s|^${SRC_DIR}/||")
    LINE_NUM=$(echo "$line" | cut -d: -f2)
    SNIPPET=$(echo "$line" | cut -d: -f3- | sed 's/^[[:space:]]*//')
    echo "  ⛔ ${REL_PATH}:${LINE_NUM}"
    echo "       ${SNIPPET}"
    VIOLATIONS=$((VIOLATIONS + 1))
  done <<< "$HITS"
fi

echo ""
if [ "$VIOLATIONS" -gt 0 ]; then
  echo "══ ${VIOLATIONS} native <select> usage(s) found ══"
  echo ""
  echo "Migration: native <select> → shadcn Select"
  echo ""
  echo "  Before:"
  echo "    <select value={x} onChange={(e) => setX(e.target.value)}>"
  echo "      <option value=\"a\">A</option>"
  echo "    </select>"
  echo ""
  echo "  After:"
  echo "    <Select value={x} onValueChange={setX}>"
  echo "      <SelectTrigger><SelectValue /></SelectTrigger>"
  echo "      <SelectContent>"
  echo "        <SelectItem value=\"a\">A</SelectItem>"
  echo "      </SelectContent>"
  echo "    </Select>"
  echo ""
  echo "  Empty/placeholder option (value=\"\"): use sentinel (e.g. \"none\")"
  echo "  + caller side conversion."
  echo ""
  echo "See ADR-002 §11.71 (#native-select-to-shadcn-migration) /"
  echo "         §11.73 (#shadcn-select-hover-animation-strengthen)."
  echo ""
  exit 1
else
  echo "✅ No native <select> usage detected in ${SRC_DIR}/**"
  exit 0
fi
