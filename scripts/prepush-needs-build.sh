#!/bin/sh
# §prepush-build-scope — 이 push 가 빌드를 필요로 하는가. (호영님 판정 2026-09-26)
#
# 사용:  scripts/prepush-needs-build.sh <rev-range>
# 종료:  0 = 빌드한다 (기본값)   ·   1 = 건너뛴다
#
# 🛑 **기본값은 빌드다.** 건너뛰는 경로만 허용 목록에 적는다.
#   반대로(「앱 소스 목록」 을 만들어 그것만 빌드) 쓰면 목록에서 빠지기 쉬운 파일이
#   빌드 없이 나간다 — `package.json` · `next.config` · `tsconfig` · `prisma/schema` ·
#   `middleware` · `public/` 이 그 실패 경로다(호영님).
#
# 허용 목록 (전부 이 안에 있을 때만 건너뛴다)
#   apps/web/src/__tests__/**   ·   **/*.test.ts(x)   ·   apps/web/docs/**   ·   *.md
#
# ⚠️ 범위를 못 구하거나 판별에 실패하면 **빌드한다.** 판별 불가를 통과로 세지 않는다.
# ⚠️ husky 9 는 훅을 `sh -e` 로 돈다. 파이프 끝 `grep` 이 매치 0 이면 exit 1 로 훅이 조용히 죽으므로
#   목록 계산은 `|| true` 로 닫는다(2026-09-11 실측 · 60f80de7).

range="$1"
if [ -z "$range" ]; then
  echo "[prepush] 범위를 받지 못했습니다 → 빌드합니다"
  exit 0
fi

files=$(git --no-optional-locks diff --name-only "$range" 2>/dev/null || true)

if [ -z "$files" ]; then
  # 변경 0 (이미 반영된 push 등) — 빌드할 것이 없다.
  echo "[prepush] build skipped: 0 files in $range"
  exit 1
fi

total=0
outside=0
for f in $files; do
  total=$((total + 1))
  case "$f" in
    apps/web/src/__tests__/*) ;;
    *.test.ts|*.test.tsx) ;;
    apps/web/docs/*) ;;
    *.md) ;;
    *) outside=$((outside + 1)) ;;
  esac
done

if [ "$outside" -eq 0 ]; then
  echo "[prepush] build skipped: $total files, all tests/docs ($range)"
  exit 1
fi

echo "[prepush] build required: $total files, $outside outside tests/docs ($range)"
exit 0
