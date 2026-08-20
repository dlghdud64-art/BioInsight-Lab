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
# Exit: 0 = clean, 1 = native <select> 발견, 2 = 검증 불능(도구 실패·대상 부족)

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
# @@ §gate-script-silent-fail — 도구 실패를 '위반 0' 으로 통과시키지 않는다 @@
#
# rg exit code:  0 = 매치 있음   1 = 매치 0(정상)   2 = 도구/경로 오류
# 구 코드 `... 2>/dev/null || true` 는 1 과 2 를 **같은 값**으로 만들었다.
# 실측(2026-08-19): SRC_DIR 를 없는 경로로 바꿔도 `No native <select>` + exit 0 이었다.
# 게이트가 아무것도 안 보고 GREEN 을 냈다. 2>/dev/null 은 그 오류 메시지까지 지운다.

# (1) 닿았음 단언 — 스캔 대상이 실제로 있는가
#     임계는 '0 초과' 가 아니라 **실측값 근처**다. 0 초과로 두면 3,220개 중 3개만
#     읽어도 통과해 이번 결함을 그대로 재생산한다. 실측 2026-08-19 = 3,220.
SCANNED_MIN=3000
SCAN_STATUS=0
SCANNED=$(rg --files "$SRC_DIR" -t ts | wc -l) || SCAN_STATUS=$?
if [ "$SCAN_STATUS" -ne 0 ] || [ "$SCANNED" -lt "$SCANNED_MIN" ]; then
  echo "  [X] 스캔 대상 부족 — ${SCANNED}개 (기대 ${SCANNED_MIN}+, rg exit ${SCAN_STATUS})"
  echo "      검증이 대상에 닿지 못했다. 이건 통과가 아니라 실패다."
  exit 2
fi

# (2) 본 스캔 — exit 2(도구 오류)만 실패시킨다. 1(매치 0)은 정상이다.
RG_STATUS=0
RG_OUT=$(rg -n '<select\b' "$SRC_DIR" -t ts) || RG_STATUS=$?
if [ "$RG_STATUS" -gt 1 ]; then
  echo "  [X] 스캔 도구 실패 (rg exit ${RG_STATUS}) — 검증 결과가 없다"
  exit 2
fi

# (3) 주석 라인 제외 — grep 도 1(매치 0)은 정상, 2 이상은 오류다.
GREP_STATUS=0
HITS=$(printf '%s' "$RG_OUT" | grep -vE ':[[:space:]]*(//|\*)') || GREP_STATUS=$?
if [ "$GREP_STATUS" -gt 1 ]; then
  echo "  [X] 주석 필터 실패 (grep exit ${GREP_STATUS})"
  exit 2
fi

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
