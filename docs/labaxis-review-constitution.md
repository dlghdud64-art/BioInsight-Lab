# LabAxis Review Constitution

This document is the shared operating contract for LabAxis review agents, pilot agents, and human reviewers.

## Product Definition

LabAxis is a research procurement operations OS for research labs, biotech, pharma, hospitals, and clinical procurement teams.

It is not a simple landing page, generic SaaS dashboard, or disconnected AI showcase. The core chain is:

Search -> Compare -> Request Quote -> Re-request / Reopen -> Approval -> PO -> Dispatch -> Supplier Confirmation -> Receiving -> Available Stock -> Reorder -> Repurchase Re-entry

## Review Axes

Every judgment must map to these six axes:

- Strategy: does this strengthen LabAxis as a research procurement operations OS?
- Operations: can an operator immediately understand the next action, blocker, and handoff?
- Product: does this preserve the procurement-to-inventory chain rather than becoming a standalone feature page?
- UX/UI: does the screen preserve workbench grammar, information hierarchy, and decision clarity?
- Conversion: does the user know what to do next without visual or conceptual noise?
- Finance: does this protect budget visibility, approval control, spend risk, and auditability?

## Absolute Non-Regression Rules

- Keep the existing workbench / queue / rail / dock structure.
- Do not regress into page-per-feature navigation for compare, request, review, or reopen flows.
- Keep one canonical source of truth per operational step.
- Do not let preview state overwrite actual truth.
- Do not expose AI as a separate chatbot UI.
- AI must remain tri-option decision support with human review before application.
- Never expose dead buttons, placeholders, debug labels, raw internal keys, or unclear global icons.
- Do not rewrite working structures without an explicit product reason.
- Treat budget, approval, PO, supplier-send, receiving, stock, and reorder state as financial and operational control surfaces, not decorative dashboard data.

## Workbench Grammar

- Center work window = decision.
- Right rail = preview, context, provenance.
- Dock = action.
- Compare / request / review flows prefer same-canvas transitions over full page jumps.
- Center decision surfaces are preferred over modal or popup flows.
- Rail and center must not repeat the same information.

Information priority:

1. Decision header
2. Blocker summary
3. Delta-first compare or decision content
4. Sticky dock action

## AI Rules

- AI is an operations layer, not a showcase.
- AI should prepare comparison, judgment, and next-work setup.
- AI must present three decision options when a decision is being supported.
- AI must not auto-select, auto-send, auto-commit, or bypass actual source of truth.
- AI output must be reviewed by the operator before it changes operational truth.

## Status vs Action

Status labels describe truth. Action labels describe what the operator can do next.

Examples:

- Status: expired, blocked, hold, missing MSDS, supplier pending.
- Action: dispose lot, request quote, reopen compare, run MSDS check, ask supplier, approve exception.

Do not repeat action needs as passive text when they should surface as row CTA, priority banner, or dock action.

## Agent Output Contract

All review and pilot agents must use this shape:

```md
## Priority Judgment
- Highest priority: P0/P1/P2/P3/P4/None
- Axis: Strategy / Operations / Product / UX/UI / Conversion / Finance
- Release recommendation: go/revise/hold

## Core Judgment
- Problem: Highest-risk issue first.
- User impact: What task, trust, cost, approval, or handoff is affected.

## Fix Proposal
1. Target
2. Problem
3. Change
4. Remove
5. Alternative
6. Verification
7. Done
```

Findings must be concrete enough for a builder agent or engineer to implement with a minimal diff.

