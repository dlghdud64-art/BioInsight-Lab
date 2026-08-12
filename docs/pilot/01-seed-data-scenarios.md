# Ops Console V1 — Seed / Demo 데이터 시나리오

> 목적: 파일럿 참가자가 콘솔에서 실제 운영 흐름을 검증할 수 있도록
> 7개 시나리오를 시드 데이터로 재현한다.
> AI 품질 검증이 아닌 **운영 흐름 검증**이 목표다.

---

## 공통 전제

| 항목 | 값 |
|------|------|
| 조직 | Demo Lab (seed 기본 조직) |
| Operator | `operator@demo.lab` — REQUESTER 역할 |
| Lead | `lead@demo.lab` — APPROVER 역할 |
| 제품 풀 | PBS 1X, FBS, DMEM, Trypsin, Anti-CD3 항체 (기존 seed) |
| 시간 기준 | 파일럿 당일 = T, 과거 = T-n |

---

## 시나리오 1: Compare-Origin Item

> 콘솔 그룹: `compare_followup` / 타입: `COMPARE_DECISION`

| 필드 | 값 |
|------|------|
| `type` | `COMPARE_DECISION` |
| `taskStatus` | `REVIEW_NEEDED` |
| `approvalStatus` | `NOT_REQUIRED` |
| `substatus` | `decision_pending` |
| `priority` | `MEDIUM` |
| `title` | `PBS 1X vs PBS 10X 비교 판정 대기` |
| `relatedEntityType` | `COMPARE_SESSION` |
| `urgencyReason` | `비교 세션 생성 후 48시간 경과, 판정 미완료` |
| `assigneeId` | `operator@demo.lab` |
| `impactScore` | 45 |
| `urgencyScore` | 55 |
| `metadata.queueItemType` | `ops_quote_followup` |
| `metadata.compareSessionId` | (생성된 CompareSession ID) |

**검증 포인트**
- 운영 큐 → `compare_followup` 그룹에 노출
- 일일 검토 → `overdue_owned` 카테고리에 분류
- Row에 "비교 판정 대기" 상태와 age(48h+) 표시
- Primary CTA: "판정하기" → CompareSession 상세로 이동

---

## 시나리오 2: Purchase Approval Pending

> 콘솔 그룹: `approvals_needed` / 타입: `STATUS_CHANGE_SUGGEST`

| 필드 | 값 |
|------|------|
| `type` | `STATUS_CHANGE_SUGGEST` |
| `taskStatus` | `ACTION_NEEDED` |
| `approvalStatus` | `PENDING` |
| `substatus` | `purchase_approval_required` |
| `priority` | `HIGH` |
| `title` | `FBS 500mL 구매 승인 요청 (₩385,000)` |
| `relatedEntityType` | `QUOTE` |
| `urgencyReason` | `재고 안전 수준 미만, 실험 일정 3일 내` |
| `assigneeId` | `lead@demo.lab` |
| `impactScore` | 70 |
| `urgencyScore` | 80 |
| `metadata.queueItemType` | `ops_purchase_approval` |
| `metadata.quoteId` | (생성된 Quote ID) |
| `metadata.totalAmount` | 385000 |

**검증 포인트**
- 운영 큐 → `approvals_needed` 그룹, `approval_needed` 우선순위 tier
- Lead 콘솔에서 승인 CTA 표시
- Operator 콘솔에서는 "승인 대기" 상태만 표시 (CTA 없음)
- Row에 금액, 사유, 긴급도 표시

---

## 시나리오 3: Receiving Pending

> 콘솔 그룹: `receiving_restock` / 타입: `STATUS_CHANGE_SUGGEST`

| 필드 | 값 |
|------|------|
| `type` | `STATUS_CHANGE_SUGGEST` |
| `taskStatus` | `WAITING_RESPONSE` |
| `approvalStatus` | `APPROVED` |
| `substatus` | `receiving_pending` |
| `priority` | `MEDIUM` |
| `title` | `Trypsin 0.25% 입고 대기 (주문 확인 완료)` |
| `relatedEntityType` | `ORDER` |
| `urgencyReason` | `주문 후 5일 경과, 예상 배송일 초과` |
| `assigneeId` | `operator@demo.lab` |
| `impactScore` | 50 |
| `urgencyScore` | 60 |
| `metadata.queueItemType` | `ops_receiving_pending` |
| `metadata.orderId` | (생성된 Order ID) |
| `metadata.orderedAt` | T-5일 |
| `metadata.expectedDelivery` | T-1일 |

**검증 포인트**
- 운영 큐 → `receiving_restock` 그룹
- 배송 지연 표시 (예상일 초과)
- Primary CTA: "입고 확인" → Order 상세로 이동
- Age 표시: "5일 전 주문"

---

## 시나리오 4: Blocked Item

> 콘솔 그룹: `urgent_blockers` / 우선순위: `urgent_blocker`

| 필드 | 값 |
|------|------|
| `type` | `REORDER_SUGGESTION` |
| `taskStatus` | `BLOCKED` |
| `approvalStatus` | `NOT_REQUIRED` |
| `substatus` | `vendor_unresponsive` |
| `priority` | `HIGH` |
| `title` | `Anti-CD3 항체 재주문 차단 — 벤더 미응답` |
| `relatedEntityType` | `QUOTE` |
| `urgencyReason` | `벤더 응답 7일 초과, 재고 소진 임박 (잔여 2개)` |
| `assigneeId` | `operator@demo.lab` |
| `impactScore` | 85 |
| `urgencyScore` | 90 |
| `metadata.queueItemType` | `ops_quote_followup` |
| `metadata.blockedReason` | `vendor_unresponsive` |
| `metadata.blockedSince` | T-7일 |
| `metadata.inventoryRemaining` | 2 |

