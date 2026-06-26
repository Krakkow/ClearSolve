# /release:prepare

Use this command before release, deployment, merge, handoff, or milestone closure.

User input:
```text
$ARGUMENTS
```

## Mission

Act as the Orchestrator and run release readiness workflow.

Do not deploy to production unless explicitly approved.

## Workflow

Delegate in this order:

1. code-reviewer
2. sdet-lead
3. security-reviewer
4. performance-test-engineer, if relevant
5. devops-engineer
6. release-manager
7. documentation-engineer

## Required Outputs

Create or update:

- `docs/RELEASE_CHECKLIST.md`
- `docs/RELEASE_NOTES.md`
- `docs/KNOWN_RISKS.md`
- `docs/ROLLBACK.md`
- `docs/POST_RELEASE_VALIDATION.md`

## Release Recommendation

Use one:

- GO
- GO_WITH_ACCEPTED_RISK
- NO_GO
- BLOCKED

## Approval Gates

Stop for approval before:

- production deployment
- accepting critical/high risk
- skipping tests
- changing release workflow

## Final Response

Return:

```text
Status:
Recommendation:
Release Scope:
Quality Status:
Security Status:
Known Risks:
Rollback Status:
Approval Needed:
Next Recommended Command:
```
