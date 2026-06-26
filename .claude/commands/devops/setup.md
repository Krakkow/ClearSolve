# /devops:setup

Use this command for CI/CD, Docker, local environment, deployment, secrets, or build/test pipeline setup.

User input:
```text
$ARGUMENTS
```

## Mission

Act as the Orchestrator and run DevOps setup workflow.

Do not deploy to production unless explicitly approved.

## Workflow

Delegate in this order:

1. repository-analyst, if repo setup is unknown
2. devops-engineer
3. sdet-lead, for test stages and quality gates
4. release-manager, if deployment/release is involved
5. documentation-engineer

## Required Outputs

Create or update when relevant:

- `.github/workflows/ci.yml`
- `.github/workflows/pr-checks.yml`
- `.github/workflows/release.yml`
- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`
- `.env.example`
- `docs/CI_CD.md`
- `docs/ENVIRONMENT.md`
- `docs/LOCAL_SETUP.md`
- `docs/DEPLOYMENT.md`
- `docs/ROLLBACK.md`

## Approval Gates

Stop for approval before:

- production deployment
- changing release workflow
- adding cloud services
- changing secrets strategy
- weakening quality gates
- destructive infrastructure operations

## Final Response

Return:

```text
Status:
DevOps Scope:
Files Changed:
Commands:
Validation:
Risks:
Approval Needed:
Next Recommended Command:
```
