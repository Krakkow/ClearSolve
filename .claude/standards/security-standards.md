# Security Standards

## Purpose

These standards define baseline security expectations.

## Core Principles

- Security is not optional.
- External input is untrusted.
- Authorization must be enforced server-side.
- Secrets must never be committed.
- Sensitive data must not leak to logs.
- Security risks must be visible before release.

## Secrets

Never commit:

- API keys
- Tokens
- Passwords
- Private keys
- Real connection strings
- Production credentials

Use:

- Environment variables
- Secret managers
- `.env.example` with placeholder values

## Authentication

Authentication flows should consider:

- Secure credential handling
- Token expiration
- Refresh behavior
- Logout behavior
- Session invalidation
- Brute force protection where relevant

## Authorization

Authorization must be checked server-side.

Check:

- Role access
- Resource ownership
- Tenant boundaries
- Privilege escalation
- Direct object references

## Input Validation

Validate:

- Request bodies
- Query params
- Path params
- File uploads
- External webhooks
- User-generated content

## Sensitive Data

Avoid logging:

- Passwords
- Tokens
- Personal identifiers when unnecessary
- Payment information
- Private keys
- Authorization headers

## Error Handling

Errors should:

- Be useful for debugging
- Avoid revealing internals
- Avoid leaking sensitive data
- Be consistent

## Dependencies

Before adding dependencies:

- Prefer maintained packages.
- Avoid unnecessary packages.
- Review security risk.
- Keep lockfiles.
- Run audit tools when practical.

## CI/CD Security

CI/CD should:

- Avoid printing secrets.
- Use minimum required permissions.
- Protect deployment workflows.
- Separate environments.
- Require approval for production deployment.

## Security Review Triggers

Require security review for:

- Authentication
- Authorization
- Payments
- Personal data
- Secrets/configuration
- File upload
- External input
- Public APIs
- Dependency changes
- Deployment changes

## Severity

Security findings should use:

```text
CRITICAL
HIGH
MEDIUM
LOW
INFO
```

Critical/high findings block release unless explicitly accepted by the user.
