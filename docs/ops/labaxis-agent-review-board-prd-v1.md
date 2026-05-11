# LabAxis Agent Review Board PRD v1

## 1. Problem

LabAxis is a research procurement operations OS for research labs, biotech, pharma, hospitals, and clinical procurement teams. A small UI or state change can break source-of-truth lineage, handoff clarity, action hierarchy, or operator trust.

Manual review alone is not enough because LabAxis changes must be checked across six axes every time:

- Strategy
- Operations
- Product
- UX/UI
- Conversion
- Finance

The current risk is that builder agents can optimize a single screen while accidentally weakening the full chain:

Search -> Compare -> Request -> Approval -> PO -> Dispatch -> Supplier Confirmation -> Receiving -> Stock -> Reorder

## 2. Goal

Create an agent review board that checks every material LabAxis change before production release.

The board must:

- detect source-of-truth and mutation-boundary regressions
- detect unclear operator next actions
- protect workbench / queue / rail / dock grammar
- run user-perspective pilot scenarios
- produce a release decision: `go`, `revise`, or `hold`
- require human approval before production release

## 3. Non-Goals

- Do not turn AI into a separate chatbot UI.
- Do not let agents auto-send, auto-commit, auto-select, or auto-push production changes.
- Do not put the full orchestration engine inside the LabAxis product repo long term.
- Do not replace human approval for destructive data, migration, or production release decisions.
- Do not create generic SaaS QA. This board is LabAxis-specific operations review.

## 4. Users

- CEO / operating owner: final decision maker and priority setter.
- COO / operations owner: protects execution ownership, queue control, escalation, and handoff reliability.
- CFO / finance owner: protects budget visibility, approval integrity, spend risk, and auditability.
- Builder agent: implements product changes.
- Structure Guard: reviews canonical truth, lineage, preview boundaries, and mutation safety.
- Ops Guard: reviews blocker, next action, handoff, and workflow continuity.
- UX Guard: reviews workbench grammar, hierarchy, color semantics, and CTA clarity.
- Pilot User: simulates real operator scenarios.
- Release Arbiter: synthesizes reports into `go`, `revise`, or `hold`.

## 5. Product Repo vs Agent Repo

LabAxis product repo owns product-specific truth:

- `docs/labaxis-review-constitution.md`
- `docs/labaxis-release-gate.md`
- `docs/ops/labaxis-agent-review-board-prd-v1.md`
- `.labaxis/project.config.json`
- `.labaxis/pilots/*.md`

The external agent-board repo owns reusable execution infrastructure:

- CLI runner
- agent prompt templates
- git diff collector
- report generator
- CI / PR gate integration
- model/provider adapter

The runner should live outside the LabAxis product repo. The current local external runner path is `C:\Users\young\Documents\Playground\labaxis-agent-board`.

## 6. MVP Flow

1. Builder provides change summary and changed files.
2. Review packet is generated from LabAxis constitution, release gate, pilot scenario, and git context.
3. Structure Guard reviews truth and mutation boundaries.
4. Ops Guard reviews operational clarity.
5. UX Guard reviews workbench and visual hierarchy.
6. CEO Reviewer reviews strategy, product positioning, and adoption confidence.
7. COO Reviewer reviews operations ownership, queue control, escalation, and handoff continuity.
8. CFO Reviewer reviews budget control, approval integrity, spend risk, and auditability.
9. Pilot User runs the selected scenario.
10. Release Arbiter returns `go`, `revise`, or `hold`.
11. Human operator approves merge or production deployment.

## 7. Inputs

- project root
- change summary
- changed files or git diff
- selected pilot scenario
- route or screenshot when UI is involved
- source-of-truth objects touched
- mutation/API paths touched
- test/build results when available

## 8. Outputs

The board produces:

- review packet
- Structure Guard report
- Ops Guard report
- UX Guard report
- CEO Reviewer report
- COO Reviewer report
- CFO Reviewer report
- Pilot User report
- Release Arbiter decision
- required minimal diff before release

The release decision must be one of:

- `go`: no blocking risk
- `revise`: fix specified issues before release
- `hold`: do not release until blocker is resolved

## 9. Hard Hold Rules

The board must return `hold` if any of these are true:

- source of truth is ambiguous or duplicated
- preview can overwrite actual truth
- AI can auto-commit without operator review
- critical CTA is clickable but not implemented
- pilot scenario cannot complete
- production data, purchasing, budget, supplier-send, migration, or authorization risk is unresolved
- financially meaningful actions bypass approval or audit state
- compare / request / review regresses to disconnected page-per-feature flow without product approval

## 10. CLI MVP

Target external command:

```powershell
labaxis-agent-board run `
  --project C:\Users\young\ai-biocompare `
  --pilot 03-expired-lot-disposal `
  --summary "expired lot disposal hierarchy"
```

Current local external-runner command:

```powershell
node C:\Users\young\Documents\Playground\labaxis-agent-board\src\run.mjs validate `
  --project C:\Users\young\ai-biocompare
```

```powershell
node C:\Users\young\Documents\Playground\labaxis-agent-board\src\run.mjs run `
  --project C:\Users\young\ai-biocompare `
  --pilot 03-expired-lot-disposal `
  --summary "expired lot disposal hierarchy" `
  --no-git
```

```powershell
node C:\Users\young\Documents\Playground\labaxis-agent-board\src\run.mjs bundle `
  --project C:\Users\young\ai-biocompare `
  --pilot 03-expired-lot-disposal `
  --summary "expired lot disposal hierarchy" `
  --no-git
```

```powershell
node C:\Users\young\Documents\Playground\labaxis-agent-board\src\run.mjs flow `
  --bundle-dir C:\Users\young\Documents\Playground\labaxis-agent-board\runs\ai-biocompare\<bundle>
```

```powershell
node C:\Users\young\Documents\Playground\labaxis-agent-board\src\run.mjs collect `
  --bundle-dir C:\Users\young\Documents\Playground\labaxis-agent-board\runs\ai-biocompare\<bundle>
```

If the product repo is not writable, generated packets may be written to the external runner fallback path.

## 11. MVP Acceptance Criteria

- A PRD exists and defines repo boundaries.
- LabAxis repo has a project manifest.
- External runner can validate the project manifest and required docs.
- Pilot scenarios can be selected by id.
- Review packet generation works without requiring production deployment.
- Multi-agent bundle generation creates context, per-agent prompts, run manifest, and arbiter input.
- Bundle workflow tells operators the next action and required human gate.
- Report collection creates `collect.json` and a filled `release-arbiter-input.md`.
- Each agent has a stable output contract.
- Release Arbiter decision format is fixed.
- Human approval remains required for production release.

## 12. Phase Plan

### Phase 1: Bootstrap

- Keep product constitution and pilot scenarios in LabAxis repo.
- Generate review packets manually.
- Run the local external runner from `C:\Users\young\Documents\Playground\labaxis-agent-board`.

### Phase 2: Extraction

- Promote `C:\Users\young\Documents\Playground\labaxis-agent-board` into a standalone repo or package.
- Keep only project config and pilots in LabAxis.
- Replace local npm script with external CLI call.

### Phase 3: CI Gate

- Generate review packet on PR.
- Attach guard reports to PR.
- Block merge on `hold`.
- Require human override for production deployment.

### Phase 4: Pilot Automation

- Add route-aware screenshots.
- Run pilot scenarios against preview deployments.
- Compare expected action hierarchy against rendered UI.
- Record pilot failure points as release findings.

## 13. Operating Principle

The LabAxis repo stores product truth. The agent-board reads that truth and reviews changes. Agents recommend; humans approve.
