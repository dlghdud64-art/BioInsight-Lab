# Implementation Plan: Inventory Lot 추적 v1 + 입고/사용 흐름 AI 해석 레이어

- Status: ⏳ Pending
- Started: 2026-03-31
- Last Updated: 2026-03-31
- Estimated Completion: 2026-03-31

### ⚠️ CRITICAL INSTRUCTIONS
- [ ] Update "Last Updated" date upon any modification.
- [ ] Check off (`[x]`) completed task checkboxes sequentially.
- [ ] Run all Quality Gate validation commands before moving to the next phase.
- [ ] ⛔ DO NOT proceed to the next phase if ANY tests or quality checks fail.
- [ ] Document blockers or learnings in the Notes section immediately.

---

### 1. Overview

**Feature Description:**
Inventory workbench의 두 탭을 placeholder → 실동작 운영 화면으로 전환한다.

**A. Lot 추적 탭**: P2 개발 예정 뱃지를 제거하고 실제 lot row list + detail rail + 상태 필터를 구현한다. 기존 `ContextLotInfo` 타입과 `InventoryRestock`/`InventoryUsage` 데이터를 활용하여 lot 단위 운영 화면을 만든다.

**B. 입고/사용 흐름 탭**: 기존 파이프라인 시각화 위에 AI 해석 레이어를 추가한다. 이상 탐지 → 추천 액션 → 이벤트 분류 보조 3단계로 제한하며, AI가 source of truth를 직접 수정하지 않는다.

**Success Criteria:**
- [ ] Lot 추적 탭에서 활성 LOT 숫자를 클릭하면 실제 lot row가 보인다
- [ ] 각 lot의 위치, 수량, 유효기간, 상태를 즉시 읽을 수 있다
- [ ] 선택한 lot에 대해 다음 행동이 명확하다
- [ ] P2 개발 예정 라벨이 제거된다
- [ ] 입고/사용 흐름 탭에서 이상 탐지 카드가 노출된다
- [ ] AI 추천은 이유와 함께 노출되고 자동 적용되지 않는다
- [ ] inventory workbench의 center/rail/dock 구조가 유지된다

**Out of Scope (범위 외 - ⚠️ 절대 구현하지 말 것):**
- Lot event timeline v2 (입고→이동→사용→조정→폐기 full chain)
- 구매/재주문 자동 연결 (v3)
- AI 자동 재주문 실행
- AI source of truth 직접 수정
- chatbot UI
- DB 마이그레이션 (기존 schema의 lotNumber, InventoryRestock, InventoryUsage 활용)

---

### 2. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| Mock 데이터 기반 lot list | DB 마이그레이션 없이 즉시 UI 동작 가능 | 실제 API 연결은 후속 배치 |
| 기존 ContextLotInfo 타입 재사용 | inventory-context-panel에 이미 정의됨 | 필드 확장이 필요할 수 있음 |
| AI insight는 engine 함수로 분리 | 재사용 가능 + 테스트 용이 | 실제 ML이 아닌 rule-based 로직 |
| inventory-content.tsx 내부 수정 | 현재 모든 탭이 같은 파일에 있음 | 파일 크기 증가 (이미 194KB) |

**Dependencies:**
- 기존: `inventory-content.tsx`, `inventory-context-panel.tsx`, `InventoryTable.tsx`
- 기존 타입: `ContextLotInfo`, `ContextPanelItem`, `ProductInventory`
- 기존 Prisma: `ProductInventory.lotNumber`, `InventoryRestock`, `InventoryUsage`

---

### 3. Global Test Strategy & Quality Standards

**Coverage Requirements:**
- Unit Tests: ≥80% (lot 상태 계산, AI insight 엔진)
- Integration Tests: ≥70% (컴포넌트 렌더링, 상태 전환)
- E2E: 1+ critical path (lot list → detail → action)

