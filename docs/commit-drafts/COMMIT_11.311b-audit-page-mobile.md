# §11.311b Commit Message Draft (audit page 모바일 + CLAUDE.md)

```
feat(audit): §11.311b #audit-page-mobile — audit page eyebrow hidden + 액션 kebab + 필터/검색 인라인 + CLAUDE.md Mobile Patterns (호영님 P1 2026-05-26)

호영님 P1 spec (2026-05-26) "더보기 모바일 최적화" — §11.311a (activity-logs)
후속. audit page 헤더/액션/필터 모바일 정합 + 공통 원칙 CLAUDE.md 문서화.

§11.311b scope:

Fix (1 file 수정 + 1 file 신규 + 1 NEW sentinel):

- apps/web/src/app/dashboard/audit/page.tsx:
  · lucide-react import 에 MoreHorizontal + X 추가
  · Sheet shadcn import 추가
  · useState isActionsSheetOpen + isSearchExpanded 추가
  · 헤더 (line 385~):
    - eyebrow "보안 및 컴플라이언스" → hidden md:flex (모바일 hidden)
    - 제목 + 건수 통합: <h2>감사 증적 <span>· N건</span></h2>
      (이전 description 안 "· 총 N건" 묻혀있던 패턴 제거 → 제목 옆 인라인)
    - description (주요 시스템 데이터 변경...) → hidden md:block (모바일 hidden)
  · 액션 4 button (line 402~):
    - 데스크탑 (hidden md:flex gap-2 flex-shrink-0) — 기존 4 button 그대로
    - 모바일 kebab button (data-testid="audit-actions-kebab",
      md:hidden h-10 w-10) — setIsActionsSheetOpen(true)
    - Sheet (side="bottom", data-testid="audit-actions-sheet"):
      · h-11 justify-start 4 button (refresh / print / pdf / csv)
      · 각 onClick: handler() + setIsActionsSheetOpen(false)
      · testid: audit-actions-sheet-refresh / -print / -pdf / -csv
  · 필터 + 검색 (line 446~):
    - 컨테이너 flex-col md:flex-row → flex-row 항상 (가로 1행)
    - Select width: w-[140px] → w-[120px] md:w-[140px] (모바일 컴팩트)
    - 데스크탑 검색 input: hidden md:flex md:max-w-sm
    - 모바일 검색 토글 button (audit-search-toggle testid):
      · md:hidden h-9 w-9
      · isSearchExpanded false → <Search>, true → <X>
    - isSearchExpanded 시 모바일 input expand (audit-search-input-mobile testid,
      autoFocus, 필터 row 아래)

- CLAUDE.md (NEW, ~120 line):
  · Product Constraints (workbench/queue/rail/dock, same-canvas, canonical truth)
  · ## Mobile Patterns 섹션 — §11.311 10 원칙:
    1. KPI 카드 한 줄 압축 (grid-cols-3 + 0/1+건 톤)
    2. 액션 3 개 초과 시 kebab + Sheet
    3. First fold 도달 (필터/배너/KPI 합산 ≤ 50%)
    4. 0건 상태 최소화 (text-gray-400 + 컴팩트)
    5. 브레드크럼 생략 (모바일 hidden md:flex)
    6. 필터 가로 인라인 (모바일 포함 flex-row)
    7. 제목 + 건수 통합
    8. 터치 영역 ≥ 44px
    9. §11.302 신호등 색상 (amber 금지)
    10. JSX 구조 안정성 (Vercel build 회귀 방지)
  · Sentinel Test 패턴 (readFileSync + regex)
  · Commit Convention
  · 호영님 통제 구조 (verbatim)
  · Sync Pattern (sandbox ↔ 호영님 환경, C:\Users\young\ai-biocompare)

- apps/web/src/__tests__/regression/
  audit-page-mobile-311b.test.ts (NEW, 21 it):
  · 헤더 3 it (eyebrow hidden / 제목+건수 통합 / description hidden)
  · 액션 kebab + Sheet 5 it (데스크탑 hidden md:flex / 모바일 kebab testid /
    Sheet 4 testid / handler wiring / h-11 justify-start)
  · 필터+검색 5 it (flex-row / 이전 flex-col 제거 / 데스크탑 검색 hidden md:flex /
    모바일 토글 testid / expand input testid + autoFocus)
  · CLAUDE.md Mobile Patterns 5 it (파일 존재 / 섹션 존재 / KPI 원칙 /
    kebab 원칙 / §11.302 amber 금지)
  · 회귀 0 4 it (PERIOD_OPTIONS+EVENT_TYPE_OPTIONS / Table 헤더 / Empty state /
    §11.89 인쇄 헤더)

canonical truth 보존 (회귀 0):
- /api/audit-logs fetcher / Prisma AuditLog 모델 변경 0
- PERIOD_OPTIONS / EVENT_TYPE_OPTIONS / AUDIT_EVENT_LABELS 변경 0
- handlePdfDownload / handleCompliancePdf / handleCsvExport 동작 변경 0
- Table 컬럼 (일시/ID, 작업자/IP, 액션/대상, 변경 내역, 사유/인증) 보존
- §11.89 인쇄용 헤더 (print:hidden 분기) 보존
- §11.109 정형 PDF 양식 wiring 보존
- 데스크탑 (md+) 시각 변화 0

호영님 production effect:
1. labaxis.co.kr/dashboard/audit 모바일 (375px):
   - eyebrow 0 (보안 및 컴플라이언스 모바일 hidden)
   - 제목 + 건수: "감사 증적 · 0건" (한 줄)
   - 액션: kebab button 1개만 → 탭 → Sheet (4 button 세로)
   - 필터 + 검색: 가로 1행 (필터 2 select + 검색 아이콘 button)
   - 검색 아이콘 탭 → input expand (autoFocus)
2. 데스크탑 (md+) 변화 0
3. 인쇄/PDF 본 (print:hidden 분기) 변화 0

§11.311 시리즈 closeout:
- §11.311a ✅ activity-logs 모바일 (KPI + AI 인사이트 + 필터)
- §11.311b ✅ 본 batch (audit page + CLAUDE.md Mobile Patterns 섹션)
- §11.311 series complete — 다른 "더보기" 하위 화면도 CLAUDE.md §Mobile Patterns
  자동 강제 (settings / billing / activity-logs / audit 등 미래 추가 시)

Out of Scope:
- settings / billing 등 다른 "더보기" 하위 (CLAUDE.md 원칙 따라 후속)
- audit Table 모바일 카드형 변환 (현재 가로 스크롤 유지)
- 검색 history / 자동완성 (MVP 외)

Rollback path: git revert <SHA>
- 1 file (audit/page.tsx) + 1 file (CLAUDE.md NEW) + 1 sentinel
- eyebrow / description / 액션 가로 / 필터 세로 회귀
- CLAUDE.md 삭제 (다른 batch 가 의존 안 함)
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/app/dashboard/audit/page.tsx `
  CLAUDE.md `
  apps/web/src/__tests__/regression/audit-page-mobile-311b.test.ts `
  docs/commit-drafts/COMMIT_11.311b-audit-page-mobile.md

git status   # modified: 1 + untracked: 3
git commit -F docs/commit-drafts/COMMIT_11.311b-audit-page-mobile.md
git push origin main
```

## Production smoke (호영님 평일)

1. Vercel READY 확인
2. labaxis.co.kr/dashboard/audit 모바일 (375px):
   - eyebrow 0 / 제목 "감사 증적 · N건" 한 줄
   - 우측 kebab (⋯) button → 탭 → Sheet (4 button 세로)
   - 필터 + 검색 아이콘 가로 1행
   - 검색 아이콘 탭 → input expand
3. 데스크탑 (md+) 변화 0
4. /dashboard/activity-logs (§11.311a) 회귀 0
```
