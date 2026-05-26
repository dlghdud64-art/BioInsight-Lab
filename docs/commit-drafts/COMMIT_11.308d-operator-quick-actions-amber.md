# §11.308d Commit Message Draft (대시보드 빠른 액션 영역 — amber → 신호등 swap)

```
chore(dashboard): §11.308d #operator-quick-actions-amber-removed — OperatorQuickActions amber → yellow 1:1 swap (§11.302 신호등 정합, 호영님 Q34 = A, 2026-05-26)

호영님 P1 spec (Q34 = A, 2026-05-26):
대시보드 빠른 액션 영역 (OperatorQuickActions "운영 바로가기" 4 카드) 의
잔여 amber/orange 위반 4 위치를 §11.302 신호등 체계 정합으로 swap.
최소 diff — 컴포넌트 구조 / 4 카드 / progressive disclosure / wiring
모두 보존, 색상 토큰만 amber → yellow 1:1 매핑.

scope 결정 (Q34 옵션 A 채택):
- B (견적 발송 progressive disclosure 제거) 보류 → 후속 §11.308d-2
- C (스마트 입고 카드 추가) 보류 → 후속 §11.308e
- A (amber → 신호등 swap) 만 진행 — 최소 diff + 가시 효과

§11.308 시리즈 진행:
- §11.308a ✅ 스마트 입고 진입점 (대시보드 + 재고, P1)
- §11.308a-v2 ✅ 스마트 입고 헤더 승격 (P0)
- §11.308b ✅ 대시보드 영문 라벨 제거 (P2)
- §11.308d ✅ 본 batch (빠른 액션 amber → 신호등, P1)
- §11.308d-2 (견적 발송 progressive disclosure UX 검토) — 후속 별도
- §11.308e (스마트 입고 카드 본문 추가 검토) — 후속 별도

Fix (1 file 5 위치 + 1 NEW sentinel):

- apps/web/src/components/dashboard/operator-quick-actions.tsx:
  · line 61 QuickAction interface tone 타입:
    "blue" | "emerald" | "amber" | "purple" → "blue" | "emerald" | "yellow" | "purple"
  · line 94 입고 처리 카드 tone:
    "amber" → "yellow" (의미 보존: 대기중 입고 = 노란색)
  · line 110 TONE_MAP entry rename:
    amber: { border-l-amber-500, bg-amber-50, text-amber-600 }
    → yellow: { border-l-yellow-500, bg-yellow-50, text-yellow-600 }
  · line 274 dispatch step "연락처 필요" 색상:
    border-amber-200 bg-amber-50 text-amber-700
    → border-yellow-200 bg-yellow-100 text-yellow-700
  · line 299 dispatch alert box (sendBlockReason):
    border-amber-200 bg-amber-50 text-amber-800
    → border-yellow-200 bg-yellow-100 text-yellow-800
  · §11.308d 주석 3건 swap 근거 명시 (amber → yellow 정합)

- apps/web/src/__tests__/regression/
  operator-quick-actions-amber-removed-308d.test.ts (NEW, ~22 it):
  · amber/orange 제거 7 it (border-amber/bg-amber/text-amber/border-l-amber
    /orange defensive / tone type literal / 카드 tone literal)
  · yellow swap 정합 5 it (type literal / 카드 tone / TONE_MAP entry /
    dispatch step / dispatch alert box)
  · 회귀 0 6 it (4 카드 ACTIONS / countKey 매핑 / href real route /
    progressive disclosure isQuoteDispatchExpanded / data-testid 5+ /
    모바일 grid + min-h / TONE_MAP 4 entry)

canonical truth 보존 (회귀 0):
- 4 카드 구조 (견적 등록 / 발주 전환 / 입고 처리 / 재고 점검) 변경 0
- countKey 매핑 (quotes/purchases/receiving/inventory) 변경 0
- href real route 변경 0 (dead button 0)
- §11.247 견적 발송 progressive disclosure isQuoteDispatchExpanded 보존
- §11.252a 모바일 grid-cols-2 + min-h-[110px] sm:min-h-[140px] 보존
- §11.243 #5 count badge 보존
- data-testid 6+ 보존 (dispatch readiness/state-matrix/contact-warning/
  preview-tracking/stage/card)
- caller (dashboard/page.tsx line 763) props forward 패턴 보존

호영님 production effect:
1. labaxis.co.kr/dashboard "운영 바로가기" 4 카드:
   - 입고 처리 카드 좌측 accent border: amber-500 → yellow-500
   - 입고 처리 카드 아이콘 박스: amber-50 + amber-600 → yellow-50 + yellow-600
   - 시각 차이: 따뜻한 amber → 밝은 yellow (대기중 의미 보존)
2. 견적 발송 카드 펼침 시:
   - "연락처 필요" step 배지: amber → yellow
   - dispatch alert box (전송 차단 사유 영역): amber → yellow
3. CLAUDE.md Mobile Patterns §11.302 정합 — amber 사용 위반 위치 4 → 0
4. 컴포넌트 동작 / wiring / 데이터 변경 0

Out of Scope (§11.308d-2 / §11.308e 후속):
- 견적 발송 progressive disclosure UX 단순화 (호영님 Q34 옵션 B 보류)
- 스마트 입고 카드 본문 추가 (호영님 Q34 옵션 C 보류 — 헤더 승격 충분)
- 다른 컴포넌트 amber sweep (§11.302d-6 전체 sweep 별도 batch)
- 모바일 4 카드 → 2 카드 압축 (CLAUDE.md 정합이 이미 grid-cols-2 + min-h)

Rollback path: git revert <SHA>
- 1 file 5 위치 amber 복원 + 1 sentinel 삭제
- 사용자 영향: 입고 처리 카드 amber 톤 회귀 (시각만, 동작 변경 0)
- 다른 회귀 0 (4 카드 구조 / wiring / count / progressive disclosure)
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/components/dashboard/operator-quick-actions.tsx `
  apps/web/src/__tests__/regression/operator-quick-actions-amber-removed-308d.test.ts `
  docs/commit-drafts/COMMIT_11.308d-operator-quick-actions-amber.md

git status   # modified: 1 + untracked: 2
git commit -F docs/commit-drafts/COMMIT_11.308d-operator-quick-actions-amber.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. labaxis.co.kr/dashboard 운영 바로가기 4 카드:
   - 입고 처리 카드 좌측 accent + 아이콘 = yellow tone (amber 0)
   - 다른 3 카드 (blue/emerald/purple) 색상 변경 0
3. 견적 발송 카드 펼침 → "연락처 필요" 배지 + 차단 사유 alert box = yellow
4. count badge / Link wiring / progressive disclosure toggle 정상 동작
5. 모바일 (375px) grid-cols-2 + 카드 컴팩트 보존
```
