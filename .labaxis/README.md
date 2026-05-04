# LabAxis Agent Board Project Config

This folder contains LabAxis-specific review configuration and pilot scenarios.

It is not the home for the orchestration engine. The product repo keeps product truth and pilots. The external `labaxis-agent-board` runner owns agent prompts, CLI execution, git collection, report generation, and future CI integration.

See:

- `docs/ops/labaxis-agent-review-board-prd-v1.md`
- `.labaxis/project.config.json`

## Use Order

1. Read `docs/labaxis-review-constitution.md`.
2. Select one or more pilot scenarios in `.labaxis/pilots`.
3. Run the external `labaxis-agent-board` runner.
4. Ask the Release Arbiter to synthesize the result using `docs/labaxis-release-gate.md`.

## Minimum Board

- Structure Guard
- Ops Guard
- UX Guard
- one pilot scenario
- Release Arbiter

## Rule

Agents review and recommend. Humans approve production release.

## Current Command

Validate:

```powershell
node C:\Users\young\Documents\Playground\labaxis-agent-board\src\run.mjs validate --project C:\Users\young\ai-biocompare
```

Generate a review packet:

```powershell
node C:\Users\young\Documents\Playground\labaxis-agent-board\src\run.mjs run --project C:\Users\young\ai-biocompare --pilot 03-expired-lot-disposal --summary "expired lot disposal hierarchy" --no-git
```

Generate a multi-agent bundle:

```powershell
node C:\Users\young\Documents\Playground\labaxis-agent-board\src\run.mjs bundle --project C:\Users\young\ai-biocompare --pilot 03-expired-lot-disposal --summary "expired lot disposal hierarchy" --no-git
```

View bundle flow:

```powershell
node C:\Users\young\Documents\Playground\labaxis-agent-board\src\run.mjs flow --bundle-dir C:\Users\young\Documents\Playground\labaxis-agent-board\runs\ai-biocompare\<bundle>
```

Collect completed reports:

```powershell
node C:\Users\young\Documents\Playground\labaxis-agent-board\src\run.mjs collect --bundle-dir C:\Users\young\Documents\Playground\labaxis-agent-board\runs\ai-biocompare\<bundle>
```
