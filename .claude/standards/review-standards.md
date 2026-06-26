# Review Standards

## Purpose

These standards define how code, architecture, test, security, and release reviews should be performed.

## Core Principles

- Review against requirements, not personal preference.
- Be strict on correctness, security, and risk.
- Be practical on style.
- Findings must be actionable.
- Severity must be clear.
- Approval requires evidence.

## Review Severity

Use these severities:

```text
BLOCKER
MAJOR
MINOR
NIT
QUESTION
```

## BLOCKER

Must be fixed before merge/release.

Examples:

- Requirement not implemented
- Critical bug
- Build broken
- Tests failing without accepted reason
- Security flaw
- Data loss risk
- Production-breaking behavior

## MAJOR

Should be fixed before merge unless risk is explicitly accepted.

Examples:

- Important edge case missing
- Poor error handling
- Missing meaningful tests
- Architecture violation
- High maintainability risk
- Unclear behavior in important flow

## MINOR

Recommended improvement.

Examples:

- Small duplication
- Naming clarity
- Small structure issue
- Non-critical docs gap

## NIT

Optional polish.

Examples:

- Formatting preference
- Small comment improvement
- Minor wording issue

## QUESTION

Needs clarification.

Examples:

- Requirement ambiguity
- Intent unclear
- Possible scope mismatch

## Review Decision

Use one:

```text
APPROVED
APPROVED_WITH_COMMENTS
CHANGES_REQUESTED
BLOCKED
NEEDS_SPECIALIST_REVIEW
```

## Review Checklist

Reviewers should check:

- Requirement compliance
- Acceptance criteria coverage
- Scope control
- Architecture compliance
- Maintainability
- Testability
- Test coverage
- Security risk
- Performance risk
- Documentation impact
- CI/CD impact

## Specialist Escalation

Escalate to:

- software-architect for architecture conflicts
- sdet-lead for coverage/testability risk
- security-reviewer for auth, secrets, sensitive data, external input
- performance-test-engineer for latency/load/resource risks
- devops-engineer for CI/CD or deployment risks
- release-manager for release blockers

## Review Output Format

```text
Decision:
Summary:
Findings:
Required Actions:
Risks:
Specialist Review Needed:
Recommended Next Step:
```

## Operating Rules

- Do not fix code while reviewing.
- Do not block on personal preference.
- Do not approve with unresolved blockers.
- Do not hide uncertainty.
- Every major finding needs rationale.
