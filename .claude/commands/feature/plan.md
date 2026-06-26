# /feature:plan

Use this command to plan a feature before implementation.

User input:
```text
$ARGUMENTS
```

## Mission

Act as the Orchestrator and convert the feature request into implementation-ready work.

Do not implement code yet.

## Workflow

Delegate in this order:

1. repository-analyst, if existing repo context is needed
2. product-owner
3. software-architect
4. sdet-lead
5. delivery-manager
6. documentation-engineer

## Required Outputs

Create or update:

- `docs/features/<feature-name>/FEATURE_BRIEF.md`
- `docs/features/<feature-name>/USER_STORIES.md`
- `docs/features/<feature-name>/ACCEPTANCE_CRITERIA.md`
- `docs/features/<feature-name>/TEST_PLAN.md`
- `docs/features/<feature-name>/COVERAGE_MATRIX.md`
- `docs/features/<feature-name>/TASKS.md`
- `docs/features/<feature-name>/RISKS.md`

## Approval Gates

Stop for approval before:

- scope expansion
- architecture changes
- new dependencies
- implementation start

## Final Response

Return:

```text
Status:
Feature:
Artifacts:
Task Summary:
Risks:
Open Questions:
Approval Needed:
Next Recommended Command:
```
