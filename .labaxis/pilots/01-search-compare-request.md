# Pilot Scenario: Search -> Compare -> Request

## User Role

Procurement operator.

## Goal

Find PBS buffer, compare at least two candidates, and prepare a quote request.

## Starting State

User is on the sourcing search surface with no selected candidates.

## Steps

1. Search for `PBS buffer 10x 500ml`.
2. Select candidates for comparison.
3. Review comparison deltas.
4. Choose a request-ready candidate.
5. Start quote request preparation.

## Success Criteria

- The user can tell which candidates are exact, equivalent, substitute, or blocked.
- The primary CTA moves from compare to request preparation.
- No modal traps the user away from the workbench.
- The request handoff preserves selected candidates and compare rationale.

## Failure Signals

- User cannot tell which candidate to choose.
- Compare and request are disconnected pages.
- AI selects or sends without review.
- CTA is visible but no-op.

