# §11.311a Commit Message Draft (activity-logs 모바일 최적화)

```
feat(activity-logs): §11.311a #activity-logs-mobile — KPI 3 카드 grid-cols-3 압축 + 0건/1+건 톤 분기 + AI 인사이트 조건부 + 필터 가로 1행 (호영님 P1 2026-05-26)

호영님 spec § 번호 §11.304 → §11.311a 부여 (기존 §11.304 = 티어 네이밍 충돌
회피, audit page 는 §11.311b 별도 batch 분할).

호영님 P1 spec — 더보기 하위 화면 모바일 최적화:
모바일 first fold 도달 위해 KPI 카드 압축 + AI 인사이트 조건부 + 필터
가로 인라인. 모두 0건일 때 화면 점유 최소화.

§11.311a scope (activity-logs 한정, audit page 는 §11.311b 분할):

Fix (1 file 수정 + 1 NEW sentinel):

- apps/web/src/app/dashboard/activity-logs/page.tsx:
  · KPI grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-4 → grid-cols-3 lg:grid-cols-4
    - 모바일 (default) 3 컬럼 한 줄 (호영님 spec)
    - 데스크탑 (lg+) 4 컬럼 — Stream Status 노출
  · Stream Status (4번째 카드) → hidden lg:block (모바일 hidden, 호영님 spec
    "KPI 3 카드" 정합)
  · 카드 컴팩트:
    - CardContent p-5 → p-3 md:p-4
    - 아이콘 컨테이너 w-10 h-10 rounded-xl bg-*-50 제거 → 인라인 16px (h-4 w-4)
    - count 폰트 text-2xl md:text-3xl → text-lg md:text-xl
    - 라벨 + 아이콘 가로 인라인 (이전 mb-3 spacer 제거)
  · 0건/1+건 톤 분기:
    - 시스템 활동: aiCount > 0 ? bg-white border-slate-300 shadow-sm : bg-gray-50 border-gray-200
    - AI 처리: 동일 패턴
    - 경고/오류 (§11.302 색상): alertCount > 0 ? bg-red-50 border-red-200 + text-red-700 : 비활성
    - count text: 1+건 text-slate-900 / 0건 text-gray-400
  · AI 인사이트 조건부:
    - aiCount === 0 && todayCount === 0:
      → 1줄 muted (bg-gray-50, text-gray-500, ~40px 높이)
      → testid "activity-logs-ai-insight-muted"
      → "오늘 활동 0건 · AI 처리 시작 시 인사이트가 표시됩니다"
    - 1건+: 기존 그라데이션 카드 유지 (from-indigo-500 via-purple-500 to-pink-500)
    - 패딩 p-5 md:p-6 → p-4 md:p-6 (모바일 약간 축소)
  · 필터 가로 인라인:
    - 컨테이너 flex flex-col md:flex-row → flex flex-row (모바일 포함)
    - gap-3 md:items-end → gap-2 md:gap-3 items-end
    - 라벨 mb-1.5 → mb-1 (수직 압축)

- apps/web/src/__tests__/regression/
  activity-logs-mobile-311a.test.ts (NEW, 14 it):
  · KPI grid 5 it (grid-cols-3 / 이전 패턴 제거 / Stream Status hidden lg:block /
    p-3 md:p-4 / 아이콘 h-4 w-4)
  · 0건/1+건 톤 3 it (시스템 활동 / AI 처리 / 경고/오류 red 톤)
  · AI 인사이트 조건부 3 it (muted testid + 메시지 / 그라데이션 보존)
  · 필터 1 it (flex-row + 이전 flex-col 제거)
  · 회귀 0 3 it (3 KPI 라벨 / Stream Status 라벨 / 필터 Select)

canonical truth 보존 (회귀 0):
- todayCount / aiCount / alertCount derive 로직 변경 0
- ACTIVITY_TYPE_LABELS / entityTypeFilter / activityTypeFilter 변경 0
- syncedAt / Stream Status 동작 변경 0 (모바일 hidden 만)
- §11.70 Bento Grid 4 KPI 시각 essence 보존 (데스크탑 lg+)
- §11.299 라벨 한글화 ("활동 유형" / "대상 구분") 보존
- motion.div / Card / CardContent 사용 패턴 보존

호영님 production effect:
1. labaxis.co.kr/dashboard/activity-logs 모바일 (375px):
   - KPI 3 카드 한 줄 (각 ~80px) — 이전 세로 나열 (~450px 점유)
   - 모두 0건 시 회색 비활성 + 작게 (시각 노이즈 ↓)
   - AI 인사이트 0건 시 1줄 (~40px) — 이전 ~120px 그라데이션
   - 필터 가로 1행 (~70px) — 이전 ~120px 세로 2행
   - 활동 내역 first fold 도달 (스크롤 0~1회로 1건 노출)
2. 경고/오류 1+건 시 red 톤 — 시각 우선순위 명확
3. 데스크탑 (lg+) 변화 0 (Stream Status 4번째 카드 보존, 그라데이션 인사이트 유지)

§11.311 시리즈 진행:
- §11.311a ✅ 본 batch (activity-logs 모바일 — KPI + AI 인사이트 + 필터)
- §11.311b ⏳ audit page 모바일 (eyebrow hidden / 액션 kebab + sheet /
  필터+검색 인라인 / 제목+건수 통합)
- §11.311 closeout: CLAUDE.md 에 ## Mobile Patterns 섹션 추가 (Q34 = A)

Out of Scope:
- audit page 모바일 (§11.311b 분할)
- CLAUDE.md Mobile Patterns 섹션 (§11.311b closeout)
- 다른 "더보기" 하위 화면 (settings / billing 등 — 후속 §11.311c+)

Rollback path: git revert <SHA>
- 1 file (activity-logs/page.tsx) + 1 sentinel 복원
- KPI 세로 나열 + AI 인사이트 항상 그라데이션 + 필터 세로 회귀
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/app/dashboard/activity-logs/page.tsx `
  apps/web/src/__tests__/regression/activity-logs-mobile-311a.test.ts `
  docs/commit-drafts/COMMIT_11.311a-activity-logs-mobile.md

git status   # modified: 1 + untracked: 2
git commit -F docs/commit-drafts/COMMIT_11.311a-activity-logs-mobile.md
git push origin main
```

## Production smoke (호영님 평일)

1. Vercel READY 확인
2. labaxis.co.kr/dashboard/activity-logs 모바일 (375px):
   - KPI 3 카드 한 줄 (시스템 활동 / AI 처리 / 경고·오류)
   - Stream Status 4번째 카드 0 (lg+ 만)
   - 모두 0건 시 회색 비활성 톤
   - AI 인사이트 0건 시 1줄 muted (회색)
   - 필터 가로 1행 (활동 유형 + 대상 구분 + 초기화)
   - 활동 내역 first fold 도달
3. 데스크탑 (lg+) 변화 0
```
