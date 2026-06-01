# COMMIT — §11.335b 소싱 검색 매칭 정밀화

```
fix(search) §11.335b #search-match-precision — min 2글자 게이트 + 단어경계 랭킹 티어 + 배지 강도 정정 (호영님 P2)
```

## 호영님 spec (§11.335b, 결정 = 2번 조이기 + min 2글자 빈 상태)
- 1글자(`"P"`) contains noise + 단어 중간 hit에 "품명 일치" 과표시 → 신호 손실.
- 결정: ① min 2글자(1글자는 결과 0 → "2글자 이상" 빈 상태) ② 시작>단어경계>포함 랭킹 ③ 배지 강도 차등.

## Fix (file 별)
- `lib/search/ranking.ts`:
  - `buildSearchQuery`: `<2자` never-match 반환(min 2 게이트). 2자 = 품명 startsWith + 품명 공백-경계(`contains " q"`) + Cat.No startsWith(단어 중간 contains 컷). ≥3자 = name/catNo/brand contains 보존(§11.335).
  - `RANKING_WEIGHTS.NAME_WORD_BOUNDARY=30`(NAME_PREFIX 40 > 30 > NAME_CONTAINS 20). `ScoringFactors.nameWordBoundary` + `calculateRelevanceScore` 티어. `hasWordBoundaryMatch` 헬퍼(2번째 단어부터 startsWith).
- `app/api/products/search/route.ts`: `query.trim().length < 2` → 빈 결과 + `minLength:2`.
- `_workbench/_components/sourcing-result-row.tsx`: `buildMatchReason` 강도 — "품명 시작 일치"(blue) > "품명 일치"(단어경계, blue) > "Cat.No 일치" > "품명 포함" > "제조사 일치". 1글자 미만 배지 없음.
- `_workbench/search/page.tsx`: 1글자 빈 상태 "2글자 이상 입력하세요"(`searchQuery.trim().length < 2` 분기).
- `__tests__/regression/search-ranking-length-gate-337v2.test.ts`: §11.335b sentinel로 갱신(min2/조이기/티어/배지/REFRIG 회귀).

## Canonical truth 보존
- 결과 source `/api/products/search`(Prisma) 그대로. WHERE base set 정밀화 + scoreProduct 티어 + 표시 배지만. take:1000→score→limit 파이프라인 무변경.

## Production effect
- `"P"`(1자) → 결과 없음 + "2글자 이상". 2자 → 시작/단어경계만(단어 중간 noise 컷). ≥3자 보존.
- 배지가 매칭 강도 반영. REFRIG(품명 무 P, Cat.No `PR505750R`) → "Cat.No 일치" 유지.

## ⚠️ 배포 주의 (직전 누락 재발 방지)
- 직전 §11.337-v3에서 `ranking.ts`가 커밋에서 누락돼 배포 안 됨(배지만 반영). **이번엔 `ranking.ts`가 반드시 스테이징됐는지 `git status`로 확인 후 push.**
- 5개 파일 모두 한 커밋: ranking.ts / route.ts / sourcing-result-row.tsx / search/page.tsx / 테스트.
- Vercel 빌드 green 확인 필수.

## Out of Scope
- test-flow-provider `sourcingTriage.matchesQuery`(분류 라벨) — 결과 리스트와 별개.

## Rollback path
- P2 실패: ranking.ts scorer+WHERE revert(§11.335 contains 복귀). P3 실패: 배지/빈상태 UI revert(로직 유지).

## 검증
- vitest·tsc 미설치 → 자동 **실행 불가**. 정적 검증 완료. 배포 후 Chrome "P"(빈상태)·"PB"·"PCR" 재검증 예정.
```
footer 없음 (Co-Authored-By 미사용)
```
