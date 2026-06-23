# PLAN — §inventory-redesign A-①' 우측 패널 통합 (운영 브리핑 + 재고 운영 도우미 → 단일 패널)

작성: 2026-06-23 · 상태: **승인 대기(착수 전)** · 분류: 프론트엔드(스키마 무관) · 면적: 대(大)

## 0. 배경 / 문제

재고 화면 우측에 **2계통 패널**이 진입 맥락에 따라 따로 뜸:

- `InventoryContextPanel` (`components/inventory/inventory-context-panel.tsx`) — **상세보기** 진입(`openContextPanel`). 상태배너 + 재고현황 metrics + 리스크 + Lot + 연결흐름 + onReorder/onEdit/onDispose/onAssignLocation.
- `InventoryAiAssistantPanel` (`components/ai/inventory-ai-assistant-panel.tsx`) — **재발주** 진입(`aiPanel.preparePanel`, onReorder). state 머신(empty/loading/success/warning_shortage/warning_expiry/error) + 부족 요약 + **reorderRecommendation 엔진** + 유효기간 + onReviewReorder.

→ 같은 정보(안전재고·부족·Lot·재발주)를 두 패널이 따로 표시 = 시안 ① "단일 패널, 진입 맥락에 따라 상단 강조 순서만 다르게".

주의: ContextPanel은 이미 내부적으로 `below_safety` 리스크를 단일 상태배너로 흡수(visibleRisks에서 제외) → **패널 내 3중 배너는 이미 해소**. 남은 중복의 실체 = **두 패널 병존**.

## 1. 목표 / 비목표

목표:
- 재고 우측 패널을 **단일 컴포넌트**로 통합. 진입 맥락(`mode: 'detail' | 'reorder'`)에 따라 상단 강조(섹션 순서)만 분기.
- 안전재고 경고 = 단일 배너(canonical `currentQuantity`/`safetyStock` 파생).

비목표(Out of Scope):
- 스키마/마이그레이션(⑤ GMP·⑥ trackingMode) — 별도 Phase B.
- AI narrative 생성 로직 변경(있다면 그대로 흡수, 재구현 0).
- inventory-main.tsx(미라우트 legacy) 정리.

## 2. 정본 패널 결정

**정본 = `InventoryContextPanel`** (이유: 상세/Lot/리스크/흐름/위치지정 등 구조가 더 포괄적이고 A-②③④가 이미 여기 land됨). AiAssistantPanel의 고유 자산(reorderRecommendation 엔진·onReviewReorder)을 ContextPanel로 **흡수**.

AiAssistantPanel 파일은 **삭제하지 않음**(다른 surface에서 참조 가능성 — 사용처 전수 grep 후 inventory 트리거만 retire). canonical 보호 + rollback 용이.

## 3. 흡수 매핑

| AiAssistantPanel 자산 | ContextPanel 흡수 방식 |
|---|---|
| state 머신(shortage/expiry/...) | ContextPanel은 이미 canonical 파생 상태배너 보유 → `mode==='reorder'` 시 배너 톤/문구를 부족 강조로 |
| `reorderRecommendation`(권장수량·벤더·이력) | ContextPanel에 "재발주 우선순위" 섹션 신규(시안 ReorderBlock). `mode==='reorder'`면 metrics보다 위로 |
| `onReviewReorder` | 기존 `onReorder` 콜백으로 통일(재발주안 검토 라우팅) |
| 부족 요약 metrics | ContextPanel 재고현황 metrics와 중복 → 단일 |
| 유효기간 블록 | ContextPanel Lot/만료(A-④ 상대표현)와 통합 |

진입 라우팅 변경: inventory-content의 `onReorder`(현 AiAssistant 진입) → `openContextPanel('reorder')`로 변경, ContextPanel에 `mode` prop 추가.

## 4. Phase 분해 (TDD · quality gate · 각 배치 churn 0)

- **P1 — ContextPanel `mode` prop + 섹션 순서 분기**: `mode:'detail'|'reorder'` 추가(default detail, 회귀 0). reorder 시 ReorderBlock 우선. 신규 sentinel: mode 분기·기존 detail 보존. gate: vitest+build.
- **P2 — reorderRecommendation 흡수**: AiAssistant의 추천 데이터 소스(reorder-recommendations query)를 ContextPanel에 주입, ReorderBlock 렌더. 가짜 추천 0(canonical query). gate.
- **P3 — 진입 라우팅 전환**: inventory-content `onReorder` → `openContextPanel('reorder')`. AiAssistantPanel inventory 트리거 retire(파일 보존). 사용처 grep로 타 surface 영향 0 확인. gate.
- **P4 — 단일 배너 정합 + 정리**: 배너 단일화 확인, 미사용 import/state 정리, sentinel 최종. gate.

각 Phase 독립 커밋(operator 게이트, 누적 0).

## 5. canonical / honesty 가드

- 배너·metrics·재발주 수량 전부 canonical 파생(`currentQuantity`/`safetyStock`/reorder query). 날조 0.
- reorder 추천은 실 query(`["reorder-recommendations"]`)만 — 미연결 시 정직 표기("추천 준비 중"), 가짜 수량 0.
- dead button 0: 흡수한 CTA(재발주안 검토·벤더·이력) 전부 실 핸들러 연결 확인.
- §11.302 신호색 준수(amber/orange 0).

## 6. Rollback

- 각 Phase 단일 커밋 → revert 단순.
- AiAssistantPanel 파일 보존 + import만 제거 → 라우팅 1줄 복구로 즉시 원복.
- `mode` default 'detail' → P1만 land 시 기존 동작 불변.

## 7. Sentinel / 회귀

- 보호 대상: inventory-context-panel-restructure-320(배너 3분기·KPI testid)·inventory-lot-coa(realLots·restockId)·lot-issue-badge. 전부 readFileSync — 흡수는 additive로 GREEN 유지, 옛 markup 삭제 0.
- AiAssistantPanel 사용처: P3 전 전수 grep(inventory 외 참조 시 retire 범위 축소).
- 신규 sentinel: §inventory-panel-unify(mode 분기·reorder 흡수·단일 배너·AiAssistant inventory 트리거 0).

## 8. 리스크

- AiAssistantPanel 고유 AI narrative 손실 → 흡수 매핑(P2)에서 narrative 섹션 보존 명시. 불확실 시 P2 전 narrative 소스 재확인.
- reorder query 주입 경로 차이 → P2에서 실 query 연결 검증(가짜 0).
