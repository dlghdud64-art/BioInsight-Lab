# Implementation Plan: §11.350 — 지출 분석 zero-state 통합 + 로딩 순서 교정

- **Status:** ⏸️ Phase 0 완료 — **defer 권장** (실 결함 아님, 코드 오독 기반)

## Phase 0 결론 (코드 확정 2026-06-02)
1. 회색 차트 = 삼항 분기 `hasMonthlyData ? real(monthlySpending) : MOCKUP+overlay` (page.tsx 570-591 / 887-904). 실데이터 1건+ 시 자동 real 전환. 실데이터 위 목업 겹침/truth 가림 **없음**.
2. `MOCKUP_*` 상수(218-231) = 하드코딩 순수 더미(라운드 숫자/공급사 A·B·C). 실결과 고정값 아님.
3. mockup-preview = 의도된 §11.244 Phase B(호영님 P0) 설계 → §11.350의 "정직 empty/mock 미사용" 전제는 현 코드 오독.
4. 로딩: `/api/analytics/dashboard` 5쿼리 `Promise.all` 병렬 + 빈 결과 인덱스로 빠름 → 0-state 지연 원인 약함. early count-check 이득 미미 + populated 경로 쿼리 1개 추가 손해.
→ **결론: 실 결함 없음. defer.** (charts auto-switch + mockup 의도된 설계. 마진 작은 로딩 최적화는 P3 비효율.)

- **Status(orig):** ⏳ Pending
- **Priority:** P3 (zero-state 다듬기 — 대기열 끝. 데이터 차면 자연 완화)
- **유형:** UX/성능 (zero-state density + 로딩 순서) · same-canvas
- **Scope:** Small (3 phase)
- **Last Updated:** 2026-06-02

> Quality Gate: build/compile + 관련 test(또는 "실행 불가") + no-op/dead 없음 + canonical 보호 + same-canvas.

## Overview
`/dashboard/analytics` 발주 0건 시: ① 0건인데 무거운 집계 다 돌고 empty(로딩 김), ② KPI4+추이+인사이트+매트릭스+이상로그가 각각 "데이터 없음" 반복(§7 위반).
- **scope 아님:** "AI 리포트 생성" 버튼 = 정상(완료발주 0 → disabled+툴팁 가드됨). 불변.
- 성격: 데이터 쌓이면 자연 소멸하는 zero-state 한정 약점. 우선순위 최하.

## Surface & Truth
- Source of Truth: 발주/지출 서버 집계. UI=projection. Surface=/dashboard/analytics, same-canvas.
- App overview 원칙: ontology 강노출 금지, zero-state primary = "데이터 채우는 액션"(발주/구매 진입).
- Must Not: mock/fake 로 빈 화면 가리기(현행 정직 empty 유지), AI 버튼 가드 훼손.

## Phases
- Phase 0 Truth Lock: 0건에도 무거운 집계 도는지 / 각 카드 empty 개별인지 / 싼 유무판정 지점 / AI 가드 무영향.
- Phase 1 Contract & Tests: 0건→집계 스킵 즉시 zero-state / 통합 안내+진입 CTA 1개 / primary=발주·구매 시작 / ≥1건 정상(회귀) / AI 가드 불변 / 정직 empty 유지.
- Phase 2 Core+UI: early-check(싼 count/exists)→0이면 집계 스킵, zero-state 통합(단일 안내+"발주/구매 시작" CTA, workflow route), ≥1건 기존 유지, loading/zero/populated 구분.

## Risks
- ≥1건 경로 회귀 → populated 회귀 테스트. AI 가드 훼손 → 불변 assert. CTA dead → route 연결 확인. early-check 추가 쿼리 → 가장 싼 count/exists.

## Rollback
- P1 scaffolding revert / P2 zero-state·분기 revert(정직 empty 유지).
