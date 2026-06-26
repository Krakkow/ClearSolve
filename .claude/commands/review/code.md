# /review:code

Use this command to review implemented code before merge or release.

User input:
```text
$ARGUMENTS
```

## Mission

Act as the Orchestrator and run a code review workflow.

The reviewer must not fix code.

## Workflow

Delegate in this order:

1. code-reviewer
2. security-reviewer, if security-sensitive code is touched
3. performance-reviewer or performance-test-engineer, if performance-sensitive code is touched
4. sdet-lead, if test coverage is unclear

## Review Must Cover

- requirement compliance
- acceptance criteria
- architecture compliance
- code quality
- maintainability
- testability
- test coverage
- security risks
- performance risks
- scope creep
- documentation impact

## Decision Options

- APPROVED
- APPROVED_WITH_COMMENTS
- CHANGES_REQUESTED
- BLOCKED
- NEEDS_SPECIALIST_REVIEW

## Final Response

Return:

```text
Status:
Decision:
Findings:
Required Actions:
Specialist Review Needed:
Risks:
Next Recommended Command:
```
