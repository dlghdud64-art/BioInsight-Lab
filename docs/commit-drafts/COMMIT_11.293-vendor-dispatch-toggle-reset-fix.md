# §11.293 Commit Message Draft (호영님 P0 — 공급사 발송 검토 toggle reset)

## Commit message (호영님 클로드코드 환경에서 push)

```
fix(quotes): §11.293 #vendor-dispatch-toggle-reset-fix — 공급사 발송 검토 모달 toggle 직후 reset 회귀 (호영님 P0 — useEffect dependency 가 매 render reset 트리거 = Case C 강제 재설정)

호영님 P0 (2026-05-24):
견적 관리 → "공급사 발송 검토" 모달에서 공급사 후보 7개 전부
체크 + 체크박스 toggle 시 즉시 해제 불가 → 사용자가 발송 대상을
통제 못함. GMP/구매 운영상 부적절 (전 공급사 무조건 발송).

Phase 0 audit (Truth Reconciliation):
- toggleSupplier callback (line 266-269) 정상 wiring
- onToggle button (line 634/660/691) 정상 호출
- sendReadiness 의 supplierOk = includedCount > 0 정상
- UI 동적 메시지 ("공급사 N곳 선택됨" / "전달 준비 완료" /
  "공급사 추가 필요") 정상

Root Cause 확정:
Line 135-160 useEffect dependency [open, resolvedSuppliersInput,
draftMessageInput, trackingStorageKey] — parent 가
resolvedSuppliersInput 을 새 reference 로 매 render 전달 →
useEffect 발화 → setSuppliers(resolvedSuppliersInput) →
사용자 toggle 후 즉시 reset 회귀
= 호영님 spec Case C (state 강제 재설정) 정확.

Fix (1 file ~5 line + 1 NEW test, minimum-diff):

- apps/web/src/components/quotes/dispatch/vendor-dispatch-workbench.tsx:
  · wasOpenRef = useRef(false) 추가 (open 전환 detection)
  · useEffect 시작에서 const wasOpen = wasOpenRef.current capture
  · wasOpenRef.current = open update
  · if (!open) return; if (wasOpen) return; — open false→true
    전환 시에만 init 실행
  · 기존 init 로직 (setSuppliers / setMessage /
    setShowManualFallback / setSentTracking) 그대로 보존

- apps/web/src/__tests__/regression/vendor-dispatch-toggle-reset-fix-293.test.ts
  (NEW, 7 it):
  · §11.293 trace + vendor-dispatch-toggle-reset-fix comment
  · wasOpenRef useRef 정의
  · wasOpen capture + wasOpenRef.current = open update + guard
  · 기존 setSuppliers(resolvedSuppliersInput) init 보존
  · toggleSupplier useCallback 보존
  · sendReadiness + includedCount + UI 동적 메시지 보존
  · message / manual / sentTracking init 보존

canonical truth 보존 (회귀 0):
- toggleSupplier useCallback (included: !s.included)
- setSuppliers / setMessage / setShowManualFallback / setSentTracking
- sendReadiness useMemo + supplierOk / includedCount > 0
- UI 동적 메시지 (공급사 N곳 선택됨 / 전달 준비 완료 등)
- onToggle button 3 spot (line 634/660/691)
- confirmationOpen / remediationOpened / localStorage tracking
- message editing / manual email fallback / sentTracking flow

호영님 production effect (Vercel READY 후):
1. 견적 관리 → 공급사 발송 검토 모달 진입 → 7개 전부 선택 (기본값)
2. 체크박스 toggle → 즉시 선택 해제 정상 (reset 회귀 0)
3. 일부 해제 시 includedCount 동적 갱신
4. 0개 선택 → "공급사 추가 필요" + 전송 disabled
5. 1개 이상 → "전달 준비 완료" + 전송 active
6. Modal close → reopen 시에만 init 다시 실행

Out of Scope (별도 batch):
- 발송 후 트래킹 UI 강화
- 일부 선택 발송 시 backend 검증 audit
- "전체 선택" / "전체 해제" master checkbox
- parent (quotes/page.tsx) resolvedSuppliersInput useMemo cleanup

Rollback path: git revert <SHA>
- 1 file ~5 line 복원 + sentinel test 삭제 → toggle reset 회귀

Lessons:
1. useEffect dependency 의 reference equality trap — parent 가
   새 reference 매 render 전달하면 state-setting useEffect 가
   사용자 input reset 회귀
2. 호영님 spec Case A/B/C 의 정확한 진단 (Case C 정확)
3. child component guard > parent fix — parent regression 시에도
   child 가 보호. minimum-diff 1 file
4. wasOpenRef pattern — modal/dialog 의 일반적 init pattern.
   open false→true 전환 시에만 lifecycle trigger
5. UI 동적 메시지 wiring 이 이미 정상 = 진짜 bug 는 init/reset 만
6. Karpathy minimum-diff — 1 file ~5 line + 1 NEW test
```

## Files to stage

```
apps/web/src/components/quotes/dispatch/vendor-dispatch-workbench.tsx
apps/web/src/__tests__/regression/vendor-dispatch-toggle-reset-fix-293.test.ts
docs/decisions/ADR-002-pilot-tenant-seed.md
docs/commit-drafts/COMMIT_11.293-vendor-dispatch-toggle-reset-fix.md
```

## Push 절차 (호영님)

```bash
cd ~/ai-biocompare && git pull --ff-only

pnpm vitest run apps/web/src/__tests__/regression/vendor-dispatch-toggle-reset-fix-293.test.ts

git add apps/web/src/components/quotes/dispatch/vendor-dispatch-workbench.tsx \
        apps/web/src/__tests__/regression/vendor-dispatch-toggle-reset-fix-293.test.ts \
        docs/decisions/ADR-002-pilot-tenant-seed.md \
        docs/commit-drafts/COMMIT_11.293-vendor-dispatch-toggle-reset-fix.md

git commit -F docs/commit-drafts/COMMIT_11.293-vendor-dispatch-toggle-reset-fix.md
git push origin main
```

## Production smoke (Vercel READY 후)

1. labaxis.co.kr/dashboard/quotes Cmd+Shift+R hard refresh
2. 견적 카드의 "공급사에 전송" / 발송 액션 click → 발송 검토 modal 진입
3. 공급사 후보 7개 표시 + 전부 선택 상태 (기본값) 확인
4. **체크박스 1개 toggle → 즉시 선택 해제 정상 작동** ✅
5. 상단 "공급사 6곳 선택됨 · 회신 담당자 N명 확인됨" 동적 갱신
6. 0개로 만들기 → "공급사 추가 필요" 메시지 + 전송 버튼 disabled
7. 다시 1개 toggle → "전달 준비 완료" + 전송 버튼 활성
8. Modal close → 카드에서 다시 진입 시 7개 전부 선택 (init 재실행)
9. 3개만 선택하여 발송 → backend 에서 선택한 3개만 처리되는지 별도 audit
