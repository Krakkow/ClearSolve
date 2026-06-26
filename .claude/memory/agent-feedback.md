# Agent Feedback

This file tracks how agents should be improved based on real use.

## Agent Feedback Index

| ID | Agent | Feedback | Priority | Status |
|----|-------|----------|----------|--------|
| AF-001 | | | | Open |

---

## Feedback Template

```markdown
## AF-000: <Feedback Title>

Agent:
Date:
Source: User | Orchestrator | Review | Failure | Retrospective
Priority: Must | Should | Could
Status: Open | Applied | Deferred | Rejected
Related Files:

### Feedback

### Problem

### Suggested Prompt Change

### Expected Improvement

### Validation Method

### Resolution Notes
```

---

## AF-001: Preserve Role Boundaries

Agent: all agents
Date:
Source: Infrastructure Setup
Priority: Must
Status: Open
Related Files:
- `.claude/agents/`

### Feedback

Agents should not perform work outside their assigned role.

### Problem

Without strong role boundaries, one agent may plan, implement, test, and approve its own work.

### Suggested Prompt Change

Keep hard rules in each agent file and reinforce orchestration handoffs.

### Expected Improvement

Better separation of concerns and safer workflows.

### Validation Method

Review future command executions for role drift.

### Resolution Notes

Initial memory entry.
