# Pilot Scenario: MSDS Risk -> Safety Check

## User Role

Safety officer.

## Goal

Identify missing or expired MSDS items and start the safety check flow.

## Starting State

Safety page contains one or more high-risk or missing-MSDS items.

## Steps

1. Open safety management.
2. Read the top alert.
3. Identify high-risk rows.
4. Start MSDS check.
5. Confirm the check surface shows affected items and next action.

## Success Criteria

- Red is used for risk status.
- Blue is used for the action CTA.
- The top alert does not hide unresolved risk with a meaningless dismiss.
- Row status chips identify actual material risk.

## Failure Signals

- Red is used for both risk and normal actions.
- MSDS action is a dead button.
- Alert dismisses without state meaning.
- Risk rows are visually indistinguishable from normal rows.

