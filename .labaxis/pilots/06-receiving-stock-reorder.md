# Pilot Scenario: Receiving -> Available Stock -> Reorder

## User Role

Lab manager.

## Goal

Receive a shipped item, release it to available stock, and verify reorder state.

## Starting State

There is a dispatched or supplier-confirmed item ready for receiving.

## Steps

1. Open receiving queue.
2. Confirm item, quantity, lot, and location.
3. Mark receiving execution.
4. Release available stock.
5. Review reorder impact.

## Success Criteria

- PO, dispatch, supplier confirmation, receiving, and stock lineage remains visible.
- Received quantity and lot are explicit.
- Available stock updates after operator confirmation.
- Reorder state reflects the updated stock.

## Failure Signals

- Receiving creates stock without operator confirmation.
- Lot or location is missing.
- PO lineage disappears.
- Reorder recommendation ignores newly available stock.

