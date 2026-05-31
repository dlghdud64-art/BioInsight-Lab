# Truth Reconciliation: §11.331 구매 운영 통합 (read-only audit)

- **Status:** ✅ Audit 완료 (코드 변경 0) — 2026-06-01
- **Type:** Truth Reconciliation (SPEC 발행 전 선행 진단)
- **Scope:** /dashboard/quotes · /dashboard/purchases · /dashboard/purchase-orders

## 0. 3화면 실존 + 규모

| 화면 | 경로 | 라인 | 정체성 |
| :-- | :-- | :-- | :-- |
| 견적 관리 | `src/app/dashboard/quotes/page.tsx` | 4425 | 견적 발송·회신 추적·비교 (대형) |
| 구매 운영 | `src/app/dashboard/purchases/page.tsx` | 1657 | 견적→발주 전환 (Queue+Rail+Tab 보유) |
| 발주 관리 | `src/app/dashboard/purchase-orders/page.tsx` | 846 | 발주 추적 |
| (견적 상세) | `src/app/dashboard/quotes/[quoteId]/page.tsx` | 31 | 얇은 래퍼 |

## 1. 메뉴 구조 (dashboard-sidebar.tsx)

- 73-91행: **견적 관리**(`/dashboard/quotes`) · **구매 운영**(`/dashboard/purchases`) · **발주 관리**(`/dashboard/purchase-orders`) 3개 모두 등록.
- ⚠️ **§11.55 이력 발견**(주석 84-91): 발주 관리 dead-end를 **이미 한 번 정리**한 lineage. "구매 운영(견적→발주 결정) vs 발주 관리(발주 추적)" 정체성 분리를 의도적으로 유지 중. → §11.311(발주→견적 흡수 시도)과 같은 계열. **§11.331 통합은 이 과거 결정의 재역전**이므로 충돌 가능성 명시 필요.

## 2. "견적 상세" 점프 버그 — root cause 확정

- `purchases/page.tsx:891` — `<Link href={`/dashboard/quotes/${item.id}`}>` "견적 상세" 버튼 = **하드 페이지 이동**(견적 관리로 이탈). = 호영님 스크린샷 1780242756055 현상.
- `purchases/page.tsx:1500` — Rail 패널 안에도 동일 "견적 상세 페이지 열기" `<Link>` 동일 점프.
- **핵심**: 구매 운영에는 이미 **Rail 패널 인프라 존재**:
  - `selectedId` state(142) + `selectedItem`(477) + `closeRail`(482) + Rail 렌더(922-).
  - 카드 클릭 → `setSelectedId(item.id)`로 Rail 열림(753, 842, 856).
  - Rail은 `useQuery`로 견적 컨텍스트(brief/blocker/nextAction) fetch(488-497).
- → 점프 버그 수정 = "견적 상세" Link를 **Rail 열기/확장으로 교체**하는 국소 작업. **화면 신설 불필요**(§11.330 패턴 이미 충족).

## 3. 탭 인프라 (purchases)

- `QueueTab` type(97) + `queueTab` state(141) + 서버 preference 동기화(159-169, `purchasesFilter.queueTab`).
- 탭 라벨: "발주 전환 대기 / 발주 승인 대기 / 발주 확정 / 공급사 통보 완료"(100-103).
- → 구매 운영은 **이미 발주 라이프사이클 탭 보유**. §11.331의 "견적/발주 전환/발주 추적" 세그먼트 통합은 이 인프라 확장으로 가능.

## 4. Chosen Source of Truth + 통합 난이도 재평가

- **점프 버그(3-2)**: 국소 수정(P1, 2~3h). Link→Rail. §11.330 패턴 이미 존재. **즉시 가능**.
- **메뉴 통합(견적·발주 흡수, 3-3)**: **대형**. quotes 4425줄 흡수는 same-canvas 탭 통합이라도 큰 리스크. §11.55 과거 결정 역전 + 3화면 상태/라우팅 재배선. **별도 큰 batch**.

## 5. 권장 분할 (호영님 결정)

| 트랙 | 범위 | 난이도 | 비고 |
| :-- | :-- | :-- | :-- |
| **§11.331-a** | "견적 상세" 점프→Rail 교체 (구매 운영 컨텍스트 유지) | 소(P1) | §11.330 Rail 재사용, 화면 0 신설 |
| **§11.331-b** | 견적 관리 + 발주 관리 → 구매 운영 탭 흡수 + URL redirect | 대 | §11.55 역전 충돌 검토 필수, 별도 batch |

- **권장**: a 먼저(즉효·저위험), b는 §11.55 lineage 충돌 결론 후 별도. 호영님이 "옵션 A 흡수"를 확정했으므로 b도 진행이나, a를 선행해 점프 버그부터 해소.

## 6. Out of Scope (audit 단계)
- 코드 변경 0. SPEC/PLAN은 호영님 a/b 분할 승인 후.
