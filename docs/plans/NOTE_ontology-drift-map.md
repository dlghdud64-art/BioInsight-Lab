# NOTE — 온톨로지 정합 전수 진단 drift 맵 (코드 grep 기반)

- **Status:** 🔍 진단 완료 (read-only, 코드 수정 0). 2026-06-08.
- **대상:** `apps/web/src`. grep 기반 신호 — *식별자 vs 사용자노출/필드명* 구분이 필요한 항목은 "표본 확인 요" 표기.
- **목적:** 재진단 방지 자산 + 정본화 planner 입력. drift 확정 건은 새 세션 트랙 A/B로 통합 설계.

---

## 진단 결과 (7항목)

### 1. 상태 enum 단일 소스 — 부분 drift
- DB enum 정본 존재: `QuoteStatus`(schema L656), `OrderStatus`(L1757).
- 그러나 `@prisma/client`서 status import = **7파일뿐**, status string-literal 직접 비교/배열 = **57건**. enum 존재하되 전역 강제 안 됨.
- 한글 라벨 하드코딩은 경미(회신대기 2·입고인계 1·발주전환 1). stage 라벨 정의는 `lib/ai/*`+`lib/ontology/*` 분산.
- **판정: 부분 drift(추정 — 57건 표본 확인 권장). 본질 = string-literal status 남용(라벨 아님).**

### 2. 단계 전이 정합 — drift 확정 (최심각·구조적)
- 전이 맵(`SIMPLE_STATUS_TRANSITIONS`/`isValidStatusTransition`)은 `lib/notifications`에만(알림 전용 격리) + incident(별 도메인).
- **API 라우트의 정본 전이맵 importer = 0.** 주문/견적 상태변경 라우트 어디도 공통 전이 규칙 미사용 → 라우트별 하드코딩 비교(`orders/[id]` `before.status !==` 등).
- **판정: 도메인 전이 authority 부재 = drift 확정.** 같은 전이를 라우트마다 자체 판단 → canonical truth 무결성 보증 0. "새 기능마다 재발"의 구조 진원.

### 3. resolver 입출력 정합 — 대체로 정합
- `lib/ops-console/*` 정본을 11개 surface 공유(ops-store/inbox-adapter/dashboard-adapter) + `ontology-next-action-resolver` 정본 존재. 병렬 집계 엔진을 surface 직접 사용 = 1건뿐.
- **판정: 대체로 정합.** 단 `ops-console` ↔ `ontology-next-action-resolver` 2정본 상호 정합(같은 입력→같은 nextAction)은 별도 검증 건(§11.361·§11.364).

### 4. 한글 라벨 일관성 — drift 추정 (표본 확인 요)
- 영문: Reopen 383·Sourcing 219·Triage 47·Substitute 32·Exact Match 9·Equivalent 8·High Fit 1.
- 한글: 대체 110·소싱 53·재개 25·동등 10·선별 6·적합도 3·정확 일치 2·변동 우선 1.
- ⚠️ 영문 hit엔 코드 식별자(`sourcing`/`REOPEN` 변수·enum)가 섞여 grep이 라벨/식별자 구분 불가.
- **판정: drift 추정. .tsx JSX 텍스트 한정 재검(표본) 후 확정.**

### 5. 동의어 drift — drift 확정 (구조적)
- 주체: owner 469 / requester 150 / manager 125.
- 거래처: vendor 1700 / 공급사 994 / supplier 431 / 거래처 26.
- 수량: quantity 418 / qty 129 / 수량 286 (count 638은 집계 의미, 별개).
- **판정: 확정.** vendor/supplier(코드 필드)·owner/requester/manager(주체)·qty/quantity(필드명) 혼재. #1과 같은 "용어 정본화" 토양.

### 6. 재고 우선순위(만료>reorder) — 정합 추정
- `lib/inventory/disposal-readiness.ts` 전용 정본 존재 + inventory-content/main이 expired↔reorder 정렬.
- **판정: 정합 가능성 높음(disposal-readiness 내용 확인 시 확정). §11.360·§11.362 연계.**

