# 머지 시 파일 복원 방지 가이드

## 문제 상황
다른 브랜치를 머지할 때 삭제했던 파일이 다시 복원되는 문제가 발생했습니다.

## 해결 방법

### 1. .gitignore에 삭제된 파일 추가 (즉시 적용 가능)

삭제된 파일을 `.gitignore`에 추가하여 실수로 다시 추가되는 것을 방지합니다.

```bash
# apps/web/.gitignore 또는 루트 .gitignore에 추가
apps/web/public/brand/bioinsight-icon.PNG
apps/web/public/brand/bioinsight-icon.svg
```

### 2. Git Pre-commit Hook 설정 (로컬 검증)

`.git/hooks/pre-commit` 파일을 생성하여 커밋 전에 삭제된 파일이 포함되어 있는지 확인합니다.

```bash
#!/bin/sh
# .git/hooks/pre-commit

# 삭제된 파일 목록 확인
DELETED_FILES="apps/web/public/brand/bioinsight-icon.PNG apps/web/public/brand/bioinsight-icon.svg"

for file in $DELETED_FILES; do
    if git diff --cached --name-only | grep -q "^$file$"; then
        echo "❌ ERROR: 삭제된 파일 $file이 다시 추가되었습니다!"
        echo "이 파일은 더 이상 사용되지 않습니다. Bio-Insight.png를 사용하세요."
        exit 1
    fi
done
```

### 3. GitHub Actions로 CI 검증 (권장)

`.github/workflows/check-deleted-files.yml` 파일을 생성하여 PR 머지 전에 자동으로 검증합니다.

### 4. 브랜치 보호 규칙 설정 (GitHub)

GitHub 저장소 설정에서:
1. Settings → Branches → Branch protection rules
2. `main` 브랜치에 규칙 추가:
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging

### 5. 머지 전 체크리스트

머지하기 전에 다음을 확인하세요:

- [ ] 삭제된 파일이 다시 추가되지 않았는지 확인
- [ ] `.gitignore`에 삭제된 파일이 포함되어 있는지 확인
- [ ] CI 검증이 통과했는지 확인

## 클로드(Cloud) 개발 환경에서의 권장 사항

### A. 브랜치 전략
- `main`: 프로덕션 브랜치 (보호)
- `develop`: 개발 브랜치
- `feature/*`: 기능 브랜치
- `hotfix/*`: 긴급 수정 브랜치

### B. 머지 전 확인 스크립트

`scripts/check-merge.sh` 파일을 생성하여 머지 전에 실행:

```bash
#!/bin/bash
# scripts/check-merge.sh

echo "🔍 머지 전 검증 중..."

# 삭제된 파일 확인
if git diff origin/main...HEAD --name-only | grep -E "(bioinsight-icon\.(PNG|svg))"; then
    echo "❌ 삭제된 아이콘 파일이 포함되어 있습니다!"
    exit 1
fi

echo "✅ 검증 완료"
```

### C. 문서화

이 가이드를 팀원들과 공유하고, 새로운 파일 삭제 시:
1. `.gitignore`에 추가
2. 이 문서에 기록
3. 팀에 알림

