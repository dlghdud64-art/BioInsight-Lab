#!/usr/bin/env bash
#
# LabAxis Tailwind Dark Class Ban Guard
# (§11.105 / #labaxis-no-tailwind-dark-class-sweep)
#
# §11.45 #labaxis-no-inline-hex-bg 가 inline hex (`style={{ backgroundColor:
# '#1E2738' }}`) 같은 다크 hex 회귀를 catch 하는 동시에, §11.54 발견된
# Tailwind class 형태의 다크 잔재 (`bg-pg`, `bg-amber-950/10`, `border-slate-700`
# 등) 는 catch 못 하던 inverse 회귀 class. 같은 회귀 (라이트 surface 위에
# 다크 token 잔재 → invisible / 톤 충돌) 를 다른 표현 형태로 발생.
#
# Ban list (회귀 위험 큰 패턴만 — false positive 적게):
#   - `bg-pg` (LabAxis legacy `--app-panel-2` token, deprecated. 새 surface
#     는 `bg-sh / bg-pn / bg-el` 사용)
#   - `bg-(amber|emerald|rose|indigo|purple|blue|cyan|teal|pink|fuchsia|violet)-950`
#     (검정에 가까운 채도 — invisible-text 위험)
#   - `text-{color}-300|400` 의 다크 모드 잔재는 false positive 많아 미포함.
#     (light surface 에서 일부 의도된 muted text 도 동일 패턴)
#
# 검사 영역: apps/web/src/app/dashboard/** + apps/web/src/components/dashboard/**
#
# Advisory mode 기본 (`LABAXIS_TAILWIND_DARK_BLOCK=1` 시 enforce).
# sweep 진행 후 violations 0 도달 시 block 전환.

set -euo pipefail

VIOLATIONS=0
DASH_DIR="apps/web/src/app/dashboard"
DASH_COMP_DIR="apps/web/src/components/dashboard"

echo "═══ LabAxis Tailwind Dark Class Ban Guard (§11.105) ═══"
echo ""

# Pattern A: bg-pg (LabAxis legacy dark token)
# `\b` boundary 로 `bg-pgXXX` 같은 변형 매치 회피
HITS_A=$(rg -n '\bbg-pg\b' "$DASH_DIR" "$DASH_COMP_DIR" -t ts 2>/dev/null \
  | grep -vE ':[[:space:]]*(//|\*)' \
  || true)

# Pattern B: bg-{color}-950 (검정에 가까운 채도)
HITS_B=$(rg -n '\bbg-(amber|emerald|rose|indigo|purple|blue|cyan|teal|pink|fuchsia|violet)-950' "$DASH_DIR" "$DASH_COMP_DIR" -t ts 2>/dev/null \
  | grep -vE ':[[:space:]]*(//|\*)' \
  || true)

if [ -n "$HITS_A" ]; then
  echo "── Pattern A: bg-pg (LabAxis legacy dark token) ──"
  COUNT_A=$(echo "$HITS_A" | wc -l | tr -d ' ')
  echo "  ${COUNT_A} occurrences (showing first 5):"
  echo "$HITS_A" | head -5 | sed 's/^/  /'
  if [ "$COUNT_A" -gt 5 ]; then
    echo "  ... (+ $((COUNT_A - 5)) more)"
  fi
  VIOLATIONS=$((VIOLATIONS + COUNT_A))
  echo ""
fi

if [ -n "$HITS_B" ]; then
  echo "── Pattern B: bg-{color}-950 (invisible-text 위험) ──"
  COUNT_B=$(echo "$HITS_B" | wc -l | tr -d ' ')
  echo "  ${COUNT_B} occurrences (showing first 5):"
  echo "$HITS_B" | head -5 | sed 's/^/  /'
  if [ "$COUNT_B" -gt 5 ]; then
    echo "  ... (+ $((COUNT_B - 5)) more)"
  fi
  VIOLATIONS=$((VIOLATIONS + COUNT_B))
  echo ""
fi

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "══ ${VIOLATIONS} dark-class violation(s) found ══"
  echo ""
  echo "Migration:"
  echo "  bg-pg          → bg-sh (background scaffold) / bg-pn (panel) / bg-el (elevated)"
  echo "  bg-X-950       → bg-X-50 (light tone) 또는 의도된 다크면 EXEMPT 추가"
  echo ""
  echo "See ADR-002 §11.45 (#labaxis-no-inline-hex-bg) /"
  echo "         §11.54 (Tailwind class 다크 잔재 17 sites) /"
  echo "         §11.105 (#labaxis-no-tailwind-dark-class-sweep)."
  echo ""

  if [ "${LABAXIS_TAILWIND_DARK_BLOCK:-0}" = "1" ]; then
    echo "(LABAXIS_TAILWIND_DARK_BLOCK=1 — enforcing as CI block)"
    exit 1
  else
    echo "(advisory mode — set LABAXIS_TAILWIND_DARK_BLOCK=1 to enforce)"
    exit 0
  fi
else
  echo "✅ No legacy dark Tailwind classes detected"
  exit 0
fi
