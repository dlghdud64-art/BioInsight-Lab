#!/bin/bash
# 머지 전 검증 스크립트
# 사용법: ./scripts/check-merge.sh [base-branch]

set -e

BASE_BRANCH="${1:-main}"
CURRENT_BRANCH=$(git branch --show-current)

echo "🔍 머지 전 검증 중..."
echo "Base branch: $BASE_BRANCH"
echo "Current branch: $CURRENT_BRANCH"

# 삭제된 파일 목록
DELETED_FILES=(
  "apps/web/public/brand/bioinsight-icon.PNG"
  "apps/web/public/brand/bioinsight-icon.svg"
)

# 변경된 파일 확인
CHANGED_FILES=$(git diff --name-only origin/$BASE_BRANCH...HEAD)

FAILED=0
for file in "${DELETED_FILES[@]}"; do
  if echo "$CHANGED_FILES" | grep -q "^$file$"; then
    echo "❌ ERROR: 삭제된 파일 '$file'이 변경사항에 포함되어 있습니다!"
    echo "이 파일은 더 이상 사용되지 않습니다. Bio-Insight.png를 사용하세요."
    FAILED=1
  fi
done

if [ $FAILED -eq 1 ]; then
  echo ""
  echo "💡 해결 방법:"
  echo "1. git rm $file"
  echo "2. git commit -m 'fix: Remove deleted file'"
  echo "3. git push"
  exit 1
fi

echo "✅ 검증 완료 - 삭제된 파일이 포함되지 않았습니다."

