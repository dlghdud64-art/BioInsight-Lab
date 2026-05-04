# Pilot Scenario: Quote Work Queue -> Supplier Dispatch

## User Role

Procurement operator.

## Goal

Open a quote work queue item, resolve blockers, and send a supplier request.

## Starting State

There is at least one quote queue item that needs supplier dispatch.

## Steps

1. Open the queue item.
2. Review dispatch readiness.
3. Confirm supplier contact availability.
4. Review draft message.
5. Send request to selected supplier.

## Success Criteria

- Hard blockers prevent actual send.
- Missing supplier or invalid email appears as a blocker before API submission.
- The send CTA is active only when the request is valid.
- Success or partial success is reported with exact counts.

## Failure Signals

- Invalid request reaches the API.
- Warning appears but primary send remains active.
- Supplier selection is unclear.
- Draft preview commits without review.

