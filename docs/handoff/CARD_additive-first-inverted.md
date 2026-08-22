# CARD: additive-first 역순 — 컬럼 없는 프로덕션에 budgetId 클라이언트 배포 (2026-08-22)

상태: 🟡 창 닫힘 확인 대기 (로컬 세션 migrate deploy 실행 중 보고 대기)

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

## 확인 대기 (로컬 세션 보고로 채움)

- [ ] 노출 창 닫힘 시각 (prod migrate deploy 완료)
- [ ] 창 구간 실해 여부 (경로 A 트래픽 유무 · P2022 발생 건수)
- [ ] dev(tvkl) 정합 적용
- [ ] 경로 A 스모크 PASS
