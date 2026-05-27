chore(workbench): §11.302d-6c-1 #workbench-amber-removed — _workbench 51 file amber/orange → yellow sed 일괄 (/app/* 실사용 운영자 surface) (호영님 P2 sweep 옵션 A, 2026-05-27)

호영님 P2 sweep 옵션 A (2026-05-27):
§11.302d-6c (amber sweep 마지막) 분할. 6c-1 = _workbench.

정정 (점검):
_workbench 는 dead 아님 — app/app/* (/app/compare, /app/quote, /app/search
등) 가 _workbench/_components 를 실제 import. /app/* 라우트의 운영자
surface (호영님 §11.305 "비교 검토"도 여기). 단 P2 (시각 정합, 기능 0).

swap 규칙 (6b approval sed 패턴):
- amber/orange (확인 필요 / 보류 / 정리 필요 / 진행 / 검역 Quarantine)
  → yellow (전부 주의 톤, 명확한 위험=red 대상 0)
- emerald(완료/ready) / red(제외/위험) / blue(quote stage) 보존

Fix (51 file sed 일괄 + 1 NEW sentinel):

- apps/web/src/app/_workbench/**/*.tsx (51 file, ~343 occ):
  · sed -E 's/(bg|text|border|border-l|from|to|ring)-(amber|orange)-([0-9]+)/\1-yellow-\3/g'
  · opacity variant (/[0.03] /10 /15 /20 /25 등) 보존
  · 대표: quote-normalization (17) / request-wizard-modal (14) /
    request-review-window (14) / reorder-decision (13) /
    inventory-intake (12) / compare-review-work-window (12) /
    compare-review-center (11) / quote-management-workqueue (10) 외 43 file
  · status indicator (확인필요/보류/정리/검역) + 제출/실행 CTA 버튼 yellow

- apps/web/src/__tests__/regression/
  workbench-amber-removed-302d6c1.test.ts (NEW, ~5 it):
  · _workbench 디렉토리 recursive 스캔 amber/orange 0 (walkTsx)
  · 대표 file yellow swap + emerald(완료)/red(제외) 보존

⚠️ commit 제외 (amber swap 0, sed -i CRLF→LF line-ending only):
- _workbench sed 가 .tsx 84개 재작성 (51 amber swap + ~33 line-ending only)
- line-ending only file 은 git add 제외 (내용 변경 0, diff 노이즈)

canonical truth 보존 (회귀 0):
- _workbench 워크벤치 동작 / wiring / state 변경 0 (색상 토큰만)
- emerald(완료) / red(제외/위험) / blue(quote stage) 신호 보존
- /app/* route 실사용 — 색상만 amber/orange → yellow

호영님 production effect:
1. labaxis.co.kr /app/compare, /app/quote, /app/search 등 워크벤치:
   - 확인 필요/보류/정리 필요/검역 status + 진행 CTA = yellow (이전 amber/orange)
   - 완료(emerald) / 제외(red) / 견적단계(blue) 보존
2. P2 — 시각 정합 (기능 영향 0)

§11.302d-6 sweep 거의 종결:
- 6a ✅ critical 9 file
- 6b ✅ workbench/approval 44 file
- 6c-1 ✅ 본 batch (_workbench 51 file)
- 6c-2 (lib 23 file 45 occ, design-tokens/safety-visualization 신중) — 후속
→ 6c-2 완료 시 application-wide amber/orange 0

호영님 sync 권장 (84 file 개별 복사 대신):
_workbench 디렉토리 전체 정규식 찾기-바꾸기 1회
`(bg|text|border|border-l|from|to|ring)-(amber|orange)-([0-9]+)` → `$1-yellow-$3`
(sandbox 와 동일 결과 — 위험 red 격상 대상 0 이라 추가 수동 0)

Rollback path: git revert <SHA>
- _workbench amber 복원 + sentinel 삭제
- 사용자 영향: /app/* 워크벤치 warning 색상 회귀 (시각만)

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

# _workbench 디렉토리 정규식 치환 (VSCode 등) 후:
git add apps/web/src/app/_workbench/ `
  apps/web/src/__tests__/regression/workbench-amber-removed-302d6c1.test.ts `
  docs/commit-drafts/COMMIT_11.302d-6c-1-workbench.md

git status   # _workbench amber swap file + 2 untracked
git commit -F docs/commit-drafts/COMMIT_11.302d-6c-1-workbench.md
git push origin main
```

> 참고: line-ending only 변경 file 은 `git add` 시 .gitattributes(§11.303-hotfix-c)
> 가 LF 정규화하므로 노이즈 무해. 정규식 치환 방식은 amber 만 바꿔 line-ending 무관.

## Production smoke

1. Vercel READY 확인
2. labaxis.co.kr /app/compare (비교 검토) / /app/quote / /app/search:
   - 확인 필요/보류/정리/검역 status + 진행 CTA = yellow
   - 완료(emerald) / 제외(red) 보존
3. §11.305 비교 분석 흐름 정상 (색상만 변경)
