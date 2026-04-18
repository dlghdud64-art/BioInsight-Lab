# Durable Audit Sink — 운영 규칙

> Batch 6에서 확립. 이 규칙은 코드 리뷰, 운영 판단, 추후 배치 설계의 기준선입니다.

## 1. Append-Only 원칙

`MutationAuditEvent` 테이블은 **INSERT + SELECT only**.
UPDATE, DELETE, TRUNCATE는 어떤 경우에도 금지합니다.

- migration으로도 기존 row를 변경하지 않습니다.
- 잘못된 기록이 발견되면 보정 row를 새로 INSERT하고, `compensatingForEventId`로 연결합니다.
- soft delete도 없습니다. `result: 'error'`로 기록하면 됩니다.

## 2. 운영용 Audit Read Path

운영용 조회 · 감사 · 내보내기 · 정합성 판단은 **`MutationAuditEvent` 테이블만** source로 사용합니다.

- `audit-integrity-engine.ts`의 in-memory AuditEnvelope은 request-scoped chain입니다.
  전환기에는 병존하되, 운영 판단에는 durable 테이블만 참조합니다.
- in-memory envelope과 durable audit을 섞어 읽으면 중복 계수와 진실 분리가 발생합니다.
- 추후 감사 내보내기, SIEM 연동, admin audit 뷰 등은 모두 `MutationAuditEvent` 기반으로 구축합니다.

## 3. auditEventKey 조합 규칙

### 형식

```
{orgId}:{entityId}:{action}:{suffix}
```

| 세그먼트 | 의미 | 예시 |
|---|---|---|
| orgId | 조직 ID. org 미확정 시 `'no-org'` | `org-abc123` |
| entityId | mutation 대상 entity의 primary ID | `req-xyz`, `ord-456`, `inv-789` |
| action | route별 고정 action string (아래 표) | `purchase_request_approve` |
| suffix | 동일 entity+action 내 구분자. 기본값 `'1'` | `cat-reagents`, `1` |

### Route별 고정 Action String

| Route | action | entityId source | 비고 |
|---|---|---|---|
| `/api/request/[id]/approve` | `purchase_request_approve` | requestId | — |
| `/api/request/[id]/cancel` | `purchase_request_cancel` | requestId | — |
| `/api/request/[id]/reverse` | `purchase_request_reverse` | requestId | compensatingForEventId → approve key |
| `/api/admin/orders/[id]/status` (CANCELLED) | `order_cancelled_po_void` | orderId | compensatingForEventId → approve key |
| `/api/purchases/[id]/reclass` | `purchase_record_reclass` | recordId | — |
| `/api/invites/accept` | `workspace_invite_accept` | inviteId | — |

### 변경 금지 사유

이 키 조합 규칙을 변경하면:
- 기존 idempotency guard가 깨집니다 (같은 mutation에 다른 키 → 중복 기록).
- 또는 다른 mutation이 같은 키 → 서로 차단.
- `compensatingForEventId` 참조가 끊깁니다.

키 규칙 변경이 불가피하면, 마이그레이션 계획과 함께 별도 배치로 처리합니다.

## 4. Route Coverage Matrix Durable 구분

route coverage matrix (`BATCH8_ROUTE_COVERAGE_MATRIX.md`)의 `Audit Present` 컬럼은 세 단계로 구분합니다:

| 표기 | 의미 |
|---|---|
| `✗` | audit 미구현 |
| `✓` (기존) | in-memory envelope만 존재 (enforcement.complete → appendAuditEnvelope) |
| `✓ Durable` | `MutationAuditEvent`에 기록됨 (code-complete, migration 여부는 별도) |
| `✓ Migrated` | 대상 DB에 테이블 생성 + smoke run 통과 = 실운영 live |

현재 Batch 6 기준:
- **Durable**: 6건 (approve, cancel, reverse, po_void, reclass, invites/accept)
- **Migrated**: 0건 (DB migration pending)
