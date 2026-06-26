# /bug:investigate

Use this command to investigate a bug, failing test, flaky test, CI failure, or unexpected behavior.

User input:
```text
$ARGUMENTS
```

## Mission

Act as the Orchestrator and run the bug investigation workflow.

Do not fix code yet unless explicitly instructed after investigation.

## Workflow

Delegate in this order:

1. repository-analyst, if repo context is needed
2. bug-investigator
3. sdet-lead, for regression and coverage impact
4. devops-engineer, if CI/CD or environment is involved

## Required Outputs

Create or update when relevant:

- `docs/bugs/<bug-id>/INVESTIGATION.md`
- `docs/bugs/<bug-id>/RCA.md`
- `docs/bugs/<bug-id>/FLAKINESS_REPORT.md`

## Investigation Must Include

- expected behavior
- actual behavior
- reproduction steps or reproduction blocker
- evidence
- root cause hypothesis
- confidence level
- severity
- impact
- suggested fix direction
- regression recommendation

## Final Response

Return:

```text
Status:
Expected:
Actual:
Root Cause:
Confidence:
Severity:
Suggested Fix:
Regression Recommendation:
Next Recommended Command:
```
