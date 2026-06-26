# Testing Standards

## Purpose

These standards guide test strategy, test design, automation, and release quality assessment.

## Core Principles

- Risk determines test depth.
- Test at the lowest useful level.
- Automation must have a clear purpose.
- Stable tests are more valuable than many flaky tests.
- Bugs require regression thinking.
- Coverage gaps must be visible.
- Manual testing and exploratory testing are valid tools.

## Test Pyramid

Prefer this order when possible:

1. Unit tests
2. Component tests
3. API/service tests
4. Integration tests
5. Contract tests
6. E2E/UI tests
7. Manual/exploratory testing

E2E tests should cover critical journeys, not every edge case.

## Risk-Based Testing

Prioritize coverage for:

- User-critical flows
- Business-critical logic
- Security-sensitive areas
- Payment/data/auth flows
- High-change areas
- Complex integrations
- Previous bug areas
- Release blockers

## Acceptance Criteria

Acceptance criteria must be:

- Clear
- Observable
- Testable
- Behavior-focused
- Free of unnecessary implementation detail

## Test Case Design

Include:

- Happy path
- Negative path
- Edge cases
- Boundary values
- Permission/role scenarios
- Error handling
- State transitions
- Data validation
- Regression impact

## Automation Selection

Automate when:

- Scenario is stable
- Scenario repeats often
- Scenario has regression value
- Setup can be controlled
- Assertion is reliable

Keep manual/exploratory when:

- Scenario is visual/subjective
- Requirements are changing quickly
- One-time validation is enough
- Automation would be brittle or expensive

## Playwright / UI Automation

Prefer:

- User-facing locators
- Stable test IDs when appropriate
- Deterministic waits
- Independent tests
- Clear assertions
- Reusable fixtures
- Controlled test data

Avoid:

- Arbitrary sleeps
- Long brittle selectors
- Test order dependencies
- Overuse of screenshots as assertions
- Hidden environment assumptions

## API Automation

API tests should cover:

- Success responses
- Validation errors
- Authentication
- Authorization
- Error contracts
- Boundary values
- Data persistence
- External dependency failure behavior

## Flakiness Policy

A flaky test is a delivery-system bug.

When a test flakes:

- Identify the pattern.
- Check timing, state, data, environment, and isolation.
- Do not blindly add retries.
- Stabilize or quarantine with documented risk.
- Do not hide flaky failures from release decisions.

## Test Data

Test data should be:

- Deterministic
- Isolated
- Easy to clean up
- Safe
- Documented

Avoid depending on:

- Production data
- Manually created fragile data
- Test order
- Shared mutable state

## CI Testing

CI should:

- Run the right tests at the right stage.
- Preserve reports when useful.
- Fail visibly.
- Not skip tests silently.
- Separate fast PR checks from slower release checks when needed.

## Bug Fix Testing

Every bug fix should include:

- Reproduction path
- Regression risk
- Verification steps
- Recommended automated coverage
- Nearby areas to check

## Release Quality

Before release:

- Critical flows should be covered.
- Known gaps should be documented.
- Flaky tests should be assessed.
- CI should be green or failures explicitly accepted.
- SDET Lead should provide a release confidence recommendation.
