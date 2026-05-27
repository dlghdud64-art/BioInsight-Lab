# §11.302d-6b-3 Commit Message Draft (approval 35 file amber/orange swap — 6b 종결)

```
chore(approval): §11.302d-6b-3 #approval-amber-removed — approval 35 file amber/orange → yellow 일괄 swap (at_risk red 격상) — §11.302d-6b 종결 (호영님 P2 sweep 옵션 B 그룹 3/3, 2026-05-27)

호영님 P2 sweep spec (옵션 B 그룹당 일괄 swap, 2026-05-27):
§11.302d-6b surface 그룹 3/3 (마지막) = approval 35 file (~233 occ).
sed 일괄 치환 (운영자 surface, P2).

swap 규칙:
- amber → yellow (warning/pending/검토/리뷰 status — 전부 주의 톤)
- orange → yellow (expedite 긴급 발주 / attention_required — 긴급 attention,
  위험 아님)
- 예외: rc0-midpoint-review DWELL_COLOR at_risk → red 격상
  (watch=yellow 주의와 구분, 위험 신호 강화)
- risk_increasing(red) / stable(green) / critical(red) / normal(green) 보존

§11.302d-6 진행:
- 6a ✅ critical surfaces 종결 (9 file)
- 6b ✅✅ workbench/approval 종결 (옵션 B 3 그룹)
  - 6b-1 ✅ sourcing work-window 2 file (amber→yellow, orange→blue)
  - 6b-2 ✅ quotes dispatch/intake 7 file (amber→yellow)
  - 6b-3 ✅ 본 batch (approval 35 file, amber/orange→yellow + at_risk red)
- 6c (lib + legacy) — 후속

Fix (35 file sed 일괄 + 1 file at_risk red 개별 + 1 NEW sentinel):

- apps/web/src/components/approval/*.tsx (35 file):
  · sed -E 's/(bg|text|border|border-l|from|to|ring)-(amber|orange)-([0-9]+)/\1-yellow-\3/g'
  · opacity variant (/5 /10 /15 /20 /25 /30 /40 등) 보존
  · 대표 file: reorder-decision-governance(19) / procurement-dashboard(15) /
    receiving-governance(14) / rc0-midpoint(13) / dispatch-prep(13) /
    pilot-activation(13) / ownership-dashboard-panels(12) /
    stock-release-governance(12) 외 27 file

- apps/web/src/components/approval/rc0-midpoint-review-workbench.tsx:
  · DWELL_COLOR.at_risk: (orange→sed yellow) → text-red-400 개별 격상
  · §11.302d-6b-3 주석 (at_risk 위험 격상 근거)
  · risk_increasing(red) / stable(green) / attention_required(yellow) /
    watch(yellow) 보존

- apps/web/src/__tests__/regression/
  approval-amber-removed-302d6b3.test.ts (NEW, ~10 it):
  · approval 디렉토리 전체 스캔 amber/orange class 0 (readdirSync) — 2 it
  · rc0-midpoint at_risk red 격상 + watch yellow + risk_increasing red +
    attention_required yellow + stable green — 5 it
  · 대표 file yellow swap (reorder-decision expedite / procurement /
    dispatch-prep) — 3 it

⚠️ commit 제외 (amber swap 0, sed -i CRLF→LF line-ending만 변경):
- approval/index.ts (.ts barrel export — amber 무관)
- approval/stock-release-approval-workbench.tsx (amber 무관)
- → git add 에서 제외 (내용 변경 0, line-ending diff 노이즈 회피)
- → 호영님 환경 .gitattributes 가 결국 LF 정규화하므로 무해

canonical truth 보존 (회귀 0):
- approval workbench 의 위험(red) / 정상(green) / critical(red) 신호 보존
- rc0-midpoint VERDICT risk_increasing(red) / stable(green) 분기
- expedite / approve / reject / escalate dock action wiring 변경 0
- policy status / governance 판정 로직 변경 0 (색상 토큰만 swap)
- 색상 외 동작 / 데이터 / wiring 변경 0

호영님 production effect:
1. labaxis.co.kr 승인/거버넌스 워크벤치 35종 (운영자 surface):
   - warning/pending/검토/긴급 status: amber/orange → yellow
   - rc0 중간점검 "위험(at_risk)" dwell: red 격상 (위험 신호 강화)
   - "위험 상승(risk_increasing)" / "안정(stable)": red / green 보존
2. 운영자 직접 사용 surface (사용자 노출 빈도 낮음, P2)
3. CLAUDE.md §11.302 신호등 정합 — approval 디렉토리 amber/orange 0

§11.302d-6 sweep 총괄 (6a + 6b 완료):
- 사용자 가시 (6a) + 운영자 surface (6b) amber/orange 0
- 잔여: 6c (lib safety-visualization 등 + legacy _workbench ~30 file)

Out of Scope (6c):
- lib/safety-visualization.ts + lib/work-queue / compare-workspace / ops-console
- app/_workbench/_components legacy

Rollback path: git revert <SHA>
- approval 35 file amber 복원 + 1 sentinel 삭제
- 사용자 영향: 승인 워크벤치 warning 색상 회귀 (시각만)
- 위험/정상 신호 + dock action wiring 변경 0
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

# approval 디렉토리 amber swap 35 file (index.ts + stock-release-approval-workbench.tsx 제외)
git add apps/web/src/components/approval/approver-requirement-card.tsx `
  apps/web/src/components/approval/audit-review-workbench.tsx `
  apps/web/src/components/approval/dashboard-action-panels.tsx `
  apps/web/src/components/approval/dispatch-execution-workbench.tsx `
  apps/web/src/components/approval/dispatch-prep-workbench.tsx `
  apps/web/src/components/approval/exception-approval-workbench.tsx `
  apps/web/src/components/approval/fire-approval-workbench.tsx `
  apps/web/src/components/approval/governance-dashboard-batch2.tsx `
  apps/web/src/components/approval/governance-dashboard.tsx `
  apps/web/src/components/approval/governance-review-workbench.tsx `
  apps/web/src/components/approval/graduation-workbench.tsx `
  apps/web/src/components/approval/line-delta-primitives.tsx `
  apps/web/src/components/approval/next-action-hint.tsx `
  apps/web/src/components/approval/operational-readiness-workbench.tsx `
  apps/web/src/components/approval/ownership-authoring-workspace.tsx `
  apps/web/src/components/approval/ownership-dashboard-panels.tsx `
  apps/web/src/components/approval/pilot-activation-workbench.tsx `
  apps/web/src/components/approval/po-created-reentry-surface.tsx `
  apps/web/src/components/approval/policy-admin-workspace.tsx `
  apps/web/src/components/approval/policy-explainability-primitives.tsx `
  apps/web/src/components/approval/policy-message-stack.tsx `
  apps/web/src/components/approval/policy-status-badge.tsx `
  apps/web/src/components/approval/procurement-dashboard-workbench.tsx `
  apps/web/src/components/approval/quote-chain-progress-strip.tsx `
  apps/web/src/components/approval/quote-chain-workbenches.tsx `
  apps/web/src/components/approval/rc0-midpoint-review-workbench.tsx `
  apps/web/src/components/approval/rc0-pilot-launch-workbench.tsx `
  apps/web/src/components/approval/reapproval-banner.tsx `
  apps/web/src/components/approval/receiving-governance-workbench.tsx `
  apps/web/src/components/approval/receiving-workbench.tsx `
  apps/web/src/components/approval/reorder-decision-governance-workbench.tsx `
  apps/web/src/components/approval/reorder-trigger-workbench.tsx `
  apps/web/src/components/approval/stock-release-governance-workbench.tsx `
  apps/web/src/components/approval/supplier-confirmation-workbench.tsx `
  apps/web/src/components/approval/variance-disposition-workbench.tsx `
  apps/web/src/__tests__/regression/approval-amber-removed-302d6b3.test.ts `
  docs/commit-drafts/COMMIT_11.302d-6b-3-approval.md

git status   # modified: 35 + untracked: 2
git commit -F docs/commit-drafts/COMMIT_11.302d-6b-3-approval.md
git push origin main
```

> 참고: 호영님 환경에서 더 효율적인 방법 — approval 디렉토리 전체에서 정규식 찾기-바꾸기
> `(bg|text|border|border-l|from|to|ring)-(amber|orange)-([0-9]+)` → `$1-yellow-$3`
> 실행 후 `rc0-midpoint-review-workbench.tsx` 의 DWELL `at_risk` 만 `text-red-400` 으로 수동 수정.
> (sandbox 와 동일 결과 — 35 file 개별 복사 대신 1회 치환)

## Production smoke

1. Vercel READY 확인
2. labaxis.co.kr 승인/거버넌스 워크벤치 (운영자 surface):
   - warning/pending/검토/긴급 status = yellow (이전 amber/orange)
   - rc0 중간점검 "위험(at_risk)" = red (격상)
   - "위험 상승" / "안정" = red / green (변경 0)
3. 승인 dock (approve/reject/escalate) 정상 동작
```
