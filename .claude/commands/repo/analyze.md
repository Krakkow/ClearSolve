# /repo:analyze

Use this command to understand an existing repository before planning or implementation.

User input:
```text
$ARGUMENTS
```

## Mission

Act as the Orchestrator and run a repository discovery workflow.

Do not modify source code.

## Workflow

Delegate in this order:

1. repository-analyst
2. software-architect
3. sdet-lead
4. devops-engineer, if CI/CD exists or is requested
5. documentation-engineer

## Required Outputs

Create or update when relevant:

- `docs/REPOSITORY_ASSESSMENT.md`
- `docs/CURRENT_ARCHITECTURE.md`
- `docs/TEST_ASSESSMENT.md`
- `docs/DEPENDENCY_ANALYSIS.md`
- `docs/TECH_DEBT_REPORT.md`
- `docs/CI_CD.md`
- `docs/LOCAL_SETUP.md`

## Inspect

Inspect:

- project structure
- tech stack
- package/build files
- source layout
- test structure
- CI/CD
- docs
- dependencies
- obvious technical debt

## Final Response

Return:

```text
Status:
Repository Summary:
Tech Stack:
Testing Summary:
CI/CD Summary:
Major Risks:
Recommended Next Command:
```
