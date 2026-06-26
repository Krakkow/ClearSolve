# Improvement Backlog

This file tracks future improvements to the agent infrastructure itself.

## Backlog Index

| ID | Improvement | Priority | Status |
|----|-------------|----------|--------|
| IMP-001 | | | Open |

---

## Improvement Template

```markdown
## IMP-000: <Improvement Title>

Status: Open | In Progress | Done | Deferred | Rejected
Priority: Must | Should | Could
Area: Agents | Commands | Standards | State | Templates | Memory | Tooling
Suggested By:
Related Files:

### Problem

### Proposed Improvement

### Expected Benefit

### Risk

### Acceptance Criteria

### Notes
```

---

## IMP-001: Create Full Infra Bundle

Status: Open
Priority: Should
Area: Tooling
Suggested By: Infrastructure Setup
Related Files:
- `.claude/agents/`
- `.claude/commands/`
- `.claude/standards/`
- `.claude/state/`
- `.claude/templates/`
- `.claude/memory/`

### Problem

The infrastructure currently exists as multiple packages.

### Proposed Improvement

Create one complete repository-ready bundle containing all agents, commands, standards, state, templates, and memory files.

### Expected Benefit

Easier reuse in new projects.

### Risk

None.

### Acceptance Criteria

- One zip package
- Correct folder structure
- Root README
- Install/copy instructions

### Notes

Recommended next step after memory package.
