# Claude Agent Commands

This folder contains reusable Claude Code slash commands for the SDLC/SDET agent infrastructure.

Place the command files under:

```text
.claude/commands/
```

A command file path maps to a slash command.

Example:

```text
.claude/commands/project/new.md
```

becomes:

```text
/project:new
```

## Recommended Usage Flow

### New Project

```text
/project:new <idea or short product description>
```

Use when starting a new product, app, tool, framework, or automation project.

Primary agents:
- orchestrator
- product-owner
- software-architect
- sdet-lead
- delivery-manager
- documentation-engineer

Expected outputs:
- PRD
- user stories
- acceptance criteria
- architecture
- test strategy
- task plan

---

### Existing Repository Analysis

```text
/repo:analyze
```

Use when onboarding to an existing repo or before making changes.

Primary agents:
- repository-analyst
- software-architect
- sdet-lead
- documentation-engineer

Expected outputs:
- repository assessment
- current architecture notes
- test assessment
- technical debt findings

---

### Feature Planning

```text
/feature:plan <feature request>
```

Use before implementation when the feature is not yet broken into tasks.

Primary agents:
- product-owner
- software-architect
- sdet-lead
- delivery-manager

Expected outputs:
- feature brief
- acceptance criteria
- implementation plan
- test plan

---

### Feature Implementation

```text
/feature:implement <task id or feature name>
```

Use when requirements and tasks are already clear.

Primary agents:
- orchestrator
- repository-analyst
- senior-fullstack-engineer
- code-reviewer
- sdet-lead
- documentation-engineer

Expected outputs:
- implementation
- validation notes
- review findings
- documentation updates

---

### Bug Investigation

```text
/bug:investigate <bug description, failing test, error, or log summary>
```

Use before fixing a bug.

Primary agents:
- bug-investigator
- repository-analyst
- sdet-lead

Expected outputs:
- reproduction steps
- root cause hypothesis
- severity
- fix direction
- regression recommendation

---

### Bug Fix

```text
/bug:fix <bug id or investigation summary>
```

Use after investigation or when the fix is obvious and scoped.

Primary agents:
- bug-investigator
- senior-fullstack-engineer
- sdet-lead
- code-reviewer

Expected outputs:
- fix
- regression notes
- validation
- review

---

### Generate Tests

```text
/test:generate <feature, requirement, or area>
```

Use to design and implement test coverage.

Primary agents:
- sdet-lead
- test-designer
- playwright-engineer or api-automation-engineer
- code-reviewer

Expected outputs:
- test cases
- automation coverage
- execution commands
- coverage gaps

---

### Review Code

```text
/review:code <task id, files, branch, or diff context>
```

Use after implementation and before merge.

Primary agents:
- code-reviewer
- security-reviewer if needed
- performance-reviewer if needed
- sdet-lead if needed

Expected outputs:
- review decision
- findings by severity
- required actions
- risks

---

### Release Preparation

```text
/release:prepare <version, milestone, or release scope>
```

Use before merge, handoff, or deployment.

Primary agents:
- sdet-lead
- security-reviewer
- devops-engineer
- release-manager
- documentation-engineer

Expected outputs:
- release checklist
- known risks
- rollback notes
- go/no-go recommendation

---

### Documentation Update

```text
/docs:update <area or change summary>
```

Use after implementation, release, architecture change, or setup change.

Primary agents:
- documentation-engineer

Expected outputs:
- updated README/docs
- handoff notes
- information gaps

---

### DevOps Setup

```text
/devops:setup <target: ci, docker, env, deploy>
```

Use for CI/CD, Docker, local setup, environment, and deployment work.

Primary agents:
- devops-engineer
- sdet-lead
- release-manager if deployment is involved

Expected outputs:
- CI/CD files
- Docker setup
- environment docs
- validation commands

---

## Important Operating Rules

1. Commands should route through the orchestrator unless the task is very narrow.
2. The orchestrator delegates; it does not implement.
3. Implementation should not begin without clear requirements or approved scope.
4. Bug fixes should include regression thinking.
5. Releases require quality, security, documentation, and rollback consideration.
6. Any major architecture, dependency, deployment, or security-sensitive change requires approval.

## Suggested First Commands To Use In A New Repo

```text
/repo:analyze
/project:new
/feature:plan
/feature:implement
/test:generate
/review:code
/release:prepare
```
