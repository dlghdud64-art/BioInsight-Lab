fix(search): §11.337 #search-match-badge — 검색 매칭 정밀도(prefix) + 반복 배지 억제 (호영님 P1, 2026-06-01)

호영님 P1 §11.337 (GREEN) — §11.336-data import 후 발견된 2가지 정정:
Part A 짧은 쿼리 매칭 과다(noise), Part B 전 항목 동일 배지 3종 noise.

배경 / 호영님 spec (스크린샷 1780294372919):
- import 성공(Cat.No 정상 표시). 단:
  · "P" 검색에 PCR Tube(0..)/Climet(C..)/Capricorn(..p) 등 임의 위치 'p' 까지 매칭.
  · 모든 카드에 "견적 필요"/"납기 확인 필요"/"요청 전환 권장" 3종 동일 반복 = 정보값 0.

Truth Reconciliation (진단):
- Part A: search/page.tsx matchesQuery = name/brand/catalogNumber/spec/category 합친
  haystack.includes(queryToken) 단순 부분일치 → 짧은 쿼리에서 임의 위치 매칭 noise.
- Part B: sourcing-result-row buildOperatingSignals — 하드코딩 아님, 조건부.
  · "납기 확인 필요"(lt 없을 때), "견적 필요"/"요청 전환 권장"(unitPrice<=0) →
    §11.336-data import 가 price/leadTime 을 null 로 넣어(환각방지) 전 항목 동일 배지화.
  · = 데이터 공백이 noise 원인. 하드코딩 제거가 아니라 "null 데이터 시 배지 억제"가 정답.

Fix (file 별):

- src/app/_workbench/search/page.tsx (matchesQuery):
  · 짧은 쿼리(≤2자) → 품명/Cat.No 의 시작(startsWith) 또는 단어경계(공백/-/_// 뒤) 시작 일치만.
    "P" → PBS/Papain/PMSF/PMS(O), PCR Tube/Capricorn(X).
  · 긴 쿼리(≥3자) → 전 필드 부분일치 보존(§11.335 Cat.No 검색 + 의도 명확).

- src/app/_workbench/_components/sourcing-result-row.tsx (buildOperatingSignals):
  · 납기: if (lt) 가드 — null 이면 "납기 확인 필요" 억제(실제 값 있을 때만 즉시출고/리드타임).
  · 가격/재고: unitPrice 있을 때만 고가/예산 검토. "견적 필요" push 제거(데이터 0 = 억제).
  · 행동방향: if (unitPrice > 0) 일 때만 "비교 권장/적합". "요청 전환 권장" push 제거.
  · 결과: 데이터 없는 제품 = 배지 0(카드는 Cat.No/분류/Grade + CTA 버튼만). 실제 신호(즉시출고/
    리드타임/재고확보/예산)는 그대로 표시 → 항목 간 차이 있을 때만 배지.

canonical truth / 제약 (CLAUDE.md):
- dead 배지 0 — 배지는 항목 간 차이 보일 때만. CTA("견적 담기")와 중복되던 배지 제거.
- §11.318 환각 방지 정합 — 없는 데이터로 배지 만들지 않음.
- §11.335 Cat.No 검색 보존(긴 쿼리 부분일치 + Cat.No 카드 표시).

production effect:
- 짧은 식별자 검색이 품명/Cat.No 시작 기준으로 정밀 — 무관 품목 noise 제거.
- 데이터 없는 제품 카드가 깔끔(반복 배지 3종 사라짐). price/leadTime 채워지면 자동으로 실신호 배지 표시.

검증 (sandbox):
- sentinel sourcing-match-badge-337.test.ts: Part A prefix 분기/단어경계 + 긴쿼리 보존,
  Part B 납기 가드/견적필요·요청전환권장 제거/가격>0 행동방향, 회귀(즉시출고/리드타임/재고/Cat.No) 보존.
  정규식 단언 15/15 PASS.
- 2파일 무결 brace/paren/eof. truncation 0(search delta=prefix 추가분 일치).
- 빌드/타입체크 = 호영님 env.

Out of Scope:
- 검색 대상 필드 토글 UI(옵션 C) — 미채택(옵션 A).
- price/leadTime 데이터 확보(별도 2차 import) — 채워지면 배지 자동 활성.

Rollback path: git revert <SHA>
- matchesQuery 단순 includes 복원, buildOperatingSignals 무조건 push 복원.

## Push
```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
cd apps\web; npx next build
cd ..\..
git add apps/web/src/app/_workbench/search/page.tsx `
  apps/web/src/app/_workbench/_components/sourcing-result-row.tsx `
  apps/web/src/__tests__/regression/sourcing-match-badge-337.test.ts `
  docs/commit-drafts/COMMIT_11.337-search-match-badge.md
git commit -F docs/commit-drafts/COMMIT_11.337-search-match-badge.md
git push origin main
```

## Production smoke (호영님 env)
1. "P" 검색 → PBS/Papain/PMSF 류만, PCR Tube/Climet/Capricorn 미노출 확인.
2. Cat.No(예: P4762) 검색 → 정상 노출(§11.335 보존).
3. 제품 카드 → "견적 필요/납기 확인 필요/요청 전환 권장" 반복 배지 사라짐 확인.
4. 카드 = Cat.No/분류/Grade + [비교 추가][견적 담기][상세 보기] 버튼만.
5. (price/leadTime 있는 제품이 생기면) 실제 신호 배지 정상 표시.

## Next
- §11.335/336/336-data/337 = Cat.No 검색 동선 전체 종결 후보.
- price/leadTime 2차 데이터 확보 시 배지 자동 활성(코드 변경 불요).
