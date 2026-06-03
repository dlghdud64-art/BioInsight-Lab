# COMMIT — §11.337-v3 검색 1자 품명-우선 게이트 + 매칭 이유 배지

```
fix(search) §11.337-v3 #search-name-first-gate — 1자 순수문자는 품명 시작만, 숫자 포함 시 Cat.No 매칭 + 매칭 이유 배지 (호영님 P1)
```

## 호영님 spec
- "1차는 품명 시작. 유저가 Cat.No를 치면 그걸 매칭. 매칭 이유 배지 표시."

## 진단 (라이브 labaxis.co.kr 실측 확정)
- 프론트는 `query=P`를 `/api/products/search`로 정확히 전송(Network 확인). 서버는 §11.337 게이트대로 필터. AI추천 덮어쓰기 없음.
- "P" 10건은 전부 **품명 또는 Cat.No가 P로 시작** — Microplate(`PMS-100i`)·REFRIG(`PR505750R`)·Climet(`prove`)는 Cat.No prefix 매칭.
- 즉 **버그 아님, 배포된 코드는 스펙대로 동작**. 5~6회 "고쳤는데 안 됨"의 원인 = ranking.ts에 고칠 버그가 없었음(엉뚱한 곳 수정 반복).
- 충돌: 스펙(Cat.No prefix 허용) ↔ 기대(P와 의미상 관련된 것만). 1자 Cat.No prefix가 noise.

## Fix (file 별)
- `lib/search/ranking.ts`: `buildSearchQuery` 짧은 쿼리(≤2) 분기에 `looksLikeCatalogIntent = /\d/.test(q)` 도입. 숫자 미포함(순수문자)은 `name startsWith`만, 숫자 포함은 `catalogNumber startsWith`도 허용. ≥3자 contains 분기 보존(§11.335 Cat.No 검색 유지).
- `_workbench/_components/sourcing-result-row.tsx`: `query` prop + `buildMatchReason`(품명>Cat.No>제조사) → 품명 옆 "품명 일치"/"Cat.No 일치"/"제조사 일치" 배지.
- `_workbench/search/page.tsx`: SourcingResultRow에 `query={searchQuery}` 전달. (※ 본 파일은 §11.343 견적함 커밋과 다른 hunk — `git add -p`로 분리 스테이징.)
- `__tests__/regression/search-ranking-length-gate-337v2.test.ts`: v3 digit 게이트 케이스 추가.

## Canonical truth 보존
- 검색 결과 source = `/api/products/search`(Prisma) 그대로. scoreProduct 가중치 무변경. base set 필터 정밀화 + 표시 배지만 추가.

## Production effect
- "P" → PBS·Papain·PMSF·PMS(품명 P-시작)만. Microplate/REFRIG/Climet/PCR Tube 제거. Cat.No로 찾으려면 숫자 포함("C2284") 또는 ≥3자 입력.
- 각 결과 카드에 매칭 근거 노출 → "왜 떴는가" 투명.

## Out of Scope
- test-flow-provider `sourcingTriage.matchesQuery`(Exact/Equivalent 분류) — 결과 리스트와 별개, 차후 정합.

## Rollback path
- ranking.ts hunk revert(이전 ≤2 catalogNumber startsWith 복원). 배지는 row의 query prop 제거로 무력화. 독립 rollback.

## 검증
- vitest·tsc 미설치 → 자동 **실행 불가**. 정적 검증 + 라이브 실측 완료. 배포 후 "P"/"C" 재검증 예정.
```
footer 없음 (Co-Authored-By 미사용)
```
