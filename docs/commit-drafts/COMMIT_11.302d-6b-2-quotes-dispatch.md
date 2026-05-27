# §11.302d-6b-2 Commit Message Draft (quotes dispatch/intake amber swap)

```
chore(quotes): §11.302d-6b-2 #quotes-dispatch-amber-removed — quotes dispatch/intake 7 file amber → yellow swap (warning/검토/confidence/sendReadiness 톤) (호영님 P2 sweep 옵션 B 그룹 2/3, 2026-05-27)

호영님 P2 sweep spec (옵션 B 그룹당 일괄 swap, 2026-05-27):
§11.302d-6b surface 그룹 2/3 = quotes dispatch/intake 7 file.
이 그룹은 orange Tailwind class 0 (amber 만) — 모두 warning/주의 톤.

swap 규칙:
- amber → yellow (warning/검토/medium-confidence/보류/리마인더 대상 없음/
  sendReadiness 미준비 — 전부 주의 의미)
- emerald(ready/high confidence/완료) / red(low confidence) 분기 보존

§11.302d-6 진행:
- 6a ✅ critical surfaces 종결
- 6b (옵션 B, 3 그룹)
  - 6b-1 ✅ sourcing work-window 2 file
  - 6b-2 ✅ 본 batch (quotes dispatch/intake 7 file)
  - 6b-3 (approval 35 file) — 후속
- 6c (lib + legacy) — 후속

Fix (7 file + 1 NEW sentinel):

- ai-quote-parse-modal.tsx: medium confidence text-amber-400 → yellow,
  견적 ID 없음 안내 text-amber-500 → yellow (high=emerald / low=red 보존)
- intake/quote-intake-dock.tsx: 검토 Badge amber → yellow
- dispatch/vendor-dispatch-workbench.tsx (18): CONFIDENCE_COLOR medium /
  sendReadiness 미준비 배지·아이콘·텍스트 / 전송 전 확인 버튼
  (bg-amber-500 hover:bg-amber-600 → yellow) → yellow
  · ready=emerald / high=emerald 보존
  · line 412 historical 주석 (Pre-§11.54 다크테마) Tailwind-like 표현
    정리 (sentinel 정규식 충돌 방지)
- dispatch/batch-reminder-sheet.tsx: 리마인더 대상 없음 안내 amber → yellow
- dispatch/batch-dispatch-sheet.tsx: 보류 단일 발송 안내 amber → yellow
- dispatch/batch-status-change-sheet.tsx: invalid transition 안내 amber → yellow
- dispatch/batch-action-bar.tsx: 경고 inline text-amber-700 → yellow

- apps/web/src/__tests__/regression/
  quotes-dispatch-amber-removed-302d6b2.test.ts (NEW, ~16 it):
  · 7 file amber/orange class 0 — 7 it
  · yellow swap 정합 6 it (medium confidence / CONFIDENCE_COLOR /
    전송 버튼 / 검토 badge / invalid transition / 리마인더)
  · 회귀 0 3 it (high emerald / low red / sendReadiness ready emerald)

canonical truth 보존 (회귀 0):
- ai-quote-parse confidence high(emerald)/low(red) 분기
- vendor-dispatch CONFIDENCE_COLOR high(emerald) + sendReadiness ready(emerald)
- 발송 흐름 (sendReadiness ready → 전송) wiring 변경 0
- batch dispatch/reminder/status-change preflight 로직 변경 0
- §11.54 light-theme alignment 주석 의미 보존 (표현만 정리)

호영님 production effect:
1. labaxis.co.kr 견적 발송 워크벤치 (vendor-dispatch):
   - medium confidence 공급사 / 전송 전 확인 필요 = yellow (이전 amber)
   - ready 상태 = emerald (변경 0)
2. 견적 일괄 발송/리마인더/상태변경 sheet:
   - 보류/대상 없음/invalid transition 안내 = yellow
3. AI 견적 파싱 모달: medium 신뢰도 = yellow / high=emerald / low=red
4. 견적 intake dock: 검토 badge = yellow

Out of Scope (6b-3 / 6c):
- approval 35 file — 6b-3
- lib + legacy — 6c

Rollback path: git revert <SHA>
- 7 file amber 복원 + 1 sentinel 삭제
- 사용자 영향: 견적 발송/파싱 warning 색상 회귀 (시각만)
- confidence/sendReadiness/preflight 로직 변경 0
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/components/quotes/ai-quote-parse-modal.tsx `
  apps/web/src/components/quotes/intake/quote-intake-dock.tsx `
  apps/web/src/components/quotes/dispatch/vendor-dispatch-workbench.tsx `
  apps/web/src/components/quotes/dispatch/batch-reminder-sheet.tsx `
  apps/web/src/components/quotes/dispatch/batch-dispatch-sheet.tsx `
  apps/web/src/components/quotes/dispatch/batch-status-change-sheet.tsx `
  apps/web/src/components/quotes/dispatch/batch-action-bar.tsx `
  apps/web/src/__tests__/regression/quotes-dispatch-amber-removed-302d6b2.test.ts `
  docs/commit-drafts/COMMIT_11.302d-6b-2-quotes-dispatch.md

git status   # modified: 7 + untracked: 2
git commit -F docs/commit-drafts/COMMIT_11.302d-6b-2-quotes-dispatch.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. labaxis.co.kr 견적 발송 워크벤치:
   - medium confidence / 전송 전 확인 필요 = yellow
   - ready = emerald (변경 0)
3. 일괄 발송/리마인더/상태변경 sheet 안내 = yellow
4. AI 견적 파싱: medium=yellow / high=emerald / low=red
5. 발송 흐름 (전송 준비 → 전송) 정상 동작
```
