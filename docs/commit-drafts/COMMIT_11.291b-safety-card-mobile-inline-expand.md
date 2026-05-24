# §11.291b Commit Message Draft (호영님 §11.291 audit 연장)

## Commit message (호영님 클로드코드 환경에서 push)

```
fix(safety): §11.291b #safety-card-mobile-inline-expand — 안전 관리 카드 큐 nextAction button 모바일 dead button → inline expand (호영님 §11.291 audit 연장)

호영님 §11.291 audit 연장 (2026-05-24):
§11.291 ("지금 확인하기" scroll + highlight) push 후 호영님 spec
명시 추가 audit 대상 — "위험 요인 점검 및 조치 →" / "폐기 또는
격리 처리 →" / "MSDS 등록 후 점검기록 생성 →" 등 카드 nextAction.

Sandbox audit 결과:
- CSV 내보내기 / MSDS 점검 준비 (5건) / 상태 칩 / MSDS·점검·폐기
  dialog buttons 모두 정상 wiring 확인 — dead button 0
- 카드 큐 nextAction button (line 752) onClick=setSelectedItemId
  정상 wired
- 하지만 detail panel (line 879-880) = hidden lg:block w-80
  → 데스크탑 lg breakpoint 이상에서만 visible
- 모바일/태블릿 사용자가 nextAction click → detail panel hidden
  → 시각 신호 0 = dead button 인지
  (§11.291 와 동일 root cause, 다른 surface)

Fix (1 file ~55 line + 1 NEW test, minimum-diff):

- apps/web/src/app/dashboard/safety/page.tsx:
  · 카드 큐 item div 안 row 직후에 IIFE inline expand 추가
  · selectedItemId === q.id 시 classifiedMap.get(q.id) 데이터 access
  · <div className="lg:hidden mt-3 pt-3 border-t border-slate-100
    space-y-2"> — 모바일 전용 노출 (데스크탑 right rail 중복 회피)
  · 차단 요인 (blockers) section
  · 보류 시 리스크 (holdRisk) section
  · 문서 상태 (MSDS / 점검) inline section
  · Action dock — MSDS 등록 / 점검 기록 / 폐기 처리 3 button 조건부

- apps/web/src/__tests__/regression/safety-card-mobile-inline-expand-291b.test.ts
  (NEW, 9 it):
  · §11.291b trace + comment
  · selectedItemId === q.id IIFE pattern
  · lg:hidden 모바일 전용
  · 차단 요인 / 보류 리스크 / 문서 상태 section
  · Action dock 3 button 조건부
  · 기존 §11.291 id="ai-action-queue" + data-priority urgent 보존
  · 데스크탑 right rail (hidden lg:block w-80) 보존
  · nextAction button setSelectedItemId 보존

canonical truth 보존 (회귀 0):
- 카드 nextAction button onClick=setSelectedItemId 그대로
- 데스크탑 right rail (hidden lg:block w-80) 자체 보존
- selectedClassified derived state — 모바일/데스크탑 동기
- openMsdsDialog / openInspDialog / openDisposeDialog handler
- completedQueueIds set/toggle
- classifiedMap (Map<itemId, ClassifiedSafetyItem>)
- CLASS_STYLE.immediate_action + data-priority="urgent" (§11.291)
- id="ai-action-queue" scroll anchor (§11.291)

호영님 production effect (Vercel READY 후):
1. 안전 관리 모바일/태블릿 진입 → 카드 nextAction click
2. 선택한 카드 아래 inline expand:
   - 차단 요인 + 보류 리스크 + 문서 상태 (MSDS/점검)
   - Action dock (조건부 MSDS 등록 / 점검 기록 / 폐기 처리)
3. 데스크탑 (lg+) 은 right rail 그대로 (inline 안 보임)
4. 같은 selectedItemId state share — 모바일/데스크탑 동기

§11.291 family final close (v2):
§11.291 (배너 scroll + highlight) ✅ + §11.291b (카드 모바일 inline) ✅

Out of Scope (별도 batch):
- 모바일 inline detail 의 필수 보호구 (PPE) 추가
- 추천 이유 중복 (이미 카드 본문)
- detail content component 추출 (P2 refactor)

Rollback path: git revert <SHA>
- 1 file ~55 line 복원 + sentinel test 삭제
- 카드 nextAction 모바일 dead button 회귀

Lessons:
1. dead button 인지 vs 코드 wiring 분리 — onClick wired 되어도
   시각 신호 부재 시 dead button 인지
2. §11.291 root cause 재현 — 같은 root cause 의 다른 surface
3. 모바일 inline expand vs sheet/modal — inline = minimum-diff +
   §11.272d FAB 바텀시트 겹침 회피
4. lg:hidden vs lg:block 분기 — 데스크탑 중복 회피
5. classifiedMap.get(q.id) IIFE pattern — conditional lookup
6. Karpathy minimum-diff — 1 file ~55 line + 1 NEW test
```

## Files to stage

```
apps/web/src/app/dashboard/safety/page.tsx
apps/web/src/__tests__/regression/safety-card-mobile-inline-expand-291b.test.ts
docs/decisions/ADR-002-pilot-tenant-seed.md
docs/commit-drafts/COMMIT_11.291b-safety-card-mobile-inline-expand.md
```

## Push 절차 (호영님)

```bash
cd ~/ai-biocompare && git pull --ff-only

pnpm vitest run apps/web/src/__tests__/regression/safety-card-mobile-inline-expand-291b.test.ts

git add apps/web/src/app/dashboard/safety/page.tsx \
        apps/web/src/__tests__/regression/safety-card-mobile-inline-expand-291b.test.ts \
        docs/decisions/ADR-002-pilot-tenant-seed.md \
        docs/commit-drafts/COMMIT_11.291b-safety-card-mobile-inline-expand.md

git commit -F docs/commit-drafts/COMMIT_11.291b-safety-card-mobile-inline-expand.md
git push origin main
```

## Production smoke (Vercel READY 후)

### 모바일 (lg 미만 viewport)
1. iPhone Safari → labaxis.co.kr/dashboard/safety
2. 카드 큐 "위험 요인 점검 및 조치 →" click → **선택 카드 아래 inline expand**
3. 차단 요인 + 보류 리스크 + 문서 상태 + Action dock 노출 확인
4. MSDS 등록 button click → MSDS dialog 정상 open
5. 점검 기록 button click → 점검 dialog 정상 open
6. 다른 카드 click → 이전 inline close + 새 inline open

### 데스크탑 (lg+ viewport)
1. Chrome → labaxis.co.kr/dashboard/safety
2. 카드 큐 nextAction click → right rail (우측 detail panel) update
3. 모바일 inline expand 0 (lg:hidden)
4. 중복 표시 0

## §11.291 family 종료 (v2)

| § | 상태 |
|---|---|
| §11.291 (배너 "지금 확인하기" scroll + highlight) | ✅ Push 완료 |
| **§11.291b** (카드 nextAction 모바일 inline expand) | ✅ Push 대기 |
