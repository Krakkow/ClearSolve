# Claude Agent Templates

This package contains reusable markdown templates for the Claude SDLC/SDET agent infrastructure.

Place these files under:

```text
.claude/templates/
```

Agents should use these templates when creating project artifacts under `docs/`.

## Included Templates

```text
.claude/templates/
├── prd-template.md
├── user-stories-template.md
├── acceptance-criteria-template.md
├── feature-brief-template.md
├── architecture-template.md
├── adr-template.md
├── api-spec-template.md
├── data-model-template.md
├── test-strategy-template.md
├── test-plan-template.md
├── test-case-template.md
├── coverage-matrix-template.md
├── bug-report-template.md
├── bug-investigation-template.md
├── rca-template.md
├── code-review-template.md
├── release-checklist-template.md
├── release-notes-template.md
├── rollback-plan-template.md
├── handoff-notes-template.md
└── technical-debt-template.md
```

## How To Use

Templates are source material. Agents should copy the relevant template into the correct `docs/` location and fill it in.

Examples:

```text
.claude/templates/prd-template.md
→ docs/PRD.md
```

```text
.claude/templates/feature-brief-template.md
→ docs/features/<feature-name>/FEATURE_BRIEF.md
```

```text
.claude/templates/bug-investigation-template.md
→ docs/bugs/<bug-id>/INVESTIGATION.md
```

## Rules

1. Do not leave placeholder text in final docs.
2. Mark unknowns as `TBD` or `Open Question`.
3. Do not invent facts.
4. Keep artifacts traceable to requirements, decisions, risks, and tasks.
5. Update state files when a major artifact is created or changed.
