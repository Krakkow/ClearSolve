# DevOps Standards

## Purpose

These standards guide CI/CD, local setup, Docker, environment configuration, deployment, and rollback.

## Core Principles

- CI should protect quality.
- Local and CI commands should align.
- Secrets must never leak.
- Deployments should be reversible.
- Quality gates should not be bypassed.
- Failures should be visible and diagnosable.

## CI/CD

Pipelines should include relevant stages:

- install dependencies
- lint
- typecheck
- unit tests
- integration/API tests
- E2E tests when appropriate
- build
- security/dependency checks when appropriate
- artifact/report upload when useful

## PR Checks

PR checks should be:

- Fast enough for feedback
- Strict enough to protect quality
- Clear when they fail
- Not overloaded with unnecessary slow tests

## Release Pipelines

Release pipelines should include:

- Build
- Test
- Security checks when relevant
- Artifact generation
- Deployment approval
- Smoke validation
- Rollback option

## Docker

Docker setup should:

- Be reproducible
- Avoid leaking secrets
- Use `.dockerignore`
- Keep images reasonably small
- Document ports and environment variables

## Environment Variables

Maintain `.env.example`.

Document:

- Variable name
- Required or optional
- Environment
- Description
- Example placeholder

## Deployment

Production deployment requires approval.

Deployment docs should include:

- Target environment
- Prerequisites
- Steps
- Smoke checks
- Rollback steps
- Known risks

## Destructive Commands

Never run destructive commands without approval, including:

- `rm -rf`
- `git reset --hard`
- `git clean`
- `terraform destroy`
- production database migrations
- production deploy commands
- `docker compose down -v` on important environments

## Troubleshooting

CI/CD docs should include common failures and fixes.
