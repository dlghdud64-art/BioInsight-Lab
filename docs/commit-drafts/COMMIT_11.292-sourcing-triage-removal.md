# §11.292 Commit Message Draft (호영님 P1 1단계 — 소싱 TRIAGE 제거)

## Commit message (호영님 클로드코드 환경에서 push)

```
fix(workbench): §11.292 #sourcing-triage-removal — 소싱 SOURCING RESULT TRIAGE 블록 + 카드 분류 배지 + Shortlist/Hold/Exclude 전면 제거 (호영님 P1 1단계 — 검색 결과 단순화)

호영님 P1 spec (2026-05-24):
/app/search 검색 결과 화면의 TRIAGE 관련 UI 전면 제거.

근거:
1. 검색이 이미 필터 역할 — "정확 일치" 재분류 불필요
2. 모든 카드 동일 분류 (Exact Match 8 / Cross-Vendor 0 / Substitute 0
   / Blocked 0) = 정보가치 0
3. Shortlist/Hold/Exclude 는 검색→비교→견적 핵심 흐름에
   "이메일 정리" 같은 불필요 중간 단계 — "비교 추가" 하나면 충분
4. AI 동등 대체품/대체 후보 추천은 이미 비교 단계 인프라
   (비교 추가 + 우측 비교 패널 + 견적 조립 모달) 에 위치 가능

호영님 단계적 진행:
- 1단계 (이번): TRIAGE 블록 + 카드 배지 + Shortlist 제거
- 2단계 (별도 batch): 비교 단계에 AI 동등 대체품 분석 추가

Fix (2 file ~320 line 제거 + 1 NEW test, minimum-diff):

- apps/web/src/app/_workbench/search/page.tsx (4 location):
  · Desktop TRIAGE section (line 1295-1479, 185 line) 전체 제거
    - 4 grid sections (Exact/Equivalent/Substitute/Blocked count)
    - candidateRows 리스트 + 비교/보류/제외 buttons
    - 후보 비교 / 견적 요청 CTA + 보류 검토 / 제외 사유 footer
  · Mobile sheet TRIAGE block (line 749-817, 69 line) 제거
    - aria-label="소싱 결과 분류 (모바일)" section 통째
  · AI 분석 sheet 헤더 (line 728) 단순화
    - "SOURCING RESULT TRIAGE · AI 제안 · 차단 사유"
    → "AI 제안 · 차단 사유"
  · SourcingResultRow triage props 4종 (line 1538-1541) 제거
    - triageSections / triageClassification / triageActionState /
      onSetTriageAction prop 전달

- apps/web/src/app/_workbench/_components/sourcing-result-row.tsx
  (line 225-279, 55 line):
  · 카드 내부 TRIAGE 배지 + Classification + Blocked reason +
    Shortlist/Hold/Exclude 3 button 전체 제거
  · props interface 는 backward compat 유지 (page.tsx 전달 0 →
    undefined 안전, type signature 변경 0)

- apps/web/src/__tests__/regression/sourcing-triage-removal-292.test.ts
  (NEW, 11 it × 3 nested describe):
  · §11.292 trace marker (2 file)
  · page.tsx — desktop testid 4종 잔존 0 / Sourcing Result Triage
    영문 헤더 잔존 0 / mobile sheet aria-label 잔존 0 /
    triage props 4종 잔존 0 / AI 분석 sheet 헤더 단순화
  · sourcing-result-row.tsx — triage-badges/classification/
    blocked-reason/shortlist-action testid 잔존 0
  · 회귀 0 — SourcingResultRow import/render 보존 +
    onToggleCompare/onToggleRequest 보존 + 제품명/staticMeta 보존 +
    §11.283b 햄버거 + §11.280-2 Menu pointer-events-none 보존

canonical truth 보존 (회귀 0):
- SourcingResultRow component import + render
- 비교 추가 (toggleCompare) + 견적 담기 (addProductToQuote) 액션
- 카드 component 의 제품명 / staticMeta / 가격 표시
- compareIds / quoteItems / compareStatuses state
- AI 분석 sheet 의 다른 content (AI 제안 fallback 등)
- §11.283b 햄버거 plain button + §11.280-2 Menu pointer-events-none
- 상단 필터 (카테고리/가격/제조사)

Dead code (P2 cleanup batch, 이번 scope 외):
- sourcingCandidateTriage state + setSourcingCandidateTriageState
- sourcingTriage useMemo (line 541-655)
- openSourcingTriageReview + openSourcingTriageRequest handlers
- SourcingTriageBadge / SourcingTriageClassification /
  SourcingTriageActionState type
→ 모두 dead reference (UI render 없음) — 회귀 위험 0, 별도 batch 안전

호영님 production effect (Vercel READY 후):
1. 소싱 검색 결과 화면 → TRIAGE 블록 0 (~250px 상단 화면 회수)
2. 카드 내부 분류 배지 0 (Exact Match 등)
3. 카드 내부 Shortlist/Hold/Exclude button 0
4. 카드 단순화 — 제품명/가격/제조사/배송/재고/비교 추가/견적 담기
5. 상단 필터 (카테고리/가격/제조사) 유지
6. 우측 비교 패널 보존

Out of Scope (2단계 별도 batch):
- 비교 단계 AI 동등 대체품 분석 추가
- 대체 후보 / 차단 공급사 분석 추가
- dead state/handler cleanup
- 호영님 추가 한글화 audit

Rollback path: git revert <SHA>
- 2 file ~320 line 복원 + sentinel test 삭제
- TRIAGE 블록 + 카드 배지 + Shortlist 회귀

Lessons:
1. "모든 카드 동일 분류 = 정보가치 0" — UI 가 분류 정보 표시해도
   사용자 차별화 못 인지하면 노이즈
2. 검색 → 비교 → 견적 핵심 흐름 보호 — Shortlist 같은 중간 단계
   가 사용자 인지 부담 증가
3. AI 차별화는 적절한 위치 — TRIAGE 블록 vs 비교 패널 (인프라
   있음, 비교 의도 명시 후) — 후자 자연스러움
4. Backward compat props interface 보존 — type signature 유지,
   다른 사용처 회귀 0
5. Dead state/handler P2 cleanup 분리 — UI element 제거 우선,
   회귀 위험 ↑ batch 는 별도
6. Karpathy minimum-diff — 2 file ~320 line 제거 + 1 NEW test
```

