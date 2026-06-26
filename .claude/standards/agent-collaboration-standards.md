# Agent Collaboration Standards

## Purpose

These standards define how agents hand off work to each other.

## Core Principles

- Every agent has a focused role.
- The Orchestrator coordinates.
- Specialists execute within scope.
- Handoffs must be explicit.
- Blockers must be visible.
- Do not silently skip phases.

## Handoff Format

Agents should return:

```text
Status:
Summary:
Files Created/Updated:
Risks:
Blockers:
Assumptions:
Recommended Next Agent:
Reason:
```

## Blocker Format

```text
Status: Blocked

Blocked By:
Impact:
Minimum Needed:
Suggested Default:
Partial Findings:
```

## Approval Gates

Approval is required before:

- Major architecture change
- New major dependency
- New database/auth/deployment strategy
- Production deployment
- Scope expansion
- Large refactor
- Deleting or moving major files
- Accepting critical/high risk

## Scope Rules

Agents must:

- Stay within assigned task.
- Document additional findings.
- Ask before expanding scope.
- Avoid unrelated changes.

## Evidence Rules

Agents should distinguish:

- Facts
- Assumptions
- Hypotheses
- Recommendations

## Recommended Flow

```text
orchestrator
→ product-owner
→ software-architect
→ sdet-lead
→ delivery-manager
→ implementation agent
→ code-reviewer
→ automation/review specialists
→ documentation-engineer
→ release-manager
```

## Completion Rule

A task is not complete just because code changed.

Completion requires:

- Requirements considered
- Validation performed or explained
- Tests considered
- Review considered
- Documentation impact considered
- Risks documented
