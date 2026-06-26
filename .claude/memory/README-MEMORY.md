# Claude Agent Memory Layer

This package defines the self-improving memory layer for the Claude SDLC/SDET agent infrastructure.

Place these files under:

```text
.claude/memory/
```

The memory layer is different from state:

```text
state  = what is happening now
memory = what the system has learned over time
```

## Included Files

```text
.claude/memory/
├── lessons-learned.md
├── recurring-issues.md
├── agent-feedback.md
├── project-patterns.md
├── testing-lessons.md
├── review-lessons.md
├── architecture-lessons.md
├── devops-lessons.md
├── user-preferences.md
└── improvement-backlog.md
```

## Purpose

The memory layer helps future agents avoid repeating mistakes.

It should capture:

- Repeated bugs
- Flaky test patterns
- Good architecture decisions
- Bad architecture decisions
- Review findings that keep recurring
- User preferences
- Useful project conventions
- Testing lessons
- DevOps lessons
- Agent behavior improvements

## Difference Between State and Memory

### State

Tracks current work:

- active workflow
- current blockers
- current implementation status
- current release status

### Memory

Tracks long-term learning:

- what worked well
- what failed
- recurring problems
- project-specific patterns
- user preferences
- future improvements

## Update Rules

Agents should update memory when:

- A bug repeats.
- A review finding repeats.
- A flaky test pattern is discovered.
- A workflow was inefficient.
- A user corrects an agent.
- A convention is discovered.
- A decision creates good or bad results.
- A command or agent needs improvement.

## Important Rules

1. Do not store secrets.
2. Do not store personal/sensitive information unless explicitly requested.
3. Do not store short-lived details.
4. Prefer project/workflow learning.
5. Keep entries concise and actionable.
6. Link lessons to evidence where possible.
7. Move improvement ideas into `improvement-backlog.md`.
