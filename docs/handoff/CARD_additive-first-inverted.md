# CARD: additive-first 역순 — 컬럼 없는 프로덕션에 budgetId 클라이언트 배포 (2026-08-22)

상태: ✅ 마감 (2026-08-22 · 실해 0) — 후속 별건 2건은 게이트 트랙 이월

## 사실 (실측)

- 사무국이 P2 커밋 61e2fe00(코어 + schema.prisma budgetId + migration 파일)을
  **컬럼 적용 전에** 로컬 main 에 plumbing 커밋 (참: PLAN_order-budget-reservation P2)
- 로컬 세션은 fb015a62(캐스트 정정)를 게이트 후 push — 그 시점 tip 이 61e2fe00 이라
  push 가 tip 까지 실어 나름. **게이트 통과 커밋 ≠ 배포 커밋**
- Vercel dpl_4yZFyVwe: BUILDING 1787374591 → READY 1787374795 (빌드 ~204초)
  → www.labaxis.co.kr promote. 프로덕션 DB(xhid…dhsw)에 budgetId 부재 (로컬 세션 dry-run 실측)
- 노출: BudgetEvent 접점 = 경로 A(구매요청 승인/취소/void)의 idempotency 조회·
  create RETURNING 이 전 스칼라 SELECT → P2022. **전면 장애 아님 — 경로 A 국소**
- BudgetEvent 0행 (dry-run 실측) — 데이터 위험 0
- 대응: 호영님 §9.1a 게이트 "진행"(2026-08-22) → 컬럼 선적용 채택 (롤백보다 빠름 —
  ALTER 2줄·0행·즉시. 구 코드에 무해 additive)

## 원인 귀속

- 🛑 1차(사무국): additive-first 를 문서화해 놓고 **main 진입 순서**로 안 지켰다.
  "push 게이트가 막는다"는 가정 — main 이 auto-deploy 대상이라는 사실과 모순
- ⚠️ 2차(구조): push 는 그 시점 tip 만 보증. 게이트는 push 시점 1회라
  게이트 사이에 낀 커밋은 무게이트로 실려 나간다
- P0(§9.1a)와의 구분: P0 = 대상 DB 오인 (어디), 본건 = 적용 순서 역전 (언제)

## 처방 (DEV_RUNBOOK §9.1b 신설, 본 커밋)

- 마이그레이션 포함 커밋은 컬럼 적용·검증 전 main 진입 금지
- push 직전 `git log origin/main..HEAD` 로 실어 나르는 전량 확인 — 미게이트
  마이그레이션 커밋 있으면 중단

## 마감 기록 (로컬 세션 보고 2026-08-22)

- [x] 컬럼 적용: prod(xhid…dhsw ref 단언) 57건 · budgetId text/YES ·
      BudgetEvent_budgetId_idx ✅ → dev(tvkl…pzqr) 동일 57건
- [x] 실해: **0** — BudgetEvent 0행 · 창 구간 경로 A 호출 없음 · P2022 관측 0
- [x] P2 러너 게이트: prisma validate ✅ · tsc 27 불변 · budget unit 17 GREEN ·
      광역 170 passed 0 failed
- ⚠️ 노출 창 판정 정정(사무국): 로컬 세션은 "promote 전 적용"으로 보고했으나
  Vercel API 실측은 dpl_4yZFyVwe ready=1787374795(promote·alias 완료)가
  컬럼 적용보다 **앞선다**. 창은 열렸었다(수 분) — 실해 0 은 트래픽 부재 덕이지
  사고 미성립이 아니다. 기록은 실측 편을 따른다.

## 이월 별건 2건 (게이트 신뢰도 트랙 — 프로덕션 위험 아님)

- ① scripts/smoke/migration-drift.ts 가 .env 만 읽음 — export 된 env 무시.
  프로덕션 검증에 구조적으로 사용 불가. 실행자 단언(내 변수)과 도구 단언(target: 출력)이
  분리되는 형태 — 도구의 target 출력이 진짜 단언이다. §9.2 가 이 스크립트를
  프로덕션 절차로 지목하는지 확인 필요
- ② dev(tvkl) _prisma_migrations 에 0_init rolled_back 잔재(2026-08-14) —
  dev 전용 · 오늘 작업 무관 · 스모크 STOP 의 원인. 프로덕션은 깨끗(rolled_back 0)
