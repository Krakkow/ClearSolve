# Claude Agent Standards

This package defines shared standards for the Claude SDLC/SDET agent infrastructure.

Place these files under:

```text
.claude/standards/
```

Agents should read these standards before planning, implementing, reviewing, testing, documenting, or releasing work.

## Included Standards

```text
.claude/standards/
├── coding-standards.md
├── testing-standards.md
├── review-standards.md
├── documentation-standards.md
├── security-standards.md
├── devops-standards.md
├── agent-collaboration-standards.md
└── definition-of-done.md
```

## Usage

These standards are intended to be referenced by:

- orchestrator
- product-owner
- software-architect
- sdet-lead
- repository-analyst
- delivery-manager
- senior-fullstack-engineer
- code-reviewer
- bug-investigator
- devops-engineer
- documentation-engineer
- security-reviewer
- release-manager
- test-designer
- playwright-engineer
- api-automation-engineer
- performance-test-engineer

## Priority Order

When standards conflict, use this order:

1. User instruction
2. Project-specific instructions
3. Security standards
4. Architecture decisions
5. Testing standards
6. Coding standards
7. Documentation standards
8. Agent collaboration standards

## Core Philosophy

- Small, clear, reversible changes
- Risk-based testing
- No hidden assumptions
- No silent scope expansion
- Evidence-based decisions
- Documentation as part of delivery
- Quality before release
