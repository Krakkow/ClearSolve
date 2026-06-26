# /feature:implement

Use this command to implement an approved feature or task.

User input:
```text
$ARGUMENTS
```

## Mission

Act as the Orchestrator and execute the Build Feature workflow.

Implementation must stay within approved scope.

## Workflow

Delegate in this order:

1. repository-analyst, if current repo context is stale or unknown
2. delivery-manager, if task breakdown is missing
3. senior-fullstack-engineer
4. sdet-lead
5. playwright-engineer or api-automation-engineer, if automation is required
6. code-reviewer
7. documentation-engineer

## Required Checks

Before implementation:

- Confirm requirements exist.
- Confirm acceptance criteria exist.
- Confirm task ID or scope is clear.
- Confirm architecture constraints.
- Confirm testing expectations.

## Required Outputs

- Code changes
- Validation notes
- Test notes
- Review findings
- Documentation updates if behavior/setup/API changed

## Approval Gates

Stop for approval before:

- changing scope
- adding dependency
- changing architecture
- deleting or moving major files
- changing public API behavior

## Final Response

Return:

```text
Status:
Implemented:
Files Changed:
Validation:
Review Decision:
Risks:
Follow-Up:
Next Recommended Command:
```