**테스트 환경:**
- TypeScript 타입 체크: `npx tsc --noEmit` (apps/web)
- 빌드 검증: `npm run build` (critical path만)

---

### 4. Implementation Phases

#### Phase 1: Lot 추적 엔진 + 타입
**Goal:** lot 상태 계산 로직과 타입을 분리하여 테스트 가능하게 만든다

- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**Tasks:**
- **🔴 RED (Failing Tests First)**
  - [ ] `lot-tracking-engine.test.ts` 작성
    - lot 상태 계산: active / expiring_soon / expired / depleted
    - lot 정렬: 만료임박 우선 → 활성 → 소진
    - lot summary 집계: 활성/임박/위치미지정 카운트
    - 상태 필터링: status별 필터
  - [ ] Verify tests FAIL

- **🟢 GREEN (Make it Pass)**
  - [ ] `src/lib/inventory/lot-tracking-engine.ts` 구현
    - `LotRecord` 타입 정의 (lotId, itemId, lotCode, qtyOnHand, location, receivedAt, expiresAt, status, sourceDocumentId, lastEventAt)
    - `LotEvent` 타입 정의 (receive, use, move, adjust, dispose)
    - `computeLotStatus(lot)` → status 계산
    - `sortLots(lots)` → 만료임박 우선 정렬
    - `computeLotSummary(lots)` → 활성/임박/위치미지정 카운트
    - `filterLotsByStatus(lots, status)` → 필터
  - [ ] Verify tests PASS

- **🔵 REFACTOR**
  - [ ] 타입을 `types/inventory.ts`로 분리 검토

- **✋ Phase 1 Quality Gate**
  - [ ] All tests pass
  - [ ] TypeScript 타입 체크 통과

---

#### Phase 2: 입고/사용 흐름 AI 해석 엔진
**Goal:** rule-based AI insight 계산 로직을 분리하여 테스트 가능하게 만든다

- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**Tasks:**
- **🔴 RED (Failing Tests First)**
  - [ ] `flow-insight-engine.test.ts` 작성
    - 사용량 급증 탐지 (최근 7일 vs 30일 평균)
    - 만료 임박 lot 우선 소진 필요 감지
    - 재주문 검토 필요 판정 (잔량 ÷ 일평균사용량 < leadTimeDays)
    - 추천 액션 생성 (우선 소진, 재주문, 보류, 점검)
  - [ ] Verify tests FAIL

- **🟢 GREEN (Make it Pass)**
  - [ ] `src/lib/inventory/flow-insight-engine.ts` 구현
    - `FlowInsight` 타입 (type, severity, count, reason, drilldownFilter)
    - `detectAnomalies(inventories, usageHistory)` → FlowInsight[]
    - `generateRecommendations(inventory, lots, recentEvents)` → Recommendation[]
    - `classifyEvent(rawInput)` → { type, confidence, fields }
  - [ ] Verify tests PASS

- **🔵 REFACTOR**
  - [ ] engine 함수를 pure function으로 유지 확인

- **✋ Phase 2 Quality Gate**
  - [ ] All Phase 1 & 2 tests pass
  - [ ] TypeScript 타입 체크 통과

---

#### Phase 3: Lot 추적 UI
**Goal:** P2 placeholder를 실동작 lot list + detail panel로 교체한다

- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**Tasks:**
- **🟢 구현**
  - [ ] `inventory-content.tsx`의 `lot-tracking` TabsContent 교체
    - P2 개발 예정 뱃지 제거
    - 상단 summary cards (활성/임박/위치미지정) → 클릭 시 해당 필터 활성화
    - lot row list 구현
      - 필드: LOT 번호, 품목명, 상태 badge, 현재 수량, 위치, 유효기간, 마지막 이벤트
      - 정렬: `sortLots()` 적용
      - 상태 필터 탭 (전체 / 활성 / 만료임박 / 만료 / 소진)
    - 모바일: 카드 리스트 (각 카드 최소 h-10 터치 타겟)
    - 데스크톱: 테이블 뷰
  - [ ] lot detail panel 구현 (row 선택 시 우측 rail)
    - lot 기본 정보
    - 현재 수량, 위치, 유효기간
    - 상태 badge
    - 최근 이벤트 3~5개 (mock)
    - 다음 액션 버튼: 위치 조정, 수량 조정, 폐기 처리, 사용 기록
  - [ ] 톤맵 적용 (hex 직접 지정, CSS 변수 사용 가능)

