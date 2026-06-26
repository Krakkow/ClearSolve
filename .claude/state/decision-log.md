# Decision Log

This file records important product, architecture, testing, DevOps, release, and process decisions.

Do not delete old decisions. Append new decisions.

---

## Decision Template

```markdown
## DEC-000: <Decision Title>

Date:
Status: Proposed | Approved | Rejected | Superseded
Decision Owner:
Related Workflow:
Related Files:

### Decision

### Context

### Options Considered

#### Option 1

Pros:
Cons:

#### Option 2

Pros:
Cons:

### Chosen Option

### Reason

### Risks

### Follow-Up Actions

### Supersedes

### Superseded By
```

---

## DEC-001: Initial State Created

Date:
Status: Approved
Decision Owner: User / Orchestrator
Related Workflow: Infrastructure Setup
Related Files:
- `.claude/state/`

### Decision

Initialize persistent state management for the Claude SDLC/SDET agent infrastructure.

### Context

Agents need shared project memory to avoid repeating decisions, losing workflow status, or silently skipping blockers.

### Options Considered

#### Option 1: No state files

Pros:
- Simpler setup

Cons:
- Agents lose context
- Decisions repeat
- Workflow tracking is weak

#### Option 2: Markdown state files

Pros:
- Human-readable
- Git-trackable
- Easy for agents to read/update
- No external system needed

Cons:
- Requires discipline to maintain

### Chosen Option

Use markdown state files under `.claude/state/`.

### Reason

This provides lightweight, transparent project memory.

### Risks

- State can become stale if agents do not update it.

### Follow-Up Actions

- Keep state files updated during workflows.

---

## DEC-002: Initial Architecture for Browser-Native NLHE GTO Solver

Date: 2026-06-24
Status: Proposed (3 approval-gate items pending stakeholder sign-off)
Decision Owner: Software Architect
Related Workflow: Architecture design (new project)
Related Files:
- `docs/ARCHITECTURE.md`
- `docs/TECH_DECISIONS.md`
- `docs/DATA_MODEL.md`
- `docs/API_SPEC.md`

### Decision

Adopt a pure client-side, layered/hexagonal SPA with an isolated WASM CFR+ solver in a Web Worker, a two-tier predefined-solution cache (offline-generated, lazy binary shards) with automatic live-solve fallback, and hybrid IndexedDB+OPFS persistence. See full ADRs in docs/TECH_DECISIONS.md.

### Context

New project; PRD/stories/AC/risks approved. Constraints CON-1 (live WASM solver), CON-2 (pure client-side, static host), CON-3 (personal-use, high quality). Stakeholder steer: maximize solve quality (production-solver class) within browser limits; cache is the primary quality lever and the primary RISK-001 mitigation.

### Chosen Option

- Engine: Rust + wasm-bindgen (ADR-001); CFR+ primary, DCFR optional, vanilla as oracle (ADR-002).
- Threading: single-thread baseline + optional runtime-detected multi-thread (ADR-003).
- Frontend: React + TypeScript + Vite (ADR-004); Zustand + TanStack Query (ADR-005).
- Persistence: hybrid IndexedDB + OPFS; cache as compressed binary shards + index (ADR-006/007).
- Hosting: Cloudflare Pages / Netlify with COOP/COEP (ADR-008).
- Offline generation: shared Rust core native pipeline; external solver as validation oracle (ADR-009).

### Reason

Best balance of production-class quality, in-browser feasibility, testability, and trust within the hard constraints.

### Risks

RISK-001/003/004/005/006/010/014 addressed in ARCHITECTURE Sec 19. Approval gates: GATE-A (solver toolchain/core dep), GATE-B (deployment + threading scope), GATE-C (persistence strategy).

### Follow-Up Actions

- Stakeholder to sign off GATE-A/B/C.
- M0 feasibility spike: validate in-browser CFR quality/time/memory + cache pipeline + Q-001 tractability bound.
- Refine Q-010 predefined coverage list with stakeholder.
