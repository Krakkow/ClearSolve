# User Preferences

This file captures project-relevant user preferences.

Do not store sensitive personal information here.

Only store preferences that affect how the project should be built, tested, documented, or managed.

## Preference Index

| ID | Preference | Area | Status |
|----|------------|------|--------|
| PREF-001 | | | Active |

---

## Preference Template

```markdown
## PREF-000: <Preference Title>

Status: Active | Deprecated | Superseded
Area: Code | Tests | Docs | Architecture | Workflow | Review
Source:
Date:

### Preference

### Reason

### How Agents Should Apply It

### Notes
```

---

## PREF-001: SDET-Oriented Infrastructure

Status: Active
Area: Workflow / Tests
Source: User
Date:

### Preference

The infrastructure should strongly support both development cycle and SDET cycle.

### Reason

The user wants reusable Claude agents for development and QA/SDET workflows.

### How Agents Should Apply It

Agents should include testing, quality gates, regression thinking, review, and release confidence in normal workflows.

### Notes

This preference is central to the project.
