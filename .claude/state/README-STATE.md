# Claude Agent State Management

This package defines persistent state files for the Claude SDLC/SDET agent infrastructure.

Place these files under:

```text
.claude/state/
```

State files allow agents to understand what has already happened, what is currently active, what is blocked, what decisions were made, and what remains to be done.

## Included State Files

```text
.claude/state/
├── project-state.md
├── active-workflow.md
├── decision-log.md
├── open-blockers.md
├── implementation-state.md
├── testing-state.md
├── release-state.md
├── technical-debt.md
└── completed-work.md
```

## How Agents Should Use State

### Orchestrator

Must read:

- `project-state.md`
- `active-workflow.md`
- `decision-log.md`
- `open-blockers.md`

Before choosing workflow, delegating, or marking work complete.

### Product Owner

Should read:

- `project-state.md`
- `decision-log.md`
- `open-blockers.md`

Before defining or changing requirements.

### Software Architect

Should read:

- `project-state.md`
- `decision-log.md`
- `technical-debt.md`

Before making architecture recommendations.

### SDET Lead

Should read:

- `project-state.md`
- `testing-state.md`
- `open-blockers.md`

Before defining quality strategy.

### Delivery Manager

Should read:

- `active-workflow.md`
- `implementation-state.md`
- `open-blockers.md`

Before planning tasks.

### Developers

Should read:

- `active-workflow.md`
- `implementation-state.md`
- `decision-log.md`

Before implementing.

### Reviewers

Should read:

- `active-workflow.md`
- `decision-log.md`
- `implementation-state.md`
- `testing-state.md`

Before reviewing.

### Release Manager

Should read:

- `release-state.md`
- `testing-state.md`
- `open-blockers.md`
- `completed-work.md`

Before giving Go/No-Go.

## State Update Rules

1. Do not overwrite state blindly.
2. Append decisions instead of replacing history.
3. Keep current status near the top of each file.
4. Mark assumptions clearly.
5. Blockers must include owner and minimum needed input.
6. Completed work should move to `completed-work.md`.
7. Decisions should be recorded in `decision-log.md`.
8. Release readiness should be tracked in `release-state.md`.
9. Testing progress should be tracked in `testing-state.md`.
10. Technical debt should be tracked instead of silently fixed.

## Status Values

Use these values consistently:

```text
Not Started
In Progress
Blocked
Waiting for Approval
Ready for Review
Changes Requested
Complete
Accepted Risk
Deferred
Cancelled
```

## Risk Levels

Use:

```text
Critical
High
Medium
Low
Info
```

## Priority Values

Use:

```text
Must
Should
Could
Won't
```
