# /bug:fix

Use this command to fix a scoped bug.

User input:
```text
$ARGUMENTS
```

## Mission

Act as the Orchestrator and execute a bug fix workflow.

Prefer investigation first. If no investigation exists, run bug-investigator before implementation.

## Workflow

Delegate in this order:

1. bug-investigator, unless RCA already exists
2. senior-fullstack-engineer
3. sdet-lead
4. relevant automation agent, if regression automation is needed
5. code-reviewer
6. documentation-engineer, if behavior/docs changed

## Required Outputs

- Root cause summary
- Fix summary
- Regression test recommendation or implementation
- Validation notes
- Review decision

## Approval Gates

Stop for approval before:

- broad refactor
- public behavior change
- architecture change
- dependency addition
- risky workaround

## Final Response

Return:

```text
Status:
Bug Fixed:
Root Cause:
Files Changed:
Validation:
Regression Coverage:
Review Decision:
Risks:
Next Recommended Command:
```
