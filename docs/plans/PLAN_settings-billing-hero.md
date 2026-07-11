# #settings-billing-hero — 설정 셸 전역 재디자인 + 청구 히어로 (시안 정합)

- **Status:** ✅ sandbox 완료 (operator build+vitest+push + 전탭 육안 스모크 대기)
- **Date:** 2026-07-11
- **입력:** 청구·구독 구현 지시문.md + 설정 사용자·워크스페이스 고도화.html(시안)
- **승인:** 호영님 2026-07-11 — 스코프 (a) 설정 전역, 가드 2개.

## Truth Reconciliation (6항목 중 4 이미 반영)
지시문은 HTML 시안 기준 6항목이나, 실 React 대조 결과:
- **이미 반영(조치 0):** #2 모달 구조(2열 카드+조건부 폼)·**B1 폼토글**(React는 `paymentMethod==="card" ? … : …` 조건부 렌더 — 시안의 `hidden`+display:grid 동시노출 버그는 HTML 전용, React 무해)·B2 안내문구(평문+break-keep)·#5/#6 정직성(`/api/billing` 실배선·DEMO 제거·PG handoff·fake save 0).
- **실 델타(적용):** #1 히어로 그라데이션 · #3 회색 캔버스 · #4 서브내비 좌측(중앙 래퍼 제거).

## 변경 (2파일)
- `settings/page.tsx`:
  - **#3** 외곽 `bg-canvas` → `bg-[#e9edf4]`(회색 캔버스, 견적관리와 통일).
  - **#4** 메인 래퍼 `max-w-7xl mx-auto` → `max-w-[1600px]`(mx-auto 제거=좌측정렬, 상한 유지=가드1 초광폭 가독폭). **설정 셸 전역**(전 탭 동일).
  - **#1** 현재플랜 Card `bg-slate-900` → `bg-[linear-gradient(118deg,#0e1830→#1b3568→#2a5fb0)]` + 우상단 `radial-gradient` 블루 글로우 overlay(제품 공통 네이비→블루).
- 신규 sentinel `settings-shell-billing-hero.test.ts` — #1/#3/#4 반영 + 회귀 가드(B1 조건부렌더·PG handoff·/api/billing·B2 break-keep).

## 가드 (호영님 2026-07-11)
1. **초광폭 가독폭** — mx-auto 제거해도 `max-w-[1600px]` 상한으로 텍스트 2000px 늘어짐 방지. ✅ 코드 반영.
2. **전 탭 육안 스모크** — 회색 캔버스 위 각 탭 카드 흰색 분리·좌측정렬 깨짐 없음 확인. ⚠️ **operator/호영 배포 후 육안 필수**(sandbox 렌더 불가).

## 검증 (sandbox)
- page.tsx·sentinel 구문 0, 꼬리 정상.
- sentinel 전항목 PASS(#1/#3/#4 + 회귀 4). 가드1 상한 확인.

## operator 게이트
```
git add apps/web/src/app/dashboard/settings/page.tsx \
        apps/web/src/__tests__/regression/settings-shell-billing-hero.test.ts \
        docs/plans/PLAN_settings-billing-hero.md
tail -2 apps/web/src/app/dashboard/settings/page.tsx   # } 정상(truncation 가드)
cd apps/web && npm run build && npx vitest run
# 판정: build 0 · settings-shell-billing-hero GREEN · baseline-delta 0
# 커밋 → push
```
**배포 후 육안(가드2):** 설정 각 탭(프로필·워크스페이스·보안·알림·청구) 전환 — 회색 캔버스+흰 카드 분리, 좌측정렬, 히어로 그라데이션+글로우, 결제모달 토글 정상.

## Out of Scope
실 PG 빌링키 연동(#billing-pg-billingkey, 별트랙) · 서브내비 활성항목 시안 세부 스타일(현 blue-50 유지, 시안 흰배경+그림자는 후속 미세조정 여지).

## Rollback
단일 커밋 revert(순수 className 변경, 로직 0).
