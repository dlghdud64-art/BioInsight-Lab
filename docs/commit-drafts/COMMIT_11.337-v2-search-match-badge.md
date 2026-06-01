fix(search): §11.337-v2 #search-match-badge — 검색 base set 길이 게이트 + 반복 배지 억제 (호영님 P1, 2026-06-01)

호영님 P1 §11.337-v2 (GREEN) — 1차(§11.337) 후 재발한 "P" 검색 매칭 과다의
진짜 범인(서버 where 절 contains) 정정 + Part B 배지 억제(1차 적용분 묶음).

배경 / 1차 한계 (호영님 재지적, 스크린샷 1780296375494):
- 1차 §11.337 Part A 는 search/page.tsx matchesQuery(클라 triage 분류용) 만 고쳐 효과 없었음.
- "P" 검색에 Climet(C)/Microplate(M)/REFRIG(R)/PCR Tube 여전히 노출.

Truth Reconciliation (파이프라인 진단):
- 결과 base set = 서버 /api/products/search → lib/search/ranking.ts buildSearchQuery where 절.
- 범인: where OR 가 name/catalogNumber/brand 전부 { contains } → "P" 가 단어 중간(Capricorn 의 p,
  PCR 의 P)까지 매칭, base set 부풀림. synonyms 확장도 OR 추가로 기여.
- 점수(scoreProduct: CATALOG_PREFIX 60 / NAME_PREFIX 40 > NAME_CONTAINS 20)는 이미 prefix 우선
  = 정렬은 옳고 base set 필터만 느슨했음.
- AI 추천(sortBy=relevance)은 base set 미지배 — 점수 정렬일 뿐(호영님 가설 일부 정정, 방향은 정확).
- Part C("상세 보기" 이중 동선): sandbox 코드엔 "전체 상세 페이지" 링크 0건 → 호영님 화면 = 이전
  배포본. setActiveResultId(우측 rail) 정상. = no-op(배포 후 재확인).

Fix (file 별):

- src/lib/search/ranking.ts (buildSearchQuery — 핵심):
  · 쿼리 길이 게이트(옵션 A). isShortQuery = normalizedQuery.length <= 2.
  · ≤2자: name/catalogNumber { startsWith, insensitive } 만(prefix). brand 제외(중간매칭 noise 원천)
    + synonyms 확장 억제([normalizedQuery] only, P 변형 차단).
  · ≥3자: 현행 name/catalogNumber/brand { contains } + synonyms 유지(§11.335 보존, "PCR"→PCR Tube 정상).
  · 점수/정렬(scoreProduct, sortByRelevance) 무변경 — base set 필터만 정밀화.

- src/app/_workbench/_components/sourcing-result-row.tsx (Part B — 1차 적용분 묶음):
  · buildOperatingSignals: 데이터(납기/가격/재고) 없을 때 "납기 확인 필요"/"견적 필요"/"요청 전환 권장"
    전 항목 동일 배지 억제. if (lt) / if (unitPrice > 0) 가드. 실제 신호 있을 때만 push.
  · §11.336-data import 가 price/leadTime null 로 넣어 발생한 noise 정정. CTA 버튼과 중복 제거.

- src/app/_workbench/search/page.tsx (1차 matchesQuery — triage 분류용, 보조 유지):
  · 클라 triage 의 짧은 쿼리 prefix 분기(base set 은 서버가 결정, 본 변경은 triage 정합 보조).

canonical truth / 제약:
- §11.335 Cat.No 검색 보존(긴 쿼리 contains + startsWith Cat.No 매칭).
- §11.318 환각 방지(없는 데이터로 배지 X). dead 배지 0.
- 점수 로직 불변(prefix 우선 이미 정확).

production effect:
- "P" → 품명/Cat.No 가 P 로 시작하는 것만(PBS/Papain/PMSF/PMS/P4762…). Climet/Microplate/REFRIG/Capricorn/PCR Tube 미노출.
- "PCR" → PCR Tube 정상 노출(≥3자 contains 보존).
- 데이터 없는 카드 = 반복 배지 3종 사라짐(Cat.No/분류/Grade + CTA 버튼만). price/leadTime 채워지면 실신호 배지 자동 활성.

검증 (sandbox):
- sentinel search-ranking-length-gate-337v2.test.ts 8/8 PASS(길이 게이트 + startsWith + 긴쿼리 보존 + 점수 보존).
- sentinel sourcing-match-badge-337.test.ts(Part B) 15/15 PASS(1차).
- ranking.ts brace/paren 무결. tsc: startsWith+mode insensitive 타입에러 0(기존 Set iteration 경고는 무관, 프로젝트 tsconfig es2015+ 정상).
- 빌드 = 호영님 env.

E2E (호영님 env — 배포 후 필수 2케이스):
- "P" → PBS/Papain/PMSF/PMS만, Climet/Microplate/REFRIG 미노출.
- "PCR" → PCR Tube 정상 노출(정상 케이스 보존).
- + 카드 반복 배지 사라짐 + 상세 보기 동선 확인(배포 후 새로고침).

Out of Scope:
- Part C 상세보기 강화(§11.330) — sandbox no-op, 배포 후 호영님 화면 재확인 후 별도 판단.
- price/leadTime 2차 데이터 확보 시 배지 자동 활성(코드 변경 불요).
- 점수 가중치 튜닝(현행 유지).

Rollback path: git revert <SHA>
- ranking.ts buildSearchQuery 단일 contains 복원, sourcing-result-row 배지 무조건 push 복원.

## Push
```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
cd apps\web; npx next build
cd ..\..
git add apps/web/src/lib/search/ranking.ts `
  apps/web/src/app/_workbench/_components/sourcing-result-row.tsx `
  apps/web/src/app/_workbench/search/page.tsx `
  apps/web/src/__tests__/regression/search-ranking-length-gate-337v2.test.ts `
  apps/web/src/__tests__/regression/sourcing-match-badge-337.test.ts `
  docs/commit-drafts/COMMIT_11.337-v2-search-match-badge.md
git commit -F docs/commit-drafts/COMMIT_11.337-v2-search-match-badge.md
git push origin main
```

## Next
- 배포 후 호영님 "P"/"PCR" + 배지 + 상세보기 한 번에 E2E 확인 → §11.337 종결.
- Part C 가 배포 후에도 이중 동선이면 §11.330 트랙으로 별도.
