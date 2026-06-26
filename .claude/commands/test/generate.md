# /test:generate

Use this command to design and/or implement tests for a feature, bug fix, API, or user flow.

User input:
```text
$ARGUMENTS
```

## Mission

Act as the Orchestrator and run the test generation workflow.

Use risk-based testing. Do not default everything to UI automation.

## Workflow

Delegate in this order:

1. sdet-lead
2. test-designer
3. api-automation-engineer, if API/service coverage is appropriate
4. playwright-engineer, if E2E/UI coverage is appropriate
5. performance-test-engineer, if performance risk exists
6. code-reviewer

## Required Outputs

Create or update when relevant:

- `docs/TEST_CASES.md`
- `docs/TEST_COVERAGE_MATRIX.md`
- `docs/REGRESSION_SUITE.md`
- `docs/features/<feature-name>/TEST_CASES.md`
- automated test files
- execution commands

## Required Checks

- Map tests to requirements or risks.
- Prefer API/unit/integration coverage before E2E when suitable.
- Include negative and edge cases.
- Document coverage gaps.
- Document flakiness risks.

## Final Response

Return:

```text
Status:
Coverage Added:
Test Files:
Execution Command:
Validation:
Coverage Gaps:
Flakiness Risks:
Next Recommended Command:
```
