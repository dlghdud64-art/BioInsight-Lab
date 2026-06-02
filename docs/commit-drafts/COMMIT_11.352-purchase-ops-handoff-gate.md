# COMMIT — §11.352 구매 운영 = 발주 인계 게이트 (재명명 + dead-end 전진)

```
feat(purchases) §11.352 #purchase-ops-handoff-gate — 구매 운영 "발주 전환"→"발주 인계" 재명명 + confirmed 시 발주 관리 전진 (호영님 DECISION_11.35x 요청자 중심)
```

## 상위 결정 (DECISION_11.35x — 요청자 중심 B)
- LabAxis = 발주 의뢰·추적, 실행은 외부(ERP). 구매 운영은 "시스템이 발주 실행"이 아니라 **발주 인계 게이트**.

## 진단 (Phase 0)
- 구매 운영 = 견적 비교 완료분 큐. "발주 전환" CTA → `bulk-po` → 내부 Order(status=ORDERED) 생성 = 인계 산출물. 생성 후 우측 레일은 견적 상세로만 회귀(dead-end). OrderStatus=ORDERED/CONFIRMED/SHIPPING/DELIVERED/CANCELLED (배송 중심 — 외부 발주 상태는 별도).

## 범위 결정 (방안 1, 구매 운영 surface 한정)
- "발주 전환"은 3개 surface(구매 운영 KPI·견적 rail·운영자 퀵액션)에 어휘가 퍼져 있고 ~10 sentinel이 강제. §11.352는 **구매 운영 페이지로 한정** 재명명. 견적 rail/퀵액션 어휘는 §11.353/354 별건.
- "외부 발주됨 수동 마킹"은 `Order.status`에 작용 = **발주 관리(§11.353)** 영역 → 본 커밋에서 제외(경계 분리). 전진 링크로 연결만.

## Fix (file 별)
- `app/dashboard/purchases/page.tsx`:
  - CTA/카피 재명명: "일괄 발주 전환"→"일괄 발주 인계", rail "발주 전환"→"발주 인계", "전환 중..."→"인계 중...", chip 2곳(데스크탑/모바일), KPI/STATUS_MAP 1단계 "발주 전환 대기"→"발주 인계 대기", 토스트 "일괄 발주 완료"→"발주 인계 완료"(+발주 관리 추적 안내), confirm/empty-state 카피 재프레이밍, "결재 완료 후 발주 가능"→"인계 가능".
  - **dead-end 해소**: rail에 `conversionStatus === "confirmed"` 시 `/dashboard/purchase-orders`(발주 관리) 전진 CTA 추가 — 견적 회귀 대신 외부 발주·입고 추적으로 전진.
  - 실 mutation(bulkPoMutation/bulk-po 엔드포인트), 결재 게이트(internalApprovalStatus dead-button 가드) wiring 무변경.
- sentinel 갱신(이전 P0 라벨 supersede): `purchases-filter-toolbar-compact-260b`(63) / `purchases-kpi-mobile-summary-bar-273b`(93) / `purchases-kpi-zero-tonedown-260a`(54) / `purchases-card-mobile-collapse-277c`(136-138) → "발주 인계 대기"/"발주 인계".
- 신규 `__tests__/regression/purchase-ops-handoff-gate-352.test.ts`: sentinel(9) — 재명명 + 전진 경로 + 회귀 0(mutation/결재 게이트).

## 검증 (vitest)
- 5 files / **62 tests passed** (352 신규 9 + 260b 11 + 273b 11 + 260a 10 + 277c 21).
- page.tsx esbuild transform OK.

## ⚠️ 작업 중 발견·수정 (truncation 버그)
- 멀티편집 중 page.tsx / 277c 파일 끝이 멀티바이트 경계에서 truncate(이번 세션 반복 버그). bash로 HEAD 꼬리 복원 후 transform+vitest 재검증. **푸시 전 호영님 환경에서 두 파일 끝 정상 여부 한 번 확인 권장.**

## Canonical truth 보존
- Order(canonical) 생성 로직·상태 불변. 재명명은 라벨/카피만. 전진 링크는 navigation(side-effect 0).

## Production effect
- 구매 운영이 "발주 인계 게이트"로 일관. 인계(confirmed) 후 발주 관리로 전진 → 견적 회귀 dead-end 해소. 일괄/단건/모바일 CTA 모두 "발주 인계".

## Out of Scope (후속)
- §11.353 발주 관리 = "외부 발주됨/입고됨" 수동 마킹(OrderStatus 재사용, 스키마 0 가능). §11.354 구매 리포트. 견적 rail/운영자 퀵액션 "발주 전환" 어휘(별 surface).
- page.tsx 주석 내 "발주 전환" §-historical 참조 잔존(무해, UI 라벨 아님).

## Rollback path
- 라벨 일괄 revert + confirmed 전진 CTA 블록 제거 + sentinel 4종 라벨 원복. 독립.
```
footer 없음 (Co-Authored-By 미사용)
```
