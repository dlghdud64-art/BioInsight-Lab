# Dispatch v2 Chain — Stage Truth Map

> 각 stage가 무엇을 처음 쓰고, 무엇을 읽기만 하고, 무엇이 금지되는지의 canonical reference.
> 이 문서의 내용은 엔진 코드의 JSDoc과 일치해야 하며, 불일치 시 이 문서를 기준으로 코드를 수정합니다.

## Post-Fire Chain (Sent → Receiving → Stock Release)

| Stage | Single-Writer Truth | Input Source (Read Only) | Forbidden Bypass |
|---|---|---|---|
| `actual-send-fired-transaction` | `SentStateRecordV2` (sentStateCommitted, firedPayloadSnapshot, firedAuthorizationSnapshot, sendTransactionId) | FireSession (fire_ready_pending_ignition) | duplicate fire, sent truth 분산 write |
| `sent-outcome-workspace` | 없음 (read-only surface) | SentStateRecordV2 | sent truth 재작성, tracking/ack truth 미리 확정 |
| `delivery-tracking-resolution` | `DeliveryTrackingSessionV2.currentDeliveryStatus`, tracking exception | SentStateRecordV2, DeliveryTrackingRecordV2 | sent truth 수정, supplier ack truth 선행 확정 |
| `supplier-ack-resolution` | `ackClassification`, `receivingReady`, `nextHandoffTarget`, `acceptedLineSet` (CanonicalProcurementLineRef[]) | SentStateRecordV2, AckRecord | auto_create_receiving_preparation, auto_advance_to_stock_release, modify_sent_state_record |
| `receiving-preparation-resolution` ⚠️ WRITE-PATH | `etaWindow`, `shipmentReferenceSet`, `missingInputs`, `executionAllowed` | CanonicalProcurementLineRef[] (from ack), operator input | ack truth 재해석, receiving execution 직접 진입 |
| `receiving-execution-resolution` ⚠️ WRITE-PATH | `lineRecords[].actualReceivedQty`, lotNumber, expiryDate, lineReceiptStatus, damage/discrepancy/substitute flags | ReceivingPrepSession.receivingExpectedLineSet (CanonicalProcurementLineRef) | stock release 직행 |
| `receiving-variance-disposition` ⚠️ WRITE-PATH | `lineDispositions[].disposition`, releasableQty, holdQty, rejectedQty, `stockReleaseAllowed` | ReceivingExecSession.lineRecords (actual receipt truth) | stock release 직접 실행 |
| `stock-release-handoff-gate` | 없음 (gate만) | DispositionSession (stockReleaseAllowed, totalReleasableQty) | disposition 미완료 시 stock release 진입 |

## Ack Followup Branch

| Stage | Single-Writer Truth | Input Source (Read Only) | Forbidden Bypass |
|---|---|---|---|
| `ack-followup-resolution` | followupContent, responseClassification, `receivingReadinessCheck` (ReceivingReadinessCheckV2) | AckResolutionSession | readiness check 없이 resolve_as_confirmed_ready (P0 fix 적용) |

## Exception / Recovery Fabric

| Stage | Single-Writer Truth | Input Source (Read Only) | Forbidden Bypass |
|---|---|---|---|
| `dispatch-exception-recovery` | `DispatchExceptionRecordV2` (status, recoveryAction, returnToStage) | 각 stage session | ALLOWED_RETURN_TARGETS matrix 외 return (P1 fix 적용) |

## Line Identity Chain

```
CanonicalProcurementLineRef (lineRefId, sourcePoLineId, productIdentity, expectedQty, unit)
↓
ack-resolution.acceptedLineSet: CanonicalProcurementLineRef[]
↓
receiving-prep.receivingExpectedLineSet: CanonicalProcurementLineRef[]
↓
receiving-exec.lineRecords[].lineId = lineRef.lineRefId, expectedQty = lineRef.expectedQty
↓
variance-disposition.lineDispositions[].lineId = exec.lineRecords[].lineId
↓
stock-release-gate reads disposition.totalReleasableQty
```

## Key Invariants

1. **confirmed ≠ receiving-ready**: ack confirmed classification만으로 receiving prep 진입 금지. ReceivingReadinessCheckV2 7개 criteria 모두 통과 필수.
2. **receiving ≠ releasable**: receiving execution 후 stock release 직행 금지. variance disposition 경유 필수.
3. **followup ≠ shortcut**: followup 경유여도 canonical readiness gate 재통과 필수 (P0 fix).
4. **recovery ≠ bypass**: exception return은 ALLOWED_RETURN_TARGETS matrix 내에서만 (P1 fix).
5. **sent ≠ dispatched ≠ tracking ≠ ack**: 4개 truth layer 각각 독립.

## Verification Score (Post-Hardening)

| Check | PASS | WARNING | ISSUE |
|---|---|---|---|
| Single-Writer Truth | 9 | 0 | 0 |
| Line-Level Identity | 4 | 0 | 0 |
| Recovery Bypass | 3 | 0 | 0 |
| Resolution/Mutation Boundary | 3 | 0 (JSDoc 명시 완료) | 0 |
| **Total** | **19** | **0** | **0** |
