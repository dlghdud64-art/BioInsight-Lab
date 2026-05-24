# §11.292b Commit Message Draft (호영님 §11.292 1단계 정합)

## Commit message (호영님 클로드코드 환경에서 push)

```
fix(compare): §11.292b #compare-drawer-shortlist-removal — 비교 drawer 후보 등록/보류/제외 button 3종 제거 (호영님 §11.292 1단계 정합 — 분류 단계 강제 회피 비교 화면 적용)

호영님 §11.292 1단계 정합 (2026-05-24):
§11.292 1단계가 소싱 검색 결과 Shortlist 제거. 비교 drawer 안에도
동일 분류 button 3종 (후보 등록/보류/제외 한글판) 잔존 발견. 호영님
spec "이메일 정리 같은 분류 단계 강제 회피" 원리 정합 — 비교
drawer 도 동일 제거.

Phase 0 audit (Truth Reconciliation):
- /api/ai/compare-analysis/route.ts (193 line, Gemini AI) +
  compare-analysis-drawer.tsx (1447 line) 발견
- §11.292 2단계 (AI 동등 대체품/대체 후보/차단 공급사 분석) 이
  이미 완전 구현 — substitute_reference / blocked_or_mismatch /
  최저가 label / Gemini AI 종합 의견 + 3 시나리오 모두 land
- candidate card line 341-369 에 후보 등록/보류/제외 button 3종
  잔존 (§11.292 1단계 spec 정신 위반)

Fix (1 file ~30 line + 1 NEW test, minimum-diff):

- apps/web/src/app/compare/_components/compare-analysis-drawer.tsx:
  · line 341-369 {!isBlocked && (<div>3 button</div>)} block 제거
  · 후보 등록 (onClick=shortlist) button 제거
  · 보류 (onClick=hold) button 제거
  · 제외 (onClick=exclude) button 제거
  · §11.292b trace marker comment 남김

- apps/web/src/__tests__/regression/compare-drawer-shortlist-removal-292b.test.ts
  (NEW, 8 it):
  · §11.292b trace + comment
  · 후보 등록/보류/제외 onClick 3종 잔존 0
  · 영문 주석 swap
  · CandidateAction type backward compat
  · 기존 인프라 (substitute_reference / blocked_or_mismatch /
    CompareInsight / computeDeltaSummary) 보존
  · isBlocked 분기 + 비교 불가 메시지 보존

canonical truth 보존 (회귀 0):
- CandidateAction type backward compat
- action prop / onActionChange callback prop (다른 호출처 0)
- shortlistCount state + canProceed (자동 directCount only)
- 비교 분석 인프라 (substitute_reference / blocked_or_mismatch /
  CompareInsight / computeDeltaSummary / classifyCandidates)
- isBlocked 분기 + "비교 불가 — {categoryReason}" 메시지
- "선택 후보 요청으로 넘기기" CTA + judgment lines + 견적 초안
  생성 + 공급사 문의 초안

호영님 production effect (Vercel READY 후):
1. 견적 비교 → AI 분석 drawer 진입 → candidate card 표시
2. 후보 등록/보류/제외 button 3종 0
3. "선택 후보 요청으로 넘기기" CTA 만으로 다음 단계
4. 비교 불가 candidate 의 "비교 불가 — 사유" 메시지 그대로
5. Gemini AI 종합 의견 + 3 시나리오 + 최저가/동등 대체/차단
   분석 그대로

§11.292 family final close (v2):
§11.292 1단계 (소싱 TRIAGE 제거) ✅ + §11.292b (비교 drawer
Shortlist 제거) ✅
2단계 (비교 AI 분석 추가) = 인프라 이미 완성 (별도 작업 0)

Out of Scope (P2 cleanup batch):
- CandidateAction type 제거 (다른 사용처 audit 후)
- action / onActionChange prop 제거
- shortlistCount state + canProceed 단순화 (directCount only)
- candidateActions Object.values 호출처 cleanup

Rollback path: git revert <SHA>
- 1 file 30 line 복원 + sentinel test 삭제 → button 회귀

Lessons:
1. §11.292 1단계 후 2단계 audit 시 잔여 발견 — 광범위 적용 필요
2. 인프라 이미 완성 발견의 가치 — audit 가 시간 절약
3. prop interface backward compat — 다른 호출처 회귀 0
4. Karpathy minimum-diff — 1 file ~30 line + 1 NEW test
```

## Files to stage

```
apps/web/src/app/compare/_components/compare-analysis-drawer.tsx
apps/web/src/__tests__/regression/compare-drawer-shortlist-removal-292b.test.ts
docs/decisions/ADR-002-pilot-tenant-seed.md
docs/commit-drafts/COMMIT_11.292b-compare-drawer-shortlist-removal.md
```

## Push 절차 (호영님)

```bash
cd ~/ai-biocompare && git pull --ff-only

pnpm vitest run apps/web/src/__tests__/regression/compare-drawer-shortlist-removal-292b.test.ts

git add apps/web/src/app/compare/_components/compare-analysis-drawer.tsx \
        apps/web/src/__tests__/regression/compare-drawer-shortlist-removal-292b.test.ts \
        docs/decisions/ADR-002-pilot-tenant-seed.md \
        docs/commit-drafts/COMMIT_11.292b-compare-drawer-shortlist-removal.md

git commit -F docs/commit-drafts/COMMIT_11.292b-compare-drawer-shortlist-removal.md
git push origin main
```

## Production smoke (Vercel READY 후)

1. labaxis.co.kr/app/search → 비교 추가 → 비교 화면 진입
2. AI 분석 drawer 열기
3. candidate card 표시 확인
4. **후보 등록/보류/제외 button 3종 0** ✅
5. "선택 후보 요청으로 넘기기" CTA 단독 노출 확인
6. 비교 불가 candidate → "비교 불가 — 사유" 메시지 정상
7. Gemini AI 종합 의견 + 3 시나리오 정상 노출

## 다음 batch 후보 (P2 cleanup, 호영님 결정)

- CandidateAction type 자체 제거
- action / onActionChange prop 제거
- shortlistCount state + canProceed 단순화
- candidateActions Object.values 호출처 cleanup

→ 모두 dead reference 화. 회귀 위험 0, 별도 batch 안전.
