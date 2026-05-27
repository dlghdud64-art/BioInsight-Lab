fix(compare): §11.305-2 #comparison-modal-error-message — AI 비교 분석 에러 안내 "네트워크 상태 확인" misleading 제거 (호영님 §11.305 §7 완료기준 잔여, 2026-05-27)

점검 발견 (호영님 "빠진 것 점검"):
§11.305 §7 완료기준 마지막 — "에러 메시지: '네트워크 상태를 확인해 주세요'
→ 실제 원인 반영" 이 미완. §11.305 에서 enforceAction lock 제거로 409
자체는 0 됐으나, comparison-modal 의 하드코딩 안내 문구는 그대로.

root cause:
comparison-modal.tsx 에러 표시가 {error}(서버 실제 원인) +
하드코딩 "네트워크 상태를 확인해 주세요" 를 항상 병기.
분석 실패(500) / 인증(401) / 입력(400) 등 어떤 에러든 "네트워크 문제"로
오해 유발 (misleading).

Fix (1 file 1 위치 + 1 NEW sentinel):

- apps/web/src/app/_workbench/_components/comparison-modal.tsx:
  · 에러 표시 (line 267):
    "네트워크 상태를 확인해 주세요."
    → "문제가 계속되면 잠시 후 다시 시도해 주세요."
  · {error} (line 266, 서버 실제 원인) 표시는 보존 — 실제 원인이 주 메시지
  · §11.305-2 주석 (misleading 제거 근거)

- apps/web/src/__tests__/regression/
  comparison-modal-error-message-305-2.test.ts (NEW, ~6 it):
  · "네트워크 상태" 하드코딩 0 / {error} 보존 / 재시도 안내 교체
  · 회귀 0 (error&&!loading 분기 / 다시 시도 fetchAnalysis /
    compare-analysis 호출 + setError 실제 원인)

canonical truth 보존 (회귀 0):
- {error} 실제 서버 원인 표시 (주 메시지)
- 다시 시도 버튼 + fetchAnalysis wiring
- compare-analysis 호출 + setError(e.message) 흐름
- §11.305 enforceAction 제거 (lock 버그 fix) 변경 0

호영님 production effect:
1. labaxis.co.kr 소싱 → 비교 검토 → AI 분석 에러 시:
   - 실제 원인 ("AI 분석 중 오류가 발생했습니다" 등) + "문제가 계속되면
     잠시 후 다시 시도해 주세요" (네트워크 단정 0)
   - 이전 "네트워크 상태를 확인해 주세요" misleading 해소
2. §11.305 §7 완료기준 충족 (에러 메시지 실제 원인 반영)

§11.305 완전 종결:
- §11.305 ✅ AI 비교 분석 lock 영구 잔존 (enforceAction 제거)
- §11.305-2 ✅ 본 batch (에러 메시지 misleading 제거)

Rollback path: git revert <SHA>
- 1 file 문구 복원 + sentinel 삭제
- 회귀: "네트워크 상태" misleading 재발

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/app/_workbench/_components/comparison-modal.tsx `
  apps/web/src/__tests__/regression/comparison-modal-error-message-305-2.test.ts `
  docs/commit-drafts/COMMIT_11.305-2-comparison-modal-error.md

git status   # modified: 1 + untracked: 2
git commit -F docs/commit-drafts/COMMIT_11.305-2-comparison-modal-error.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. labaxis.co.kr 소싱 → 비교 검토 → AI 분석 (에러 유발 시):
   - 실제 원인 메시지 + "문제가 계속되면 잠시 후 다시 시도해 주세요"
   - "네트워크 상태를 확인해 주세요" 문구 0
3. 정상 분석 + "다시 시도" 버튼 동작 보존
