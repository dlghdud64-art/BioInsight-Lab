# LabAxis Release Gate

Use this gate before merging or deploying material LabAxis changes.

## Go

The change can ship when all are true:

- No source-of-truth ambiguity.
- Preview state cannot overwrite actual truth.
- No dead button, placeholder, raw key, or unclear icon remains in the changed surface.
- Workbench grammar is preserved where applicable.
- Next action is visible within three seconds.
- AI output, if present, remains human-reviewed before application.
- Pilot scenario reaches a clear completion state.

## Revise

The change needs revision when any are true:

- Operator can proceed but the next action is visually unclear.
- Status and action labels are mixed.
- Rail and center duplicate the same content.
- Color semantics compete with CTA hierarchy.
- A pilot can complete the task but needs guessing or backtracking.
- There are non-blocking test gaps with clear mitigation.

## Hold

The change should not ship when any are true:

- Source of truth is unclear or duplicated.
- Preview can commit or overwrite actual state.
- AI auto-selects, auto-sends, or auto-commits without review.
- A critical action is clickable but not implemented.
- Compare / request / review flow regresses to a disconnected page or modal pattern without product approval.
- Pilot scenario cannot complete.
- Migration, authorization, or production-data risk is unresolved.

## Release Arbiter Summary Format

```md
## Decision
go / revise / hold

## Why
One paragraph.

## Blocking Findings
- Finding with file/route/screen evidence.

## Required Minimal Diff
- Concrete change.

## Verification
- Command, screenshot, or pilot scenario to rerun.
```