**검증 포인트**
- 운영 큐 → `urgent_blockers` 최상단, 빨간 severity border
- 일일 검토 → `urgent_now` 카테고리
- 차단 사유와 기간이 row에 명시
- Primary CTA: "벤더 후속 조치" (followup 동작)
- 에스컬레이션 가능: `escalate_blocked`

---

## 시나리오 5: Handoff Not Accepted

> 콘솔 그룹: `stalled_handoffs` / 타입: `STATUS_CHANGE_SUGGEST`

| 필드 | 값 |
|------|------|
| `type` | `STATUS_CHANGE_SUGGEST` |
| `taskStatus` | `IN_PROGRESS` |
| `approvalStatus` | `APPROVED` |
| `substatus` | `handoff_pending_acceptance` |
| `priority` | `MEDIUM` |
| `title` | `DMEM 견적 검토 — 인수인계 미수락 (→ lead)` |
| `relatedEntityType` | `QUOTE` |
| `urgencyReason` | `인수인계 후 72시간 경과, 미수락` |
| `assigneeId` | `lead@demo.lab` |
| `impactScore` | 55 |
| `urgencyScore` | 65 |
| `metadata.queueItemType` | `ops_stalled_handoff` |
| `metadata.handoffFrom` | `operator@demo.lab` |
| `metadata.handoffTo` | `lead@demo.lab` |
| `metadata.transferredAt` | T-3일 |
| `metadata.acceptedAt` | null |

**검증 포인트**
- 운영 큐 → `stalled_handoffs` 그룹
- 일일 검토 → `handoff_not_accepted` 카테고리
- AssignmentState = `HANDED_OFF` (수락 전)
- Lead 콘솔: Primary CTA = "인수 수락"
- Operator 콘솔: "인수인계 대기 중" 상태 표시
- 에스컬레이션 가능: `escalate_handoff`

---

## 시나리오 6: Remediation Item

> 콘솔 모드: `remediation` / BottleneckClass: `RECEIVING`

| 필드 | 값 |
|------|------|
| `type` | `STATUS_CHANGE_SUGGEST` |
| `taskStatus` | `IN_PROGRESS` |
| `approvalStatus` | `NOT_REQUIRED` |
| `substatus` | `remediation_in_progress` |
| `priority` | `MEDIUM` |
| `title` | `입고 병목 개선 — 평균 입고 대기 4.2일 → 목표 2일` |
| `relatedEntityType` | null |
| `urgencyReason` | `최근 30일 입고 대기 SLA 초과 건 5건` |
| `assigneeId` | `lead@demo.lab` |
| `impactScore` | 60 |
| `urgencyScore` | 40 |
| `metadata.remediationStatus` | `IN_PROGRESS` |
| `metadata.bottleneckClass` | `RECEIVING` |
| `metadata.currentMetric` | 4.2 |
| `metadata.targetMetric` | 2.0 |
| `metadata.affectedItemCount` | 5 |

**검증 포인트**
- 거버넌스/개선 탭에서 노출
- 병목 분류: RECEIVING
- 현재 메트릭 vs 목표 메트릭 표시
- Lead만 조치 가능 (Operator는 읽기 전용)

---

## 시나리오 7: Recently Resolved Item

> 콘솔 그룹: `recently_resolved`

| 필드 | 값 |
|------|------|
| `type` | `VENDOR_RESPONSE_PARSED` |
| `taskStatus` | `COMPLETED` |
| `approvalStatus` | `NOT_REQUIRED` |
| `substatus` | `quote_finalized` |
| `priority` | `LOW` |
| `title` | `피펫팁 1000μL 벤더 응답 완료 — 견적 확정` |
| `relatedEntityType` | `QUOTE` |
| `urgencyReason` | null |
| `assigneeId` | `operator@demo.lab` |
| `impactScore` | 20 |
| `urgencyScore` | 10 |
| `metadata.queueItemType` | `ops_quote_followup` |
| `metadata.resolvedAt` | T-6시간 |
| `metadata.resolvedBy` | `operator@demo.lab` |
| `metadata.resolutionAction` | `quote_finalized` |

**검증 포인트**
- 운영 큐 → `recently_resolved` 그룹 (하단)
- 일일 검토 → `recently_resolved` 카테고리
- 완료 시점과 처리자 표시
- CTA 없음 (또는 "상세 보기" 네비게이션만)

---

## 시드 데이터 투입 순서

```
1. CompareSession 생성 (시나리오 1용)
2. Quote 2건 생성 (시나리오 2, 5용)
3. Order 1건 생성 (시나리오 3용)
4. AiActionItem 7건 생성 (위 시나리오 순서대로)
5. 파일럿 참가자 계정 확인 (operator, lead)
```

## 데이터 초기화

파일럿 반복 수행 시 시드 데이터를 리셋하려면:
```sql
-- 파일럿 시드 아이템만 삭제 (metadata.pilotSeed = true 기준)
DELETE FROM "AiActionItem" WHERE metadata->>'pilotSeed' = 'true';
```

> 모든 시나리오의 `metadata`에 `"pilotSeed": true`를 포함하여 파일럿 데이터를 구분한다.
