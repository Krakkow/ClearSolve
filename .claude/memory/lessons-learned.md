# Lessons Learned

This file captures project-wide lessons that should influence future agent behavior.

## Lesson Index

| ID | Area | Lesson | Impact | Status |
|----|------|--------|--------|--------|
| LESSON-001 | | | | Active |

---

## Lesson Template

```markdown
## LESSON-000: <Lesson Title>

Date:
Area: Product | Architecture | Development | Testing | DevOps | Review | Release | Agent Behavior
Discovered During:
Related Files:
Status: Active | Superseded | Deprecated

### Context

### What Happened

### Lesson

### Future Guidance

### Evidence

### Related Follow-Up
```

---

## LESSON-001: Keep Orchestrator Delegation-Only

Date:
Area: Agent Behavior
Discovered During: Infrastructure Setup
Related Files:
- `.claude/agents/00-orchestrator.md`
Status: Active

### Context

The orchestrator was intentionally designed as a dispatcher and gatekeeper, not an implementer.

### What Happened

The infrastructure separates planning, architecture, implementation, testing, review, and release responsibilities across specialist agents.

### Lesson

The orchestrator should delegate and validate, not write code or tests.

### Future Guidance

If the orchestrator starts implementing, update its prompt or command routing to reinforce delegation-only behavior.

### Evidence

Agent design decision.

### Related Follow-Up

None.
