# §11.302d-6b-1 Commit Message Draft (sourcing work-window amber/orange swap)

```
chore(sourcing): §11.302d-6b-1 #sourcing-work-window-amber-removed — request-assembly + request-submission work-window amber → yellow + orange(제출 CTA) → blue swap (호영님 P2 sweep 옵션 B 그룹 1/3, 2026-05-27)

호영님 P2 sweep spec (옵션 B 그룹당 일괄 swap, 2026-05-27):
§11.302d-6b (워크벤치/approval ~44 file) 를 surface 그룹 3 batch 로.
6b-1 = sourcing work-window 2 file.

swap 규칙:
- amber (warning/urgent/경고/incomplete) → yellow (신호등 정합)
- orange (제출 검토 status + 제출 primary CTA) → blue (진행/정보 톤)
  · ⚠️ orange → red 일괄이 아니라 blue: 제출은 위험/삭제가 아니라
    진행/액션 → red 로 swap 시 "위험" 의미 왜곡 (dead button/오인 방지).
    §11.302 신호등에서 정보/검토/진행 = blue.
- critical(red) / emerald(완료) 분기 보존

§11.302d-6 진행:
- 6a ✅ critical surfaces 종결
- 6b (옵션 B, 3 그룹)
  - 6b-1 ✅ 본 batch (sourcing work-window 2 file)
  - 6b-2 (quotes dispatch/intake 7 file) — 후속
  - 6b-3 (approval 35 file) — 후속
- 6c (lib + legacy) — 후속

Fix (2 file + 1 NEW sentinel):

- apps/web/src/components/sourcing/request-assembly-work-window.tsx:
  · amber → yellow 일괄 (text-amber-400/300/200 / border-amber-500 /
    bg-amber-600 + opacity variant /15 /20 /25 /30 /[0.04] /[0.06] /10)
  · urgency critical(red) / 비교결과(blue) 보존

- apps/web/src/components/sourcing/request-submission-work-window.tsx:
  · amber → yellow 일괄 (동일 패턴)
  · 제출 검토 status indicator (line 266-267): orange → blue
    - bg-orange-600/15 border-orange-500/25 → blue
    - Send icon text-orange-400 → text-blue-400
  · 제출 primary CTA (line 576/579): orange → blue
    - submitting: bg-orange-700 text-orange-200 → blue
    - 활성: bg-orange-600 hover:bg-orange-500 → blue
  · isSubmitted emerald(완료) / urgency critical(red) 보존
  · §11.302d-6b-1 주석 2건 (orange → blue 근거)

- apps/web/src/__tests__/regression/
  sourcing-work-window-amber-removed-302d6b1.test.ts (NEW, ~12 it):
  · assembly amber/orange 0 + yellow swap + critical red 보존 — 3 it
  · submission amber/orange 0 + yellow + 제출 status blue + CTA blue +
    emerald 완료 + critical red — 6 it
  · 회귀 0 — 3 it (executeSubmission / canSubmit disabled / incompleteLines)

canonical truth 보존 (회귀 0):
- request-submission executeSubmission wiring / canSubmit disabled 분기
- isSubmitted emerald 완료 status
- urgency critical red 분기
- request-assembly incompleteLines wiring
- 제출 흐름 (검토 → 제출) 동작 변경 0

호영님 production effect:
1. labaxis.co.kr 소싱 → 요청 조립 work-window:
   - 불완전/경고/urgent 표시: amber → yellow
2. labaxis.co.kr 소싱 → 요청 제출 work-window:
   - "요청 제출 검토" status indicator: orange → blue (진행 톤)
   - "제출" 버튼: orange → blue (primary CTA)
   - 제출 완료 시: emerald (변경 0)
   - 경고/차단: yellow / red (변경 0)
3. orange → blue 로 "제출 = 진행" 의미 명확 (red 위험 오인 방지)

Out of Scope (6b-2 / 6b-3 / 6c):
- quotes dispatch/intake 7 file — 6b-2
- approval 35 file — 6b-3
- lib + legacy — 6c

Rollback path: git revert <SHA>
- 2 file amber/orange 복원 + 1 sentinel 삭제
- 사용자 영향: 요청 조립/제출 work-window 색상 회귀 (시각만)
- 제출 wiring / status 분기 변경 0
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/components/sourcing/request-assembly-work-window.tsx `
  apps/web/src/components/sourcing/request-submission-work-window.tsx `
  apps/web/src/__tests__/regression/sourcing-work-window-amber-removed-302d6b1.test.ts `
  docs/commit-drafts/COMMIT_11.302d-6b-1-sourcing-work-window.md

git status   # modified: 2 + untracked: 2
git commit -F docs/commit-drafts/COMMIT_11.302d-6b-1-sourcing-work-window.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. labaxis.co.kr 소싱 → 요청 조립/제출 work-window:
   - 경고/불완전 표시 = yellow (이전 amber)
   - "요청 제출 검토" status + "제출" 버튼 = blue (이전 orange)
   - 제출 완료 = emerald / 차단 = red (변경 0)
3. 제출 흐름 (검토 → 제출 → 완료) 정상 동작
```
