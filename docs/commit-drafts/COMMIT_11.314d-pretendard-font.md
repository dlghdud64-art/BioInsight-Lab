fix(build): §11.314-d #pretendard-font-prebuild — PDF 한글 폰트(Pretendard TTF) prebuild 복사 — PDF 한글 깨짐 방지 (호영님 §11.308/§11.314 점검 보완, 2026-05-27)

점검 발견 (호영님 "빠진 것 점검" 요청):
pdfkit PDF generator (lib/orders/po-pdf-generator +
lib/quotes/quote-request-pdf-generator §11.314-b) 가
`public/fonts/PretendardVariable.ttf` 를 registerFont 하는데,
sandbox 확인 결과 public/fonts/ 디렉토리 자체가 없음 →
Helvetica fallback → 견적서/발주서 PDF 한글 전부 깨짐 (실사용 불가).

진단:
- public/fonts/ 없음 (.next/static/media/*.woff2 는 웹폰트 — pdfkit 미지원)
- 단 pretendard@1.3.9 (dependency) 가 TTF 제공:
  node_modules/pretendard/dist/public/static/alternative/Pretendard-Regular.ttf
- 빌드 시 public/fonts/ 로 복사하면 PDF 한글 정상 (order + quote PDF 동시 해결)

Fix (1 script 신규 + package.json 수정 + 1 NEW sentinel):

- apps/web/scripts/copy-pretendard-font.js (NEW):
  · require.resolve("pretendard/package.json") 로 패키지 경로 탐색
    (pnpm/npm 둘 다 호환)
  · dist/public/static/alternative/Pretendard-Regular.ttf
    → public/fonts/PretendardVariable.ttf 복사 (mkdir recursive)
  · graceful — source 없음 / 이미 존재 / 에러 시 process.exit(0)
    (빌드 차단 0, 최악의 경우 Helvetica fallback 으로 빌드는 진행)

- apps/web/package.json:
  · prebuild: "node scripts/vercel-migrate.js"
    → "node scripts/vercel-migrate.js && node scripts/copy-pretendard-font.js"
  · Vercel 빌드: install → prebuild (font copy) → next build (public/ 포함)

- apps/web/src/__tests__/regression/
  pretendard-font-prebuild-314d.test.ts (NEW, ~7 it):
  · copy script 존재 + 복사 로직 + graceful exit + prebuild chain
  · generator fontPath 정합 (quote + order) + pretendard dependency

sandbox 검증:
  node scripts/copy-pretendard-font.js
  → public/fonts/PretendardVariable.ttf (2.7MB) 정상 생성

canonical truth 보존 (회귀 0):
- vercel-migrate prebuild 보존 (chain 앞단)
- generator fontPath (public/fonts/PretendardVariable.ttf) 변경 0
- public/fonts/PretendardVariable.ttf 는 빌드 산출물 — git commit 0
  (prebuild 가 재생성, .gitignore 권장. 단 host 마다 prebuild 실행되므로 무방)

호영님 production effect:
1. labaxis.co.kr 견적서 PDF (§11.314-b) + 발주서 PDF (order):
   - 한글 정상 렌더 (이전 Helvetica fallback → 깨짐 해소)
   - 품목명/규격/요청사유 등 한글 정상 표시
2. Vercel 빌드 prebuild 에서 자동 복사 (호영님 추가 작업 0)
3. order PDF 도 동일 폰트 공유 — 동시 해결

⚠️ 호영님 환경 push 시:
- scripts/copy-pretendard-font.js + package.json 만 반영하면 됨
- public/fonts/PretendardVariable.ttf 는 commit 불필요
  (호영님 환경 npm run build 시 prebuild 가 자동 생성)
- pretendard 는 이미 dependency (^1.3.9) — 추가 install 0

§11.314 시리즈 (점검 보완 포함) 완전 종결:
- §11.314-a ✅ 견적 전송 403 권한
- §11.314-b ✅ PDF generator + route + 버튼 wiring
- §11.314-c ✅ status PENDING/PARSED → SENT 전환
- §11.314-d ✅ 본 batch (Pretendard 폰트 prebuild — PDF 한글)

Rollback path: git revert <SHA>
- script 삭제 + package.json prebuild 복원 + sentinel 삭제
- 회귀: PDF 한글 깨짐 (Helvetica fallback)

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/scripts/copy-pretendard-font.js `
  apps/web/package.json `
  apps/web/src/__tests__/regression/pretendard-font-prebuild-314d.test.ts `
  docs/commit-drafts/COMMIT_11.314d-pretendard-font.md

git status   # modified: 1 (package.json) + untracked: 3
git commit -F docs/commit-drafts/COMMIT_11.314d-pretendard-font.md
git push origin main
```

## Production smoke

1. Vercel 빌드 로그 — "[font] Pretendard TTF → public/fonts/... 복사 완료" 확인
2. Vercel READY 확인
3. labaxis.co.kr 견적 관리 → 견적서 PDF 다운로드:
   - 품목명/규격/요청사유 등 한글 정상 표시 (이전 깨짐 해소)
4. 발주서 PDF (order generate-pdf) 도 한글 정상 확인
