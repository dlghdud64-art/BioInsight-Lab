# COMMIT — §11.358-3: 공통 모바일 헤더 정합

```
feat(mobile) §11.358-3 #app-header-unify — 탭별 인라인 헤더 문법 불일치를 공통 AppHeader 로 통일 (page-per-feature 회귀 방지)
```

## 무엇 (§11.358 Phase 0 #3 — 헤더 문법 불일치 해소)
- Phase 0 진단: 모바일 `headerShown:false` → 각 탭이 인라인 헤더 개별 구현 → 문법 불일치(index `pb-2`/`font-extrabold`/서브타이틀, purchases 우측액션, 나머지 `pb-3 font-bold` 단독). 공통 헤더 컴포넌트 부재.
- 공통 `<AppHeader title subtitle? right?>` 신설 → 5개 탭 전부 통일.

## 신규/수정
- 신규 `components/AppHeader.tsx`: `px-5 pt-3 pb-3 bg-white border-b border-slate-100` + `text-lg font-bold text-slate-900` 제목 + 선택 서브타이틀(text-xs text-slate-500) + 선택 우측 액션(flex-shrink-0). 제목/서브타이틀 `numberOfLines={1}`(overflow 방지).
- 5탭 헤더 치환:
  - `index`: LabAxis + 동적 서브타이틀(dashboardState) → `subtitle` prop. (이전 `font-extrabold`/`pb-2` → 공통 `font-bold`/`pb-3` 정합.)
  - `inventory`/`quotes`/`more`: 단순 제목.
  - `purchases`: "등록" 버튼 → `right` prop.
- import = 기존 모바일 컨벤션(상대경로 `../../components/AppHeader`) — metro 에 `@/` alias 미설정이라 상대경로 필수.

## 제약 준수
- page-per-feature 회귀 방지(동일 헤더 컴포넌트). same-canvas — 헤더 구조만 통일, 탭 본문·스크롤 동작 무변경(최소 diff).
- 색상/토큰 §11.302 정합(신규 amber/orange 0).

## migration
- **없음.** (모바일 UI.)

## 검증
- 모바일은 web vitest 범위 밖(test 스크립트 없음) → **grep 검증**: 5탭 전부 `<AppHeader>` 사용 + import 1건씩 + 인라인 헤더 잔재 0 확인. (런타임 RN 렌더는 ops/Expo.)

## Out of Scope (§11.358 잔여)
- §11.358-4: inventory amber→yellow §11.302 sweep(무해). §11.358-1: 견적 fetch(env/ops 확인). #2 브리핑·#5 안전·#6 스캔 = 모바일 미해당(Phase 0 판정).

## Rollback
- AppHeader 삭제 + 5탭 헤더 인라인 복원. 신규 컴포넌트라 독립.
```
footer 없음
```
