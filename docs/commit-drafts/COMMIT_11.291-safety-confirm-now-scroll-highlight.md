# §11.291 Commit Message Draft (호영님 P0 안전 관리 dead button)

## Commit message (호영님 클로드코드 환경에서 push)

```
fix(safety): §11.291 #safety-confirm-now-scroll-highlight — 안전 관리 "지금 확인하기" dead button → AI 권장 처리 큐 scroll + immediate_action 하이라이트 (호영님 P0 — GMP 환경 고위험 물질 경고 CTA 신뢰성)

호영님 P0 (2026-05-24):
/dashboard/safety 상단 빨간 "긴급 안전 경고" 배너의 "지금
확인하기" 버튼 dead button. GMP 환경 고위험 물질 (Sulfuric
Acid, Sodium Hydroxide) 경고의 액션이 작동 안 함 = 안전
관리 기능 신뢰성 위협.

Sandbox audit (Phase 0):
- Line 408 onClick = setSelectedItemId(firstImmediate.id) 만 호출
- 시각 신호 부재 (detail panel 만 set, 사용자가 어디로 이동
  됐는지 인지 못함) = dead button 인지

Fix (1 file ~30 line + 1 NEW test, 호영님 spec 옵션 A):

- apps/web/src/app/dashboard/safety/page.tsx:
  · "지금 확인하기" onClick 확장:
    - document.getElementById("ai-action-queue").scrollIntoView({
      behavior: "smooth", block: "start" })
    - document.querySelectorAll("[data-priority='urgent']")
      → forEach el.classList.add("ring-2","ring-red-500","animate-pulse")
    - setTimeout(remove, 3000)
    - 기존 setSelectedItemId(firstImmediate.id) 보존 (detail panel)
  · "AI 권장 처리 큐" wrapper div 에 id="ai-action-queue" anchor
  · queueItems map item div 에 data-priority={isUrgent ? "urgent"
    : "normal"} (q.classification === "immediate_action" 분기)
  · item div 에 rounded className 추가 (ring 시각 정합)

- apps/web/src/__tests__/regression/safety-confirm-now-scroll-highlight-291.test.ts
  (NEW, 7 it):
  · §11.291 trace + safety-confirm-now-scroll-highlight comment
  · onClick scrollIntoView + querySelectorAll urgent
  · ring-2 ring-red-500 animate-pulse add + setTimeout 3000 remove
  · wrapper id="ai-action-queue" anchor
  · data-priority isUrgent 분기
  · setSelectedItemId 보존 (회귀 0)
  · queueItems filter (compliant/monitor_only 제외, slice 5) 보존

canonical truth 보존:
- queueItems useMemo filter
- CLASS_STYLE.immediate_action 정의
- classifiedMap / selectedItemId / selectedClassified state
- detail panel close 동작
- bannerDismissed X 버튼
- immediateCount (decision.brief.immediateActionCount) 계산

호영님 production effect (Vercel READY 후):
1. 안전 관리 진입 → 긴급 경고 배너 visible
2. "지금 확인하기" click → AI 권장 처리 큐로 부드러운 scroll
3. immediate_action item 들에 빨간 ring + animate-pulse (3초)
4. 사용자 시각 인지 ↑ + 다음 액션 명확
5. 기존 detail panel 도 동시 열림 (첫 immediate item)

Out of Scope (별도 batch — 호영님 추가 audit 권장):
- "위험 요인 점검 및 조치 →" / "폐기 또는 격리 처리 →" /
  "MSDS 등록 후 점검기록 생성 →" 큐 nextAction 링크 audit
- "MSDS 점검 준비 (5건)" 버튼 audit
- "CSV 내보내기" 버튼 audit (sandbox handleExport 정상)
- 상태 칩 의미 정합 audit

Rollback path: git revert <SHA>
- 1 file revert + sentinel test 삭제 → dead button 회귀

Lessons:
1. dead button 보고의 진짜 의미 — onClick wired 되어도 시각
   신호 부재 시 사용자가 dead button 인지. scrollIntoView +
   시각 highlight 가 필수
2. GMP 환경의 시각 신호 중요성 — 고위험 물질 경고는 즉시
   작동 + 사용자가 어디로 이동됐는지 명확 인지 필수
3. 호영님 spec 옵션 A 의 적합성 — 별도 페이지 이동 0 +
   사용자가 2건 위치 즉시 인지 + 구현 비용 최소
4. Karpathy minimum-diff — 1 file ~30 line + 1 NEW test
```

## Files to stage

```
apps/web/src/app/dashboard/safety/page.tsx
apps/web/src/__tests__/regression/safety-confirm-now-scroll-highlight-291.test.ts
docs/decisions/ADR-002-pilot-tenant-seed.md
docs/commit-drafts/COMMIT_11.291-safety-confirm-now-scroll-highlight.md
```

## Push 절차 (호영님)

```bash
cd ~/ai-biocompare && git pull --ff-only

pnpm vitest run apps/web/src/__tests__/regression/safety-confirm-now-scroll-highlight-291.test.ts

git add apps/web/src/app/dashboard/safety/page.tsx \
        apps/web/src/__tests__/regression/safety-confirm-now-scroll-highlight-291.test.ts \
        docs/decisions/ADR-002-pilot-tenant-seed.md \
        docs/commit-drafts/COMMIT_11.291-safety-confirm-now-scroll-highlight.md

git commit -F docs/commit-drafts/COMMIT_11.291-safety-confirm-now-scroll-highlight.md
git push origin main
```

## Production smoke (Vercel READY 후)

1. labaxis.co.kr/dashboard/safety 진입 (Cmd+Shift+R)
2. 상단 빨간 "긴급 안전 경고" 배너 visible (immediateCount > 0 시)
3. "지금 확인하기" click → **AI 권장 처리 큐 섹션으로 부드러운 scroll** ✅
4. immediate_action item 들에 **빨간 ring + animate-pulse 효과 3초** ✅
5. 3초 후 ring 자동 해제 → 정상 표시 복귀
6. 우측 detail panel 도 첫 immediate item 으로 열림 (기존 동작 보존)

## 호영님 추가 audit 권장 (별도 batch)

같은 페이지의 dead button 후보:
- "위험 요인 점검 및 조치 →" 링크 (Sulfuric Acid 카드)
- "폐기 또는 격리 처리 →" 링크 (Sodium Hydroxide 카드)
- "MSDS 등록 후 점검기록 생성 →" 링크 (Acetone 카드)
- "MSDS 점검 준비 (5건)" 버튼
- 상태 칩 ("현재 적용됨 0", "저장 대기 0", "서버 반영 실패")

→ 호영님 production smoke 시 click 시도 → dead button 발견 시 별도 batch
또는 같은 file 안에서 한 번에 fix.
