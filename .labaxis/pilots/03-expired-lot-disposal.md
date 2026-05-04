# Pilot Scenario: Expired Lot -> Disposal -> Reorder Review

## User Role

Lab manager.

## Goal

Find an expired lot with remaining quantity, dispose it, and review reorder impact.

## Starting State

Inventory contains at least one expired lot with `qty > 0`.

## Steps

1. Open inventory.
2. Identify the top priority expired lot.
3. Open disposal action.
4. Review lot ID, quantity, expiry, location, reason, and stock impact.
5. Confirm disposal.
6. Continue to reorder review if stock falls below safety level.

## Success Criteria

- `만료` and `사용 금지` appear as status.
- `폐기 처리` appears as the action.
- Disposal is prioritized above reorder.
- Reorder appears only as post-disposal secondary action.

## Failure Signals

- `폐기 필요` is repeated as passive text instead of action.
- Reorder is primary before disposal is resolved.
- Disposal CTA is clickable but not implemented.
- The dock lacks safety stock impact.

