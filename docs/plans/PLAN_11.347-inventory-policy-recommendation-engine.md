# Implementation Plan: §11.347 — 재고 정책 추천 엔진 고도화

- **Status:** ⛔ BLOCKED / 백로그 (착수 보류 — §11.346 선행 + vitest 선행)
- **Priority:** P3 / 백로그 (Track 2)
- **유형:** Feature / Recommendation · same-canvas
- **Scope:** Large (5 phase)
- **Last Updated:** 2026-06-02

> 접수 메모: 본 계획은 호영님이 전달한 원문 그대로 백로그 보관. **착수 금지** —
> ① §11.346(재고 정책 스키마·설정·승인 플로우) 완료, ② vitest install 후에만 시작.

## 의존성 (착수 게이트)
- §11.346 완료 필수 — 정책 스키마·설정·승인 플로우가 있어야 추천이 얹힐 자리가 생김.
- vitest install 후 (추천 계산·경고·degrade 경로는 unit test 필수, 가짜 통과 금지).

## 핵심 부가가치
- 단가 vs 폐기 트레이드오프: `reorderQty × packSize` vs `유효기한 전 예상 소비` → 초과 시 과다구매 폐기위험 경고.
- 종합 신호: 소비속도 / 리드타임 / 발주단위·단가구간 / 유효기한.
- 데이터 부족 시 degrade(단순 추천 or "데이터 부족"), 가짜 정밀도 금지.

## 원칙
- 추천 = derived, 승인 전 truth 아님 (§11.346 승인 게이트 재사용).
- 사람의 수동 판단("소진 시 구매" 등) 대체가 아니라 보조 — 승인은 항상 사람.

## Phases (요약 — 상세는 원문 spec)
- Phase 0 Context & Truth Lock (데이터 소스·공백·degrade 기준)
- Phase 1 Contract & Failing Tests (추천 계산 contract, 승인 전 발주 안 함 assert)
- Phase 2 Core 소비 기반 추천 (소비속도→reorderPoint/Qty, 리드타임, 단가구간)
- Phase 3 과다구매 폐기위험 경고 (packSize×qty vs 유효기한 전 소비, 오탐 임계)
- Phase 4 UI Wiring (검토 dock 추천 근거 + 경고, §11.346 승인 게이트 보존)

## Rollback
- Phase 2: 추천 엔진 revert → §11.346 단순 fallback / Phase 3: 경고 off / Phase 4: UI revert.
