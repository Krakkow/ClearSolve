# Documentation Standards

## Purpose

These standards guide all project documentation.

## Core Principles

- Documentation must be accurate.
- Do not invent facts.
- Mark assumptions clearly.
- Prefer practical examples.
- Keep docs close to source of truth.
- Update docs when behavior, setup, API, or deployment changes.
- Write for both humans and future agents.

## Required Documentation Areas

For most projects, maintain:

- `README.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/API_SPEC.md`, if applicable
- `docs/TEST_STRATEGY.md`
- `docs/CI_CD.md`, if applicable
- `docs/LOCAL_SETUP.md`
- `docs/DEPLOYMENT.md`, if applicable
- `docs/RELEASE_NOTES.md`, if applicable

## README Minimum Content

`README.md` should include:

- Project overview
- Tech stack
- Prerequisites
- Installation
- Configuration
- Run commands
- Test commands
- Build commands
- Project structure
- Important documentation links
- Troubleshooting

## Writing Style

Use:

- Clear headings
- Short paragraphs
- Command examples
- Tables when helpful
- Explicit paths
- Explicit assumptions

Avoid:

- Vague marketing language
- Unverified claims
- Long walls of text
- Chat-history references
- Hidden prerequisites

## Command Documentation

For commands include:

```text
Purpose
Prerequisites
Command
Expected result
Troubleshooting
```

## API Documentation

API docs should include:

- Method
- Path
- Purpose
- Auth requirements
- Request body
- Response body
- Error responses
- Examples

## Change Documentation

When documenting a change include:

- What changed
- Why it changed
- How to use it
- How to validate it
- Known risks
- Follow-up work

## Documentation Quality Gate

Before release or handoff:

- README is usable.
- Setup instructions are current.
- Test commands are current.
- API docs are current if API changed.
- Deployment docs are current if deployment changed.
- Known risks are documented.