## Files to stage

```
apps/web/src/app/_workbench/search/page.tsx
apps/web/src/app/_workbench/_components/sourcing-result-row.tsx
apps/web/src/__tests__/regression/sourcing-triage-removal-292.test.ts
docs/decisions/ADR-002-pilot-tenant-seed.md
docs/commit-drafts/COMMIT_11.292-sourcing-triage-removal.md
```

## Push 절차 (호영님)

```bash
cd ~/ai-biocompare && git pull --ff-only

pnpm vitest run apps/web/src/__tests__/regression/sourcing-triage-removal-292.test.ts

git add apps/web/src/app/_workbench/search/page.tsx \
        apps/web/src/app/_workbench/_components/sourcing-result-row.tsx \
        apps/web/src/__tests__/regression/sourcing-triage-removal-292.test.ts \
        docs/decisions/ADR-002-pilot-tenant-seed.md \
        docs/commit-drafts/COMMIT_11.292-sourcing-triage-removal.md

git commit -F docs/commit-drafts/COMMIT_11.292-sourcing-triage-removal.md
git push origin main
```

## Production smoke (Vercel READY 후)

1. labaxis.co.kr/app/search Cmd+Shift+R hard refresh
2. 검색어 입력 → 결과 8건 표시 확인
3. **SOURCING RESULT TRIAGE 블록 0** (상단 ~250px 화면 회수 확인)
4. **카드 내부 [Exact Match 8] [Cross-Vendor 0] [Substitute 0] [Blocked 0] 배지 0**
5. **카드 내부 [Shortlist] [Hold] [Exclude] 버튼 0**
6. 카드에 제품명 / 가격 / 제조사 / 배송 / 재고 / [비교 추가] [견적 담기] 만 표시
7. 상단 필터 (카테고리/가격/제조사) 유지 확인
8. 비교 추가 click → 우측 비교 패널 정상 작동
9. AI 분석 sheet 진입 → 헤더 "AI 제안 · 차단 사유" (SOURCING RESULT TRIAGE 제거 확인)

## 다음 batch 후보 (호영님 결정)

- **2단계 (P1 잔여)**: 비교 단계에 AI 동등 대체품/대체 후보 분석 추가
- **P2 cleanup**: dead state/handler/type cleanup (sourcingCandidateTriage / sourcingTriage useMemo / openSourcingTriageReview/Request handlers / TriageBadge type)
- **호영님 추가 한글화 audit**: 잔여 영문 라벨 발견 시 별도 batch