### 7. 구매단계 requester-centric — 약반영 (위반 잔존 0)
- purchase surface에 buyer/purchaser/구매자/발주자 **0건**(ontology 위반 잔존 없음, 긍정).
- requester 노출 = 1건뿐 = subject 용어 적극 미사용.
- **판정: drift 아님. requester 중심 적극 반영 여부 표본 확인 요.**

---

## drift 맵 요약

| 항목 | 판정 | 트랙 |
| :-- | :-- | :-- |
| #2 전이 authority 부재 | drift 확정·최심각 | A 상태/전이 정본화 |
| #1 string-literal status 57 | 부분 drift | A 상태/전이 정본화 |
| #5 동의어(vendor/owner/qty) | drift 확정 | B 용어 정본화 |
| #4 영문 라벨 잔존 | drift 추정(표본 요) | B 용어 정본화 |
| #3 resolver 2정본 | 대체로 정합 | 상호검증(별건) |
| #6 재고 우선순위 | 정합 추정 | 확인만 |
| #7 requester-centric | 약반영(위반 0) | 확인만 |

---

## 정본화 트랙 (planner, 승인 후·라이브 안정화 뒤 — 즉시 코드 금지)

### 트랙 A — 상태/전이 정본화 (large scope 6~7 phase)
- #2: 모든 상태변경 라우트가 공통 transition validator(`isValidStatusTransition`류)를 강제 경유 = canonical truth 단일 authority.
- #1: string-literal → enum union type 강제(타입 레벨), 57건 치환.
- 라우트 광범위 touch → **soft_enforce(경고 로깅) → 24~48h 모니터 → full_enforce(차단)** 점진 cutover (planner Migration/Rollout addendum).
- Workflow/Ontology addendum + §11.361·§11.364 ontology 통일 연계.

### 트랙 B — 용어 정본화
- #5: vendor/supplier·owner/requester·qty/quantity 단일화.
- #4: 영문 라벨 → 한글 매핑 완료.
- **선행:** 아래 미결 3건(특히 #4 표본) 확인 후 진입.

---

## 미결 (트랙 B 입력 전 확인)
- #4/#7: .tsx JSX 텍스트 한정 표본 — 라벨 영문 잔존 / requester 중심 반영 확정.
- #3: ops-console ↔ ontology-next-action-resolver 2정본 상호 정합 검증.
- #6: disposal-readiness.ts 내용 — expired가 reorder보다 우선 정렬 확정.

---

## 새 세션 진입 순서 (호영님 확정 2026-06-08, 위→아래)
1. **§11.375 OCR 후단 게이트** — P-라이브 최우선. 작은 diff(OCR 핵심필드 추출 실패 시 "입고 진행" 차단). 재고 오염 즉시 차단. Vivino 완성 전 안전판.
2. **§11.380 Vivino 라벨검출** — feature-planner. 타깃=네이티브(scan.tsx, 햅틱), 검출=저빈도 OCR worker(경량) 권장. 풀블리드(§11.374) 결속.
3. **§11.369-1 클라 409 backoff** — Phase 0 확정분(경로·mutation/entityId·멱등키, `PLAN_11.369-1-...PHASE0.md`) 받아 구현. enforceAction 409 consumer 공통 핸들러(CheckoutDialog L740 패턴 일반화). 라이브 7일 409=0이라 예방적.
4. **트랙 A 상태/전이 정본화** — planner. 라우트 광범위라 라이브 안정화 뒤.
- 정합 묶음 §11.359 nav batch(알림위치·더보기출구·FAB·알림고도화)는 1~4 사이 여유 시.

---

## 세션 미결/대기 (참고)
- §notif 배치(INVENTORY_LOW/ORDER_* 4파일+sentinel) — 커밋·push 대기(클로드코드).
- §11.359-2 nav batch(more-sheet 3파일) — 커밋·push 대기(클로드코드).
- 두 배치 모두 sandbox 편집 완료, 정식 tsc/lint/vitest/build/push는 클로드코드.
