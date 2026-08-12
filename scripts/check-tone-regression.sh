#!/bin/bash
# 톤 토큰 회귀 검사 — 하드코딩 hex가 다시 사용되는지 확인
# 허용: 특수 용도 (#161d2f AI 패널, #0f1623 등)

echo "=== 톤 토큰 회귀 검사 ==="

# 금지 패턴: 이전 navy/charcoal 하드코딩 hex
VIOLATIONS=$(grep -roh \
  'bg-\[#09090b\]\|bg-\[#0c0c0e\]\|bg-\[#0c0c0f\]\|bg-\[#111114\]\|bg-\[#1a1a1e\]\|bg-\[#222226\]\|bg-\[#2a2a2e\]\|border-\[#2a2a2e\]\|border-\[#333338\]' \
  apps/web/src/ \
  --include="*.tsx" --include="*.ts" --include="*.css" \
  | sort | uniq -c | sort -rn)

if [ -z "$VIOLATIONS" ]; then
  echo "✅ 톤 회귀 없음 — 모든 하드코딩 hex가 토큰으로 치환되었습니다."
  exit 0
else
  TOTAL=$(echo "$VIOLATIONS" | awk '{sum+=$1} END{print sum}')
  echo "⚠️  하드코딩 hex $TOTAL건 감지 (토큰 사용 권장):"
  echo "$VIOLATIONS"
  exit 1
fi
