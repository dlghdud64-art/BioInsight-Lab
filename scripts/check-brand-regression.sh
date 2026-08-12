#!/bin/bash
# 브랜드 회귀 검사 — "BioInsight"가 사용자에게 노출되는 문자열로 남아있는지 확인
# 컴포넌트명/import/주석은 허용, 렌더링 텍스트는 금지

echo "=== 브랜드 회귀 검사 ==="

# 사용자에게 보이는 텍스트로 BioInsight가 남아있는지 확인
VIOLATIONS=$(grep -rn '"BioInsight\|>BioInsight\|BioInsight Lab\|title.*BioInsight\|description.*BioInsight\|label.*BioInsight' \
  apps/web/src/ \
  --include="*.tsx" --include="*.ts" \
  | grep -v "node_modules\|\.test\.\|import \|from \|function \|export \|const \|type \|interface \|// \|Bio-Insight.png\|bioinsight_\|bioinsight-\|alt=\"\|displayName")

if [ -z "$VIOLATIONS" ]; then
  echo "✅ 브랜드 회귀 없음 — 모든 사용자 노출 텍스트가 LabAxis입니다."
  exit 0
else
  echo "❌ 브랜드 회귀 감지:"
  echo "$VIOLATIONS"
  exit 1
fi
