# Implementation Plan: §11.353 — 발주 관리 = 외부 발주 상태 추적

- **Status:** ⛔ Phase 0 완료 — **블로커 발견**, 접근 결정 대기 (구현 안 함)
- **상위:** DECISION_11.35x §3-2 (요청자 중심 — 외부 발주됨/입고됨 수동 마킹)
- **Last Updated:** 2026-06-02

## Phase 0 — 좋은 소식 (백엔드 완비)
- `PATCH /api/orders/[id]` 가 status 변경 **이미 지원**: before/after **감사 로그**(createAuditLog + auditRequestMeta) + **DELIVERED 진입 시 InventoryRestock 자동 생성(입고 폐루프)** + idempotent 가드. admin status 라우트와 동일 helper(delivery-sync). 스키마 변경 0.
- 즉 "외부 발주 확인(→CONFIRMED) / 입고 완료(→DELIVERED)" 마킹의 **canonical mutation은 이미 존재**. 이중 입고 위험은 idempotent 가드로 통제(새 벡터 아님).

## Phase 0 — 블로커 (치명적)
- 발주 관리 화면(`/dashboard/purchase-orders`)의 리스트(`unifiedInboxItems`)는 **`useOpsStore()` = 순수 목업/시드** (`INBOX_ITEMS` from `seed-data`, `createInitialGraph()`). ops-store에 `/api` fetch·useQuery **전무**. `refreshInbox()` 는 목업 재설정일 뿐.
- 결과: 마킹 버튼을 행에 붙이면 **실 Order는 PATCH(감사·restock 진짜 작동)되지만 리스트 버킷(목업)은 안 변함** → 사용자는 "아무 일도 안 일어난" 것처럼 보임 = **front-only-success / canonical-truth-vs-UI-state 충돌** (CLAUDE.md·DECISION 금지).
- 기존 PDF/이메일 quick-action도 목업 리스트 위에서 실 endpoint를 치지만, "상태 추적"이 본질인 마킹은 목업 disconnect가 치명적.

## ⚠️ 승인 필요 — 접근 결정
- **방안 A (정공법, 권장):** 발주 관리 리스트를 **de-mock** — ops-store 시드 대신 라이브 발주 데이터(`/api/orders` 또는 work-queue 라이브)로 교체 → 그 위에 마킹 wiring. 큰 트랙(ops-console 데이터 레이어). 이후 §11.353 마킹은 자명.
- **방안 B (부분):** 마킹을 **주문 상세/오버레이**(라이브 Order 읽는 곳)에만 배치 — 버킷 한눈 추적은 de-mock 전까지 목업 유지. 작지만 "추적" 가치 절반.
- **방안 C (보류):** §11.353 보류, §11.354/§11.355 먼저. ops-console de-mock가 더 큰 선결과제면 합리적.

## 핵심 사실
- §11.352(구매 운영)는 라이브 react-query(실 bulk-po) — **정상**. §11.353(발주 관리)만 목업 ops-store. 두 화면 데이터 레이어가 다름.
- 백엔드(PATCH+감사+restock)는 이미 production-ready. 막힌 건 오직 **화면이 라이브 상태를 안 읽음**.

## Must Not
- 목업 리스트 위 마킹 버튼으로 front-only-success 생성. canonical(서버 Order.status) 무시.

## 권장
- ops-console de-mock 범위가 크므로, **방안 C(§11.353 보류) + §11.354/§11.355 우선** 또는 **방안 A를 별 트랙으로 승격** 중 택. 호영님 결정 필요.
