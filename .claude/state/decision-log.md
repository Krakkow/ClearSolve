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

- Stakeholder to sign off GATE-A/B/C. (Approved 2026-06-24/25.)
- M0 feasibility spike: validate in-browser CFR quality/time/memory + cache pipeline + Q-001 tractability bound.
- Refine Q-010 predefined coverage list with stakeholder.

---

## DEC-003: Raw wasm32 cdylib (no wasm-bindgen) for the engine

Date: 2026-06-28
Status: Approved
Decision Owner: Owner + main (Claude)
Related Files: `engine/`, `src/wasm/`

### Decision
Build the Rust engine as a raw `wasm32-unknown-unknown` `cdylib` with `extern "C"` exports and manual linear-memory marshalling — NOT wasm-bindgen (a deviation from ADR-001).

### Context
wasm-bindgen's proc-macros require HOST compilation, which on this Windows machine needs the MSVC C++ Build Tools (multi-GB, not installed). A raw wasm32 cdylib uses Rust's bundled `rust-lld` and needs no MSVC.

### Chosen Option
Raw wasm32 cdylib. Data passed via `alloc_f64`/`free_f64` + `Float64Array` views — the performant path for a numeric solver anyway.

### Reason
Unblocks the engine port without a heavy toolchain install; marshalling overhead is irrelevant for bulk f64 buffers.

### Risks
Slightly more manual JS↔wasm glue. If wasm-bindgen ergonomics are later wanted, install MSVC build tools (or the GNU host toolchain) and revisit.

### Supersedes
The wasm-bindgen portion of ADR-001 (tooling only; Rust + CFR+ choices stand).

---

## DEC-004: Keep response charts CURATED — reject offline-solving them on the 2p model

Date: 2026-06-27
Status: Approved (finding)
Decision Owner: Owner + main (Claude)
Related Files: `src/domain/charts.ts`, README "Finding", `docs/DATA_MODEL.md §13.8`

### Decision
RFI charts are solver-generated (offline); vs-open and vs-3-bet stay hand-curated. Do NOT replace them with charts solved via the current 2-player-reduction engine.

### Context
Generating response charts via the 2p reduction produced structurally worse output than the curated reference: broken vs-3-bet pot geometry (opener "calls" ~61%), collapsed defender-position granularity, blind-vs-blind too tight, CO/BTN openers collapse.

### Reason
The curated reference charts are more accurate than the current model can produce; preferring the solved ones would regress quality.

### Follow-Up Actions
Revisit once a genuinely better engine (true multiway / postflop) exists.

---

## DEC-005: Add a full-hand-analysis epic (postflop + hand-history import) to scope

Date: 2026-06-28
Status: Approved
Decision Owner: Owner
Related Files: `docs/PRD.md` (full-hand-analysis epic), `docs/USER_STORIES.md`, `docs/IMPLEMENTATION_PLAN.md`

### Decision
Add a roadmap epic for full-hand analysis = (a) constrained postflop solving (continue a preflop spot onto flop/turn/river) AND (b) hand-history import + replay with per-decision GTO analysis.

### Context
Owner asked whether milestones include full-hand analysis; they did not. Owner chose to scope both flavors.

### Reason
Extends the tool from preflop-spot study toward analyzing complete played hands — a core GTO-trainer capability.

### Risks
Postflop in-browser feasibility (RISK-001); hand-history format parsing variety; scope growth. Sequenced AFTER the engine port (postflop needs the stronger engine).

---

## DEC-006: Add a 200bb chart tier + a depth-aware realization edge

Date: 2026-06-29
Status: Approved
Decision Owner: Owner
Related Files: `scripts/genLibrary.ts`, `src/domain/charts.ts`, `src/domain/projectSpot.ts`, `src/domain/generated/rfiLibrary.json`

### Decision
(1) Solve the RFI library offline at TWO depth tiers — ~100bb and ~200bb — and serve each instantly (200bb cash is the owner's actual game; it previously fell back to a slow live solve). (2) Make the see-flop realization edge depth-aware: a modest equity bonus above 100bb, ZERO at ≤100bb, position-scaled for opens (full in late position, tapering to a floor early), so deep ranges widen in late position while staying ~flat early.

### Context
Owner plays 200bb-max cash; asked whether the solver is fitted to 100 or 200bb. It was 100bb-tuned: the whole library + the realization-edge model are calibrated there, and the preflop-equity terminal is structurally rougher deep. Owner asked to (1) add a 200bb library tier, then (2) make the edge depth-aware.

### Reason
RFI at both depths is the visible win (instant, solved). The position-scaled depth bonus captures the real deep-stack effect (late/IP widens via implied odds; early ~unchanged) that a uniform scalar cannot — a first flat +0.03 bonus over-widened every position (6-max UTG 17%→25%, BTN 52%→64%), so it was replaced by position scaling.

### Risks
The depth edge is an explicit HEURISTIC, not a depth-resolved solve. The open-sizing abstraction (min-raise or jam only) still over-jams some opens — total open width is right, the min-raise/jam split is not. Curated vs-open/vs-3-bet remain 100bb-only; at 200bb those spots live-solve (with the depth edge) rather than serve a mis-depthed chart.

### Follow-Up Actions
Fix the open node to offer a realistic non-jam raise size (kills the over-jam artifact). Consider more depth tiers (50bb, 300bb) and solved deep response charts once the engine supports them.

