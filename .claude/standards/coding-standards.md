# Coding Standards

## Purpose

These standards guide all implementation work.

They apply to production code, test utilities, scripts, and framework code unless a project-specific standard overrides them.

## Core Principles

- Prefer clarity over cleverness.
- Keep changes small and focused.
- Follow existing repository conventions.
- Avoid unrelated refactors.
- Keep code easy to test.
- Make error handling intentional.
- Avoid hidden side effects.
- Document meaningful decisions.

## Scope Control

Implementation agents must:

- Implement only approved tasks.
- Avoid scope creep.
- Document any discovered follow-up work.
- Request approval before major refactors, dependency additions, or architecture changes.

## Code Structure

Prefer:

- Small cohesive modules
- Clear separation of concerns
- Meaningful names
- Simple control flow
- Explicit dependencies
- Reusable utilities where they reduce duplication
- Composition over unnecessary inheritance

Avoid:

- Giant files
- Giant functions
- Deep nesting
- Magic numbers
- Hidden global state
- Copy-paste logic
- Unclear abstractions
- Premature optimization

## Error Handling

Code should:

- Fail clearly.
- Return useful errors.
- Avoid swallowing exceptions silently.
- Preserve useful debugging context.
- Avoid leaking sensitive data in errors or logs.

## Logging

Logs should:

- Help diagnose failures.
- Include relevant context.
- Avoid sensitive data.
- Avoid noisy debug spam.
- Be consistent with existing project style.

## Configuration

Configuration should:

- Use environment variables or config files as appropriate.
- Provide documented defaults when safe.
- Avoid hardcoded environment-specific values.
- Avoid committing secrets.

## Dependencies

Before adding dependencies:

- Check if existing tools already solve the problem.
- Prefer maintained, popular, minimal dependencies.
- Document why the dependency is needed.
- Request approval for major or security-sensitive dependencies.

## API Design

APIs should:

- Use consistent naming.
- Return predictable responses.
- Handle validation errors clearly.
- Avoid exposing internal implementation details.
- Preserve backward compatibility unless approved.

## Frontend Code

Frontend code should:

- Keep components focused.
- Separate UI, state, and side effects where practical.
- Use stable selectors for testability when relevant.
- Handle loading, empty, and error states.
- Avoid brittle DOM assumptions.

## Backend Code

Backend code should:

- Validate input server-side.
- Enforce authorization server-side.
- Keep business logic testable.
- Separate transport/API layer from domain logic where practical.
- Handle external service failures intentionally.

## Testability

Code should be designed so that:

- Important logic can be tested without full E2E tests.
- Dependencies can be mocked or isolated.
- State can be controlled in tests.
- Outputs are observable.
- Errors are deterministic.

## Validation Before Handoff

Implementation agents should report:

```text
Build:
Tests:
Manual validation:
Files changed:
Risks:
Documentation impact:
```

If validation could not be run, explain why.
