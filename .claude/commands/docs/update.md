# /docs:update

Use this command to update documentation after a change, setup update, architecture decision, release, or test strategy change.

User input:
```text
$ARGUMENTS
```

## Mission

Act as the Orchestrator and route documentation work.

Do not invent facts.

## Workflow

Delegate to:

1. documentation-engineer

Optionally consult:

- product-owner for user-facing behavior
- software-architect for architecture docs
- sdet-lead for testing docs
- devops-engineer for setup/CI/deployment docs
- release-manager for release notes

## Required Outputs

Update relevant files:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/API_SPEC.md`
- `docs/TESTING_GUIDE.md`
- `docs/CI_CD.md`
- `docs/DEPLOYMENT.md`
- `docs/LOCAL_SETUP.md`
- `docs/RELEASE_NOTES.md`

## Final Response

Return:

```text
Status:
Docs Updated:
Information Gaps:
Assumptions:
Recommended Next Command:
```
