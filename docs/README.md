# Documentation Index — ClearSolve

> Working product name "ClearSolve" is a placeholder (PRD Q-009).
> Project status: **working preflop solver, active development** (see the [root README](../README.md) for what's built vs planned).

This folder holds the project's design artifacts. A working **preflop** solver exists (TypeScript engine, scenario builder, 2–9-handed cash); these documents describe the **full intended product**, including not-yet-built pieces (Rust→WASM engine, predefined cache, persistence, practice, postflop). The scope-expansion details and the implemented scenario model are in [DATA_MODEL.md](DATA_MODEL.md) **§13 / §13.9.1**. Start with the PRD and Architecture, then branch out by concern.

## Reading order (suggested)

1. [PRD.md](PRD.md) — what we're building and why (scope, constraints, requirements).
2. [ARCHITECTURE.md](ARCHITECTURE.md) — how it's built (components, data flow, hybrid cache/engine).
3. [TECH_DECISIONS.md](TECH_DECISIONS.md) — the key technology choices (ADRs) and approval gates.
4. [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — how delivery is sequenced (M0–M4).

## By concern

### Product & requirements
| Doc | Description |
|-----|-------------|
| [PRD.md](PRD.md) | Vision, scope, constraints, MoSCoW features, functional/non-functional requirements, business rules, flows, edge cases, risks summary. |
| [USER_STORIES.md](USER_STORIES.md) | User stories (US-*) per epic, mapped to features (FEAT-*) and requirements (REQ-*). |
| [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md) | Testable acceptance criteria (AC-*) per story. |
| [RISKS.md](RISKS.md) | Full risk register (likelihood, impact, mitigation, owner). |

### Architecture & design
| Doc | Description |
|-----|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture, data flow, cache/engine interop, exploitability model, memory budget, hosting & cross-origin isolation. |
| [TECH_DECISIONS.md](TECH_DECISIONS.md) | Architecture Decision Records (ADR-001..010) and approval gates A/B/C (all approved). |
| [DATA_MODEL.md](DATA_MODEL.md) | Canonical domain types (cards, ranges, trees, results, lookup keys) and persistence layout. |
| [API_SPEC.md](API_SPEC.md) | Internal contracts — Web Worker protocol + `SolverEngine` / `PredefinedCache` / `PersistenceStore` ports. There is no HTTP API. |

### Testing & quality
| Doc | Description |
|-----|-------------|
| [TEST_STRATEGY.md](TEST_STRATEGY.md) | What/why/how of testing; the reference-solver trust harness and toy-game oracles. |
| [QUALITY_GATES.md](QUALITY_GATES.md) | Concrete PASS/FAIL CI gates (correctness, cache integrity, resource safety, privacy, persistence). |
| [TEST_COVERAGE_MATRIX.md](TEST_COVERAGE_MATRIX.md) | Every acceptance criterion mapped to risk, test level, automation status, and owner. |

### Delivery & operations
| Doc | Description |
|-----|-------------|
| [DEVOPS.md](DEVOPS.md) | CI/CD, polyglot Rust→WASM→Vite build, cross-origin isolation, offline library-generation pipeline, deploy/rollback, config/secrets, local setup. |
| [TASKS.md](TASKS.md) | Executable backlog — Epics → Stories → Tasks (T-NNN). |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Sequencing, milestones (M0–M4), critical path, first vertical slice. |

## Related config (repo root)

- [`../public/_headers`](../public/_headers) — COOP/COEP + caching headers (Cloudflare Pages / Netlify).
- [`../.env.example`](../.env.example) — public build flags + CI/deploy secret names.
- [`../netlify.toml.template`](../netlify.toml.template) — alternative-host template.
- [`../.github/workflows/`](../.github/workflows/) — `ci.yml`, `generate-library.yml`, `deploy.yml`.
