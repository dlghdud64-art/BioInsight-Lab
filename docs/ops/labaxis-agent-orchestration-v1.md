# LabAxis Agent Review Board v1

This is the first operating model for agents that review LabAxis work.

## Goal

Use multiple agents to catch different classes of regression before work reaches production:

- structural regression
- operational confusion
- UX workbench drift
- dead or unclear action surfaces
- weak user-pilot completion
- release-risk ambiguity

Agents do not make final production decisions. They provide evidence and recommendations. A human operator approves release.

## Board Roles

- Structure Guard: canonical source of truth, handoff lineage, mutation boundary, preview truth separation.
- Ops Guard: blocker clarity, next action, queue / rail / dock role separation, procurement chain continuity.
- UX Guard: workbench grammar, visual hierarchy, color semantics, CTA clarity, modal / page regression.
- Pilot User: scenario execution from a specific user perspective.
- Release Arbiter: synthesizes findings into go, revise, or hold.

## Execution Flow

1. Builder submits the change summary and changed file list.
2. Structure Guard reviews contracts and state boundaries.
3. Ops Guard reviews operational flow and next actions.
4. UX Guard reviews screen grammar and visual decision hierarchy.
5. Pilot User runs one or more scenario scripts.
6. Release Arbiter merges findings and chooses a release recommendation.

## Required Inputs

- Change summary
- Changed file list
- Screenshots or route names for UI work
- Source of truth objects touched by the change
- Mutations or APIs touched by the change
- Intended user scenario

## Required Outputs

Every agent must include:

- 핵심 판단
- 수정 대상
- 문제
- 변경점
- 제거 대상
- 대체안
- 검증 기준
- 완료 조건

The Release Arbiter must also include:

- Decision: go / revise / hold
- Production risk
- Required follow-up before merge or deploy

## Human Gate

The following actions require human approval:

- production push
- destructive data mutation
- migration execution
- source of truth rewrite
- bypassing a blocker
- changing AI from review support to auto-apply behavior

