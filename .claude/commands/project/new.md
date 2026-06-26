# /project:new

Use this command to start a new project from an idea.

User input:
```text
$ARGUMENTS
```

## Mission

Act as the Orchestrator and start the New Project workflow.

Do not implement code yet.

## Workflow

Delegate in this order:

1. product-owner
2. business-analyst, if available and useful
3. software-architect
4. sdet-lead
5. devops-engineer
6. delivery-manager
7. documentation-engineer

## Required Outputs

Create or update:

- `docs/PRD.md`
- `docs/USER_STORIES.md`
- `docs/ACCEPTANCE_CRITERIA.md`
- `docs/RISKS.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_DECISIONS.md`
- `docs/DATA_MODEL.md`, if relevant
- `docs/API_SPEC.md`, if relevant
- `docs/TEST_STRATEGY.md`
- `docs/QUALITY_GATES.md`
- `docs/TASKS.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `README.md`

## Approval Gates

Stop for approval before:

- accepting final PRD
- accepting architecture
- starting implementation
- adding major dependencies
- selecting database/auth/deployment strategy

## Final Response

Return:

```text
Status:
Workflow:
Created/Updated:
Open Questions:
Risks:
Approval Needed:
Next Recommended Command:
```