- **🔵 REFACTOR**
  - [ ] 모바일 가로 스와이프 패턴 적용 검토 (summary cards)

- **✋ Phase 3 Quality Gate**
  - [ ] Lot 추적 탭이 실동작
  - [ ] summary → row → detail → action 흐름 확인
  - [ ] P2 뱃지 완전 제거 확인
  - [ ] 모바일/데스크톱 반응형 확인

---

#### Phase 4: 입고/사용 흐름 AI 해석 UI
**Goal:** 기존 flow 탭 위에 AI insight strip + rail 강화를 추가한다

- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**Tasks:**
- **🟢 구현**
  - [ ] 상단 AI insight strip 추가
    - `detectAnomalies()` 결과를 compact 카드로 표시
    - 예: `사용량 급증 2건` / `만료 임박 우선 소진 1건` / `재주문 검토 2건`
    - 클릭 시 관련 필터/drilldown 연결
    - signal 색상만 사용 (amber: warning, red: critical, blue: info)
  - [ ] 기존 flow pipeline 카드에 AI 요약 한 줄 추가
    - 각 stage 카드 하단에 `generateRecommendations()` 결과 중 해당 stage 추천
    - 예: "최근 14일 사용속도 기준 6일 내 부족 가능"
  - [ ] rail 강화
    - 품목 선택 시 rail에 추가 섹션:
      - 최근 14/30일 흐름 요약
      - 이상 탐지 결과
      - 추천 액션 + 근거
    - 추천 액션은 항상 이유와 함께 노출
    - 자동 적용 버튼 금지
  - [ ] 톤맵 적용

- **🔵 REFACTOR**
  - [ ] insight strip을 별도 컴포넌트로 분리 검토

- **✋ Phase 4 Quality Gate**
  - [ ] 흐름 탭 상단에 insight 카드 노출
  - [ ] AI 추천이 이유와 함께 표시
  - [ ] 자동 실행 경로 없음 확인
  - [ ] detect → explain → recommend → operator apply 순서 확인

---

### 5. Risk & Rollback Strategy

| Risk | Probability | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| inventory-content.tsx 크기 초과 | High | Med | lot/flow를 별도 컴포넌트로 추출 가능 |
| Mock 데이터와 실제 데이터 불일치 | Med | Low | 타입을 먼저 정의하고 mock이 타입 준수하도록 |
| AI insight가 noise로 느껴짐 | Med | Med | severity 필터 + dismiss 기능 |
| 기존 탭 기능 회귀 | Low | High | Phase 3/4에서 기존 탭 동작 검증 |

**Rollback Plan:**
- Phase 1/2 실패: 엔진 파일만 삭제, UI 영향 없음
- Phase 3 실패: lot-tracking TabsContent를 이전 placeholder로 복원
- Phase 4 실패: flow TabsContent에서 insight 컴포넌트만 제거

---

### 6. Notes & Blockers

- **Implementation Notes:**
  - 기존 `ContextLotInfo` 타입이 이미 `inventory-context-panel.tsx`에 있음 (status: active/expiring/expired/depleted)
  - `InventoryTable`이 이미 ProductGroup → lots[] 구조로 lot 그룹핑 지원
  - Mock 데이터는 기존 inventory-content.tsx의 MOCK_INVENTORIES 패턴 재사용
  - DB 마이그레이션 없이 클라이언트 사이드 계산으로 v1 완성
