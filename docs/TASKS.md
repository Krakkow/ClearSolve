# Tasks — Personal Browser-Native NLHE GTO Solver ("ClearSolve")

> Owner: Delivery Manager Agent
> Last Updated: 2026-06-24
> Status: READY FOR IMPLEMENTATION (pending implementation approval)
> Source of truth: `PRD.md`, `USER_STORIES.md`, `ACCEPTANCE_CRITERIA.md`, `RISKS.md`, `ARCHITECTURE.md`, `TECH_DECISIONS.md` (ADRs, all gates APPROVED), `DATA_MODEL.md`, `API_SPEC.md`, `TEST_STRATEGY.md`, `QUALITY_GATES.md`, `DEVOPS.md`
> Companion: `IMPLEMENTATION_PLAN.md` (sequencing, milestones, critical path, first slice)

This is the executable backlog. It decomposes approved scope into Epics -> Stories (reusing US-* IDs) -> Tasks (T-NNN). It does **not** redefine requirements, redesign architecture, or invent solutions; it sequences and sizes the work already specified upstream.

## How to read a task

Each task carries:
- **ID** — unique (T-NNN).
- **Desc** — concrete, executable objective.
- **Serves** — US-* / AC-* / REQ-* / FEAT-* it traces to.
- **Component** — layer per ARCHITECTURE Sec 4 (Domain / Application / State / UI / Worker / WASM-Engine / Cache / Persistence / Pipeline / DevOps / Test).
- **Deps** — other task IDs that must complete first.
- **Size** — XS / S / M / L / XL (effort+complexity, NOT time — performance/effort estimate per the no-time-estimate rule).
- **Role** — responsible agent type.
- **Gates** — QUALITY_GATES.md gate(s) the task must satisfy.

Roles used: `senior-fullstack-engineer` (TS + Rust), `devops-engineer`, `api-automation-engineer` (ports/protocol/trust-harness contract tests), `playwright-engineer` (component/E2E/visual/a11y), `performance-test-engineer` (perf/memory/bundle tracking), `sdet-lead` (trust-harness design, tolerance ownership), `documentation-engineer`.

> Sizing note: the Rust CFR+ engine tasks are the genuine XL/L risk concentration (RISK-005). UI tasks are mostly S/M. The cache pipeline and trust harness are L. Everything is deliberately small enough to start without reading the whole project history.

---

# MILESTONE M0 — FEASIBILITY SPIKE (FORMAL GO/NO-GO GATE) — runs FIRST

> M0 is a hard go/no-go gate (PRD Sec 18, QUALITY_GATES Sec 7, TEST_STRATEGY Sec 11). All postflop/live-solving scope downstream is CONDITIONAL on M0 = GO. M0 proves: (a) in-browser CFR+ quality/time/memory viability (ASM-001/002), and (b) the offline-generate -> bundle -> match pipeline viability (ASM-010/011). The single-thread CFR+ baseline is proven here before any threading.
>
> M0 is intentionally a throwaway-quality spike where needed: code may be rough, but the trust harness (Ring 1/3) and tolerance ratification it stands up are real and carried forward.

## Epic E0 — Spike Scaffolding & Toolchain

### Story: Minimal polyglot scaffold to run a spike (enabling, no US — supports US-001/US-018/US-024)

#### T-001
- Desc: Create the repo skeleton per DEVOPS Sec 1 layout: `engine/` (Rust crate), `frontend/` (Vite+React+TS placeholder), `tools/library-gen/`, root `public/_headers` template, `.env.example`. No app logic yet — just buildable shells.
- Serves: enabling (US-018, DEP-001, DEP-004)
- Component: DevOps
- Deps: none
- Size: S
- Role: devops-engineer
- Gates: G2.5 (build)

#### T-002
- Desc: Stand up the Rust engine crate (`engine/Cargo.toml`) that compiles BOTH to `wasm32-unknown-unknown` (via wasm-pack `--target web`) and natively (a `generate-library` bin stub). Prove `wasm-pack build` and `cargo build --release` both succeed with a trivial exported function. (ADR-001, ADR-009 shared-core.)
- Serves: enabling (REQ-001, ADR-001/009)
- Component: WASM-Engine / DevOps
- Deps: T-001
- Size: M
- Role: senior-fullstack-engineer
- Gates: G2.5

#### T-003
- Desc: Wire a minimal Vite+React+TS app that imports the wasm-pack `pkg`, instantiates the WASM in a Web Worker (`?worker`), and round-trips one message. Add the COOP/COEP dev/preview header snippet (DEVOPS Sec 4.3) so `crossOriginIsolated === true` locally. (ADR-003/004, REQ-002.)
- Serves: enabling (US-002, REQ-002, NFR-010)
- Component: UI / Worker / DevOps
- Deps: T-002
- Size: M
- Role: senior-fullstack-engineer
- Gates: G2.5, header-presence (RISK-006)

#### T-004
- Desc: Minimal CI (`ci.yml`) that builds WASM once (artifact), runs `cargo fmt/clippy/test`, `tsc`, `vite build`, and a placeholder Vitest run, with rust-cache + node cache (DEVOPS Sec 3.3/7). Single `ci-gate` aggregated status. Trust-harness + security jobs added advisory.
- Serves: enabling (all gates wiring)
- Component: DevOps
- Deps: T-001
- Size: M
- Role: devops-engineer
- Gates: G2.1-G2.6 wiring

## Epic E1 — Spike Solver Core (single-thread CFR+ baseline FIRST)

### Story (US-001): Prove a real in-browser solve is feasible

#### T-005
- Desc: Implement a minimal SINGLE-THREADED CFR+ core in Rust: game-tree build for a tiny spot, regret-matching+ update, running average strategy, best-response/exploitability calc. Seeded/deterministic (NFR-004). This is the correctness nucleus; threading is explicitly deferred to M1.
- Serves: US-001, REQ-001, AC-002, NFR-004; ADR-002
- Component: WASM-Engine
- Deps: T-002
- Size: XL
- Role: senior-fullstack-engineer
- Gates: G3.1 (in spirit), G3.2 (determinism, freq-sum)

#### T-006
- Desc: Stand up Ring 1 toy-game oracle harness in Rust `cargo test`: Kuhn poker, simplified HU push/fold, and a 2x2/3x3 zero-sum matrix; assert converged exploitability <= `epsilon_toy` and strategy matches analytic equilibrium (TEST_STRATEGY Sec 6.2). The non-negotiable engine gate.
- Serves: US-001, AC-002, QO-1; RISK-004
- Component: Test (Rust)
- Deps: T-005
- Size: L
- Role: senior-fullstack-engineer (Rust units) + sdet-lead (oracle design)
- Gates: G3.1

#### T-007
- Desc: Run the spike CFR+ on a real HU preflop spot through the WASM-in-worker path; assert frequency sums == 1 (BR-003), determinism (same seed -> identical), and capture measured solve time / peak WASM memory / info-set count (tracked, non-gating).
- Serves: US-001/002/003, AC-002/004; ASM-001
- Component: WASM-Engine / Worker / Test
- Deps: T-003, T-005, T-006
- Size: M
- Role: senior-fullstack-engineer + api-automation-engineer
- Gates: G3.2

## Epic E8 — Spike Predefined-Cache Pipeline & Match

### Story (US-024/US-025): Prove offline-generate -> bundle -> match -> fallback

#### T-008
- Desc: Build a minimal offline generation step: native `generate-library` solves 1 preflop + 1 canonical flop spot at higher iterations, then encode to a tiny two-tier `index.json` + one binary shard (quantized strategy) with `formatVersion` + integrity hash (ADR-007/009, DATA_MODEL Sec 7).
- Serves: US-024, AC-024; ASM-010/011, RISK-001/014
- Component: Pipeline
- Deps: T-005
- Size: L
- Role: senior-fullstack-engineer
- Gates: G4.7 (quantization round-trip)

#### T-009
- Desc: Implement a minimal `PredefinedCache` loader+matcher in TS: load+integrity-check index, derive a normalized `LookupKey` (with board isomorphism for the flop case), serve an exact-key hit (`iterations:0`, `source:'predefined'`), and demonstrate a deliberate miss -> live fallback and a corrupt-library -> disabled+fallback (API_SPEC Sec 4, ARCHITECTURE Sec 7).
- Serves: US-024/025/026, AC-024/025/026; BR-007/008, NFR-011
- Component: Cache / Domain / Application
- Deps: T-007, T-008
- Size: L
- Role: senior-fullstack-engineer + api-automation-engineer
- Gates: G4.1, G4.3, G4.4, G4.5

## Epic E-M0 — M0 Validation, Tolerances & Go/No-Go

#### T-010
- Desc: Stand up a minimal Ring 3 reference benchmark: at least 1 preflop + ideally 1 flop spot with committed reference-solver fixtures; measure per-action frequency divergence + exploitability vs the spike output (TEST_STRATEGY Sec 6.5/11). Decide/record the reference solver (GATE-A; SDET co-owns).
- Serves: AC-002 trust gate, QO-1; RISK-004/014
- Component: Test
- Deps: T-007
- Size: L
- Role: api-automation-engineer + sdet-lead
- Gates: G3.4 (WARN until ratified)

#### T-011
- Desc: Ratify the tractability bound (Q-001 / ADR-010) and the trust tolerances (`epsilon_toy`, `tol_exploit`, `tol_freq_max/mean`, `tol_equity`, `tol_ev`) against M0 measured data; record in a single-sourced shared config and in the decision log.
- Serves: Q-001, AC-006/013; TEST_STRATEGY Sec 6.6
- Component: Test / Domain (shared config)
- Deps: T-007, T-010
- Size: M
- Role: sdet-lead + senior-fullstack-engineer
- Gates: G3.6 (tolerance single-sourcing)

#### T-012
- Desc: Compile the M0 go/no-go report against QUALITY_GATES Sec 7 exit criteria (engine reaches acceptable exploitability in-budget; determinism holds; cache hit/miss/fallback/integrity demonstrated; bound+tolerances set; perf/memory/bundle envelope feasible). Human-confirmed GO/NO-GO logged in decision log.
- Serves: M0 gate (PRD Sec 18)
- Component: DevOps / Test (gate)
- Deps: T-006, T-007, T-009, T-010, T-011
- Size: S
- Role: sdet-lead + devops-engineer (escalates to Architect + Delivery + stakeholder)
- Gates: M0 milestone gate

> **GATE: M0 = GO required before any M3 (postflop) task and before promoting the engine beyond preflop. M1/M2 may begin once M0 = GO.**

---

# MILESTONE M1 — PREFLOP LIVE SOLVING, END-TO-END (thin vertical slice -> full preflop MVP)

> Goal: a real, production-shaped preflop HU live solve, off-thread, with strategy grid + EV/equity + exploitability + result-source labeling + persistence. Single-thread baseline is hardened here; multi-thread variant is layered on AFTER the single-thread baseline is correct and tested (threading = speed only, never correctness — ADR-003).

## Epic E-FOUND — Domain Core & Scaffolding (production-grade, replaces spike stubs)

#### T-100
- Desc: Implement the canonical Domain Core types per DATA_MODEL: `Card`/`Board`, `Rank`/`Suit`, 0..51 encoding, `HandClass`/`Range`/`Combo`, `BetSizingTree`, `Action`/`NodePath`, `SpotConfig`, `SolveSettings`, `SolveResult` family. Pure, framework-free, no I/O.
- Serves: enabling all; BR-001/002/003/004
- Component: Domain
- Deps: T-012 (M0 GO)
- Size: M
- Role: senior-fullstack-engineer
- Gates: G2.2, G2.7

#### T-101
- Desc: Implement Domain validation: card-uniqueness (board vs locked cards), valid ranks/suits, range weights in [0,1], all-zero-range invalid (BR-001/002/003, AC-007/008/010, EDGE-005). Property-based tests (fast-check) for total input coverage.
- Serves: US-006/007/009, AC-007/008/010; QO-9
- Component: Domain / Test
- Deps: T-100
- Size: M
- Role: senior-fullstack-engineer
- Gates: G2.6, G2.7, G9 (validation)

#### T-102
- Desc: Implement lookup-key derivation + canonical serialization incl. board isomorphism (suit-permuted equivalent flops -> same `boardCanonical`; suits map back on retrieval), and range refs (standard id vs custom content hash). Property-based: permutation-invariance + non-isomorphic-distinctness + range-hash stability (ARCHITECTURE Sec 7, DATA_MODEL Sec 7.1).
- Serves: US-024, AC-024; BR-008, RISK-014
- Component: Domain / Test
- Deps: T-100
- Size: L
- Role: senior-fullstack-engineer
- Gates: G4.2 (board isomorphism)

#### T-103
- Desc: Implement frequency-sum helpers, exploitability formatting/labeling (always `estimate`, `withinAbstraction`), unit handling (mbb/100 vs %pot, bb vs chips), and shard quantization decode round-trip helper (DATA_MODEL Sec 6, ADR-007).
- Serves: US-010/011/012, AC-011/012/013; BR-004/005
- Component: Domain / Test
- Deps: T-100
- Size: M
- Role: senior-fullstack-engineer
- Gates: G2.7, G4.7

#### T-104
- Desc: Independent equity/EV oracle (separate code path from the engine): exhaustive enumeration (or fixed-seed Monte Carlo with tolerance) for range-vs-range equity; EV indifference cross-check helper. Exact small-case assertions (AA vs KK ~ 81/19). (TEST_STRATEGY Sec 6.4.)
- Serves: US-011, AC-012; QO-3b, BR-004
- Component: Test (Rust + TS)
- Deps: T-100
- Size: L
- Role: senior-fullstack-engineer
- Gates: G3.2 (equity/EV cross-check)

## Epic E1 — Solver Engine (single-thread baseline hardened) [US-001..005]

#### T-110
- Desc: Promote the spike CFR+ core to a production single-threaded engine: full HU preflop tree build (open/limp, vs-open, vs-3bet, vs-4bet) from `(positions, stack, betTree, ranges)`; CFR+ with linear averaging + non-negative regret flooring; f32 accumulators (memory budget, ARCHITECTURE Sec 9); DCFR as a tunable variant; seeded determinism (ADR-002, NFR-004).
- Serves: US-001, AC-001/002; REQ-001, NFR-004
- Component: WASM-Engine
- Deps: T-100, T-006
- Size: XL
- Role: senior-fullstack-engineer
- Gates: G3.1, G3.2

#### T-111
- Desc: Implement `estimateCost` in the engine: analytic info-set/memory projection from streets x sizes x range combos BEFORE allocation; `withinBudget` flag + reduction suggestions (REQ-010, BR-006, AC-006, EDGE-001, ARCHITECTURE Sec 9).
- Serves: US-005, AC-006; REQ-010, RISK-003/010
- Component: WASM-Engine / Application
- Deps: T-110
- Size: M
- Role: senior-fullstack-engineer
- Gates: G5.1, G5.3

#### T-112
- Desc: Implement throttled progress emission (iteration count + periodic best-response exploitability, ~5-10 Hz), cooperative cancellation (flag checked between iteration batches) returning best-so-far labeled `converged:false`, and structured OOM signaling with `partialResult` (REQ-007/008, AC-004/005, EDGE-003/006, NFR-003).
- Serves: US-003/004, AC-004/005; REQ-007/008, NFR-003, RISK-010
- Component: WASM-Engine
- Deps: T-110
- Size: L
- Role: senior-fullstack-engineer
- Gates: G5.2, G5.5

#### T-113
- Desc: Implement the Web Worker message protocol (init/estimate/solve/cancel/dispose; ready/estimated/progress/solved/stopped/error/disposed) with `protocolVersion`, correlation ids, structured `WorkerError.code`, throttled progress, worker-termination detection on the client (API_SPEC Sec 3).
- Serves: US-001/002/003/004, AC-001/003/004/005; NFR-002/003
- Component: Worker / Application
- Deps: T-110
- Size: L
- Role: senior-fullstack-engineer
- Gates: G2.6 (contract), G5.5

#### T-114
- Desc: Implement the `SolverEngine` port + Worker Client adapter (main-thread facade): `init`/`estimateCost`/`solve`/`info`/`dispose`, `SolveHandle` (cancel + done), `EngineInfo` exposing `threading`/`crossOriginIsolated`/`simd`/`maxMemoryBytes` (API_SPEC Sec 2, testability invariant 7).
- Serves: US-001..005; AC-001..006
- Component: Application / Worker
- Deps: T-113
- Size: M
- Role: senior-fullstack-engineer
- Gates: G2.6

#### T-115 (TEST)
- Desc: Worker-protocol contract tests + real-WASM-in-real-worker thin integration: init/estimate/solve/cancel/dispose, progress throttling, `solved` vs `stopped`, error codes, protocol-version mismatch; run real engine on toy oracles + 1 benchmark spot; cancellation returns best-so-far; OOM yields structured error without UI crash (TEST_STRATEGY Sec 7.4).
- Serves: US-001..005, AC-001..006; QO-1/4
- Component: Test
- Deps: T-114
- Size: L
- Role: api-automation-engineer
- Gates: G3.1, G3.2, G5.2

## Epic E2 — Spot Configuration (preflop) [US-006, US-007]

#### T-120
- Desc: Build the 13x13 range editor UI: select + weight hands 0-100%, 169-class layout (pairs diagonal, suited upper-right, offsuit lower), visual reflection, output a `Range`. Custom CSS grid (ADR-004 follow-up). (FEAT-003, REQ-004, AC-008, BR-001.)
- Serves: US-007, AC-008
- Component: UI
- Deps: T-100, T-101
- Size: M
- Role: senior-fullstack-engineer
- Gates: G2.9; component tests
#### T-121
- Desc: Build the preflop HU spot configuration panel: effective stack depth, both positions, per-player range (uses T-120), validation surfacing (AC-007). Wire to State (Zustand spot-draft slice, ADR-005). (FEAT-002, REQ-003.)
- Serves: US-006, AC-007
- Component: UI / State
- Deps: T-120, T-101
- Size: M
- Role: senior-fullstack-engineer
- Gates: component tests
#### T-122 (TEST)
- Desc: Component tests for range editor + spot config: 169-class mapping correctness, weight bounds, range output shape, empty-range validation error blocks solve (AC-007/008).
- Serves: US-006/007, AC-007/008
- Component: Test
- Deps: T-121
- Size: S
- Role: playwright-engineer
- Gates: G2.6

## Epic E3 — Results & Insight [US-010, US-011, US-012]

#### T-130
- Desc: Build the strategy grid: action-colored 13x13 (colorblind-safe palette + non-color cue), per-cell action-frequency breakdown, frequency-sum display (BR-003). (FEAT-004, REQ-005, AC-011.)
- Serves: US-010, AC-011
- Component: UI
- Deps: T-103, T-121
- Size: M
- Role: senior-fullstack-engineer
- Gates: component + visual (G QO-11)
#### T-131
- Desc: Build the EV & equity panel: EV per action/hand with units, range-vs-range equity as % (BR-004). (FEAT-005, REQ-006, AC-012.)
- Serves: US-011, AC-012
- Component: UI
- Deps: T-103, T-130
- Size: S
- Role: senior-fullstack-engineer
- Gates: component tests
#### T-132
- Desc: Build the solve controls + transparency banner: start/stop, progress + iteration count, exploitability estimate labeled `estimate` (never "exact GTO"), abstraction/settings shown, and **result-source label** ("Predefined" vs "Live solve"). (FEAT-006, REQ-007/008/020, BR-005/007, AC-004/005/013/026.)
- Serves: US-003/004/012/026, AC-004/005/013/026
- Component: UI / State
- Deps: T-114, T-131
- Size: M
- Role: senior-fullstack-engineer
- Gates: component tests (G4.6 surface)
#### T-133 (TEST)
- Desc: Component + visual-regression tests for strategy grid, EV/equity panel, transparency banner: coloring, per-cell breakdown, units, source label, exploitability-as-estimate label, settings shown (AC-011/012/013/026).
- Serves: US-010/011/012/026, AC-011/012/013/026; QO-11
- Component: Test
- Deps: T-132
- Size: M
- Role: playwright-engineer
- Gates: G2.6, visual snapshots

## Epic E5 — Persistence (core) [US-015, US-016, US-017]

#### T-140
- Desc: Implement the `PersistenceStore` port over IndexedDB (`idb`) + OPFS: object stores per DATA_MODEL Sec 11 (`savedSpots`, `savedResults`, `drills`, `settings`, `libraryMeta`, `meta`); OPFS for large result blobs with OPFS-absent fallback to IDB blobs; transactional writes; schema-version migration scaffold (ADR-006, API_SPEC Sec 5).
- Serves: US-015/016, AC-016/017; REQ-009, NFR-006/007
- Component: Persistence
- Deps: T-100
- Size: L
- Role: senior-fullstack-engineer
- Gates: G-PERS
#### T-141
- Desc: Implement save/load/list/rename/delete use-cases for spots + results, wired to the Saved view UI (list, load -> restore config+result, rename, delete). (FEAT-007, REQ-009, AC-016/017.)
- Serves: US-015/016, AC-016/017
- Component: Application / UI
- Deps: T-140, T-121, T-132
- Size: M
- Role: senior-fullstack-engineer
- Gates: G-PERS
#### T-142
- Desc: Storage-quota surfacing + eviction comms: `navigator.storage.estimate()` meter, `navigator.storage.persist()` request, clear quota-exceeded error leaving no partial/corrupt record (AC-018, EDGE-004, NFR-007, RISK-013).
- Serves: US-017, AC-018
- Component: Persistence / UI
- Deps: T-140
- Size: M
- Role: senior-fullstack-engineer
- Gates: G-PERS
#### T-143 (TEST)
- Desc: Persistence integration tests: round-trip save/reload/restart retrieval; quota-exceeded leaves no partial record; OPFS-absent fallback; schema migration + version-mismatch warning (EDGE-008); storage/eviction comms present (AC-016/017/018, EDGE-004/008).
- Serves: US-015/016/017, AC-016/017/018; QO-5
- Component: Test
- Deps: T-142, T-141
- Size: M
- Role: api-automation-engineer
- Gates: G-PERS

## Epic E8 — Predefined Cache (preflop, production) [US-024, US-025, US-026]

#### T-150
- Desc: Implement the production `PredefinedCache` port: `init` (load+integrity/version-check index, OPFS shard caching), `status`, `lookup` (exact normalized-key match only, BR-008), `getEntry` (lazy shard fetch+decode -> `SolveResult` source:'predefined', iterations:0, GenerationMeta surfaced). Disable + notice + live fallback on corrupt/missing/version-mismatch (API_SPEC Sec 4, ARCHITECTURE Sec 4.7).
- Serves: US-024/025/026, AC-024/025/026; BR-007/008, NFR-011
- Component: Cache
- Deps: T-102, T-103, T-140
- Size: L
- Role: senior-fullstack-engineer
- Gates: G4.1-G4.7
#### T-151
- Desc: Implement `lookupOrSolve` application use-case (the hybrid entry point, API_SPEC Sec 6.1): deriveKey -> cache.lookup -> hit returns predefined; miss/disabled -> validate -> estimateCost -> budget gate -> live solve -> source:'live'. Never return unlabeled approximate predefined (BR-008).
- Serves: US-024/025/026, AC-024/025/026; QO-3
- Component: Application
- Deps: T-150, T-114, T-111
- Size: M
- Role: senior-fullstack-engineer
- Gates: G4.1/G4.3/G4.4/G4.5
#### T-152 (TEST)
- Desc: Application-layer integration with port fakes for `lookupOrSolve`: hit -> predefined + iterations:0 + engine.solve NEVER called; custom-range mismatch -> miss -> live; cache-disabled -> live + notice; budget gate over-budget -> OverBudgetError; source labeling correct (TEST_STRATEGY Sec 7.3).
- Serves: US-024/025/026, AC-024/025/026; QO-3
- Component: Test
- Deps: T-151
- Size: M
- Role: api-automation-engineer
- Gates: G4.1, G4.3, G4.4, G4.5, G4.6
#### T-153
- Desc: Generate + commit the M1 preflop cache tranche (Tranche 1: HU 100bb full preflop tree + small flop sample) via the offline pipeline (T-008 promoted), reference-validated and stamped `referenceValidated:true`; encode shards+index, human-reviewed, committed to `frontend/public/library/` (DEVOPS Sec 6, ARCHITECTURE Sec 18.4).
- Serves: US-024, AC-024; M2 coverage seed
- Component: Pipeline
- Deps: T-110, T-010
- Size: L
- Role: senior-fullstack-engineer + sdet-lead (validation)
- Gates: G4.8

## Epic E-PLATFORM (M1 portion) [US-018]

#### T-160
- Desc: First-load app shell: no install / no account usable path; engine + cache lazy-init; settings (units, default stack/bet-tree, threading preference, persistent-storage opt-in) wired to State + Persistence (AC-019, DATA_MODEL Sec 10).
- Serves: US-018, AC-019
- Component: UI / State / Application
- Deps: T-151, T-141
- Size: M
- Role: senior-fullstack-engineer
- Gates: E2E (G-PRIV adjacency)
#### T-161 (TEST)
- Desc: E2E for the M1 vertical: Flow 1 cache-hit instant path (assert no solve loop) + cache-miss live path (progress shown, "Live solve" label); no-network/privacy interception (zero compute egress, `connect-src 'self'`); responsiveness during solve (no long task > ~100ms); save/reload/restart (TEST_STRATEGY Sec 7.6).
- Serves: US-001/018/024/025/026/015, AC-001/003/016/024/025/026; QO-7/8
- Component: Test
- Deps: T-160
- Size: L
- Role: playwright-engineer
- Gates: G-PRIV, G5.5, G-PERS

## Epic E1 — Multi-threaded WASM variant (AFTER single-thread is correct) [US-001, US-002]

> Sequenced explicitly AFTER the single-thread baseline (T-110..T-115) is tested. Threading is an optimization layered on a correct base and MUST preserve correctness (NFR-004, ADR-003). GATE-B approved multi-thread in MVP with single-thread mandatory fallback first.

#### T-170
- Desc: Add the multi-threaded WASM build variant (`wasm-pack` with atomics/bulk-memory target features, wasm thread pool / `wasm-bindgen-rayon`, nightly + `-Z build-std` as needed). Runtime feature-detect `crossOriginIsolated` and select variant; same Web Worker boundary (ADR-003, DEVOPS Sec 5.4).
- Serves: US-001/002, NFR-010; RISK-006
- Component: WASM-Engine / DevOps
- Deps: T-115
- Size: L
- Role: senior-fullstack-engineer + devops-engineer
- Gates: G2.5 (both variants build)
#### T-171 (TEST)
- Desc: Single-thread vs multi-thread parity gate: same `(spot, settings, seed)` -> identical strategy (bit-exact target; single-sourced epsilon if FP reduction order forces it). Cross-origin-isolation matrix E2E: isolated engages multi-thread, non-isolated falls back, results identical (TEST_STRATEGY Sec 6.3/7.6, QO-2).
- Serves: US-001/002, NFR-004/010; RISK-006, QO-2
- Component: Test
- Deps: T-170
- Size: M
- Role: api-automation-engineer + playwright-engineer
- Gates: G3.3
#### T-172
- Desc: Add CI `wasm:build:mt` job + Playwright isolated `webServer` (COOP/COEP) so the threaded paths are exercised; promote `trust-harness`/`security` jobs from advisory to hard once tolerances ratified (DEVOPS Sec 5.4/7).
- Serves: enabling CI for threading
- Component: DevOps
- Deps: T-170, T-011
- Size: M
- Role: devops-engineer
- Gates: G3.3 wiring, G-PRIV wiring

> **M1 EXIT:** preflop live solve end-to-end (cache-hit + live-miss), grid/EV/equity/exploitability/source-label, persistence, single-thread baseline tested AND multi-thread parity green, privacy + responsiveness gates green. (See IMPLEMENTATION_PLAN.md.)

---

# MILESTONE M2 — PREDEFINED CACHE BREADTH + TRUST HARNESS (Ring 3) + REFERENCE VALIDATION

> Goal: full trust harness operational and gating; broaden the cache to all preflop depths; cache/live cross-source consistency proven. This is the "approaching production-grade fidelity" milestone for preflop.

## Epic E-TRUST — Reference-Solver Trust Harness (full) [cross-cutting]

#### T-200
- Desc: Build the full Ring 3 reference benchmark suite (preflop tranche: HU open/3bet/4bet at 20/40/60/100/200bb with standard ranges) as committed, version-stamped fixtures; per-action frequency divergence + exploitability + EV/equity metrics vs fixtures; PR-fast-subset vs nightly-full split (TEST_STRATEGY Sec 5.2/6.5/6.7).
- Serves: AC-002 trust gate; QO-1, RISK-004/014
- Component: Test
- Deps: T-110, T-011
- Size: L
- Role: api-automation-engineer + sdet-lead
- Gates: G3.4 (now hard at ratified tolerances)
#### T-201
- Desc: Cache/live cross-source consistency gate: for spots present in BOTH cache and live-solvable, predefined and live results agree within `tol_freq_max`/`tol_exploit` (G3.5). Dedicated test guarding RISK-004+RISK-014.
- Serves: AC-026 trust; QO-3, RISK-004/014
- Component: Test
- Deps: T-200, T-152
- Size: M
- Role: api-automation-engineer
- Gates: G3.5
#### T-202
- Desc: Release-gate check that every shipped predefined entry carries `GenerationMeta.referenceValidated === true` (G4.8); wire into nightly/release tier and the offline pipeline stamp.
- Serves: G4.8; RISK-014
- Component: Pipeline / DevOps
- Deps: T-200, T-153
- Size: S
- Role: devops-engineer + sdet-lead
- Gates: G4.8

## Epic E8 — Cache breadth (all preflop depths) [US-024, US-027]

#### T-210
- Desc: Generate + commit Tranche 2 preflop: all stack depths (20/40/60/100/200bb) full preflop trees, named-range entries, reference-validated and stamped; encode/commit per pipeline (ARCHITECTURE Sec 18.4, DEVOPS Sec 6).
- Serves: US-024, AC-024; M3 (qualitative coverage)
- Component: Pipeline
- Deps: T-153, T-200
- Size: L
- Role: senior-fullstack-engineer + sdet-lead
- Gates: G4.8

## Epic E7 — Practice / Drill mode [US-021, US-027]

#### T-220
- Desc: Implement drill scoring as a pure Domain function (accuracy = 1 - mean-abs-error or L1; `passed` threshold) with property tests (accuracy in [0,1], monotone in error) (DATA_MODEL Sec 9, AC-023).
- Serves: US-021, AC-023; QO-6
- Component: Domain / Test
- Deps: T-100
- Size: S
- Role: senior-fullstack-engineer
- Gates: G2.7
#### T-221
- Desc: Implement `runDrill`/`scoreDrill` use-cases: select spot from predefined index OR saved results, present prompt (solution withheld), accept estimate, reveal+score, persist `DrillRecord` (AC-023/027, API_SPEC Sec 6).
- Serves: US-021/027, AC-023/027
- Component: Application
- Deps: T-220, T-150, T-140
- Size: M
- Role: senior-fullstack-engineer
- Gates: integration (G4 adjacency)
#### T-222
- Desc: Build the Practice/drill view UI: prompt presentation, estimate input, reveal + score display, next-spot, source selector (predefined/saved) (FEAT-012, AC-023/027).
- Serves: US-021/027, AC-023/027
- Component: UI
- Deps: T-221, T-130
- Size: M
- Role: senior-fullstack-engineer
- Gates: component tests
#### T-223 (TEST)
- Desc: Application integration + E2E for practice: solution withheld until score; draws from predefined + saved; scoring correctness; drill record persisted (AC-023/027, TEST_STRATEGY Sec 7.3/7.6).
- Serves: US-021/027, AC-023/027; QO-6
- Component: Test
- Deps: T-222
- Size: M
- Role: playwright-engineer + api-automation-engineer
- Gates: G2.6

## Epic E-PERF — Performance/observability harness [cross-cutting]

#### T-230
- Desc: Build the perf/memory/bundle tracking harness (non-gating latency alerts; gating resource ceilings): record solve wall-time, iterations-to-`tol_exploit`, peak WASM memory, bundle size, shard fetch+decode time, cache-hit latency; baseline + regression alerts; bundle-size ceiling gate (TEST_STRATEGY Sec 8, QUALITY_GATES Sec 5).
- Serves: NFR-001; QO-4, RISK-003
- Component: Test / DevOps
- Deps: T-161, T-200
- Size: M
- Role: performance-test-engineer
- Gates: G5.4 (bundle ceiling, hard), G5a (alerts, non-blocking)

> **M2 EXIT:** Ring 1/2/3 + cross-source consistency gates hard-green at ratified tolerances; all preflop depths cached + reference-validated; practice mode working on cached/saved spots; perf harness + bundle ceiling live.

---

# MILESTONE M3 — CONSTRAINED POSTFLOP (CONDITIONAL ON M0 = GO)

> CONDITIONAL: this entire milestone proceeds only if M0 proved in-browser postflop within the tractability bound is viable. The cache (offline-generated) is the primary lever; live postflop is strictly bounded (REQ-011, ADR-010).

## Epic E2 — Postflop spot config [US-008, US-009]

#### T-300
- Desc: Build the bet-sizing tree builder UI from the allowed fixed set; selecting more sizes increases displayed estimated cost (AC-009); validation (FEAT-009, REQ-012, DATA_MODEL Sec 3).
- Serves: US-008, AC-009
- Component: UI / Domain
- Deps: T-111, T-121
- Size: M
- Role: senior-fullstack-engineer
- Gates: component tests
#### T-301
- Desc: Build board/runout input with validation (no duplicate cards, no conflict with locked range cards, valid ranks/suits) (FEAT-010, REQ-013, BR-002, AC-010, EDGE-005).
- Serves: US-009, AC-010
- Component: UI / Domain
- Deps: T-101, T-121
- Size: M
- Role: senior-fullstack-engineer
- Gates: component tests

## Epic E1/E4 — Postflop engine + constrained solve [US-014]

#### T-310
- Desc: Extend the CFR+ engine to bounded HU postflop (single board, <=2 solved streets, <=2-3 bet sizes/node, single raise size) with optional card/board bucketing abstraction (`abstractionId`) to fit the memory budget; enforce the ratified tractability bound (REQ-011, ADR-002/010, ARCHITECTURE Sec 9).
- Serves: US-014, AC-015; REQ-011, RISK-001/003
- Component: WASM-Engine
- Deps: T-110, T-011, T-012(GO)
- Size: XL
- Role: senior-fullstack-engineer
- Gates: G3.1/G3.2, G5.1
#### T-311
- Desc: Extend `estimateCost`/budget gate for postflop trees (streets x sizes x range combos); over-bound -> warn/block + reduction suggestions; bounded-in-budget solve completes with valid strategy/EV/equity/exploitability + progress/stop (AC-006/015, EDGE-001/007).
- Serves: US-005/014, AC-006/015
- Component: WASM-Engine / Application
- Deps: T-310, T-111
- Size: M
- Role: senior-fullstack-engineer
- Gates: G5.1, G5.3
#### T-312 (TEST)
- Desc: Real-WASM integration + trust harness for postflop: Ring 2 invariants on bounded postflop spots; Ring 3 postflop tranche (HU SRP BTN vs BB 100bb on canonical flop classes) vs reference fixtures; over-budget gating; OOM resilience (TEST_STRATEGY Sec 5.2/6/7.4).
- Serves: US-014, AC-015; QO-1/4, RISK-001
- Component: Test
- Deps: T-311, T-200
- Size: L
- Role: api-automation-engineer + sdet-lead
- Gates: G3.4 (postflop), G5.1/G5.2

## Epic E8 — Postflop cache tranche [US-024]

#### T-320
- Desc: Generate + commit the postflop cache (SRP BTN vs BB 100bb, canonical flop set flop->river, fixed small bet tree) reference-validated and stamped; lazy shards + small index; bundle-size discipline (ARCHITECTURE Sec 18.3, DEVOPS Sec 6).
- Serves: US-024, AC-024; RISK-001 primary mitigation
- Component: Pipeline
- Deps: T-310, T-200
- Size: XL
- Role: senior-fullstack-engineer + sdet-lead
- Gates: G4.8, G5.4
#### T-321 (TEST)
- Desc: E2E postflop cache-hit (instant, board-isomorphism suit mapback correct) + cache-miss bounded-live + over-budget block; cache/live cross-source consistency on overlapping postflop spots (AC-024/025/015, G3.5).
- Serves: US-014/024/025, AC-015/024/025
- Component: Test
- Deps: T-320, T-312
- Size: M
- Role: playwright-engineer + api-automation-engineer
- Gates: G3.5, G4.*

> **M3 EXIT:** bounded postflop live solve within ratified bound (valid strategy/EV/equity/exploitability, over-budget gated); postflop cache tranche shipped + reference-validated; postflop trust + cross-source gates green. (Skipped/re-scoped if M0 = NO-GO.)

---

# MILESTONE M4 — PRACTICE/UX POLISH, PWA/OFFLINE, OPTIONAL EXTRAS

> Goal: harden for personal use: offline/PWA, GTO tooltips, unsupported-browser gating, a11y, and the Could-priority export/import.

## Epic E6 — Platform & Offline [US-019, US-020]

#### T-400
- Desc: Implement the unsupported-browser gate: detect missing WASM / Web Workers / IndexedDB; show a clear non-broken message naming the missing capability/supported browsers (NFR-009, AC-020, EDGE-002).
- Serves: US-019, AC-020
- Component: UI / Application
- Deps: T-160
- Size: S
- Role: senior-fullstack-engineer
- Gates: E2E (AC-020)
#### T-401
- Desc: Implement PWA/offline: Service Worker pre-caches app shell + WASM + library index; shards cached on first use (OPFS); SW must NOT strip COOP/COEP isolation headers (designed together, ARCHITECTURE Sec 10, DEVOPS Sec 4.4). (FEAT-011, REQ-014, AC-021.)
- Serves: US-020, AC-021
- Component: DevOps / Application
- Deps: T-160, T-150
- Size: L
- Role: devops-engineer + senior-fullstack-engineer
- Gates: E2E offline+isolated (AC-021)
#### T-402 (TEST)
- Desc: E2E unsupported-browser gate + offline-after-first-load (second load, network disabled: app shell + WASM + cached library + saved work function); offline + cross-origin-isolation combination (AC-020/021, TEST_STRATEGY Sec 7.6).
- Serves: US-019/020, AC-020/021; QO-10
- Component: Test
- Deps: T-401, T-400
- Size: M
- Role: playwright-engineer
- Gates: cross-browser/isolation matrix

## Epic E3 — UX polish [US-013]

#### T-410
- Desc: GTO term tooltips/explanations (equity, EV, frequency, exploitability) with hover/tap help affordance (NFR-008, AC-014). Could-priority; proportionate for personal use.
- Serves: US-013, AC-014
- Component: UI
- Deps: T-131, T-132
- Size: S
- Role: senior-fullstack-engineer + documentation-engineer
- Gates: component tests
#### T-411 (TEST)
- Desc: Accessibility scan (axe) on key views + manual keyboard nav of the 13x13 grid + solve controls + action-palette contrast (colorblind-safe + non-color cue) (TEST_STRATEGY Sec 7.7, QO-12).
- Serves: a11y (NFR-008 adjacency); QO-12
- Component: Test
- Deps: T-130, T-132, T-410
- Size: S
- Role: playwright-engineer
- Gates: a11y review (Could)

## Epic E5 — Export/Import (Could) [US-022]

#### T-420
- Desc: Implement file-based spot export/import: serialize `ExportFile` (spot + optional result, versioned) via File System Access API or download/upload fallback; import is schema-validated (data-only, no code execution) and round-trips (FEAT-014, REQ-017, AC-022, ARCHITECTURE Sec 4.9/12).
- Serves: US-022, AC-022
- Component: Application / UI
- Deps: T-140, T-141
- Size: M
- Role: senior-fullstack-engineer
- Gates: import-validation; G2.6
#### T-421 (TEST)
- Desc: Export/import round-trip test (imported spot matches original; solvable/viewable as before) + import-file schema validation/sanitization (AC-022, security egress already covered).
- Serves: US-022, AC-022
- Component: Test
- Deps: T-420
- Size: S
- Role: api-automation-engineer
- Gates: G2.6

## Epic E-REL — Release readiness [cross-cutting]

#### T-430
- Desc: CI-driven deploy to Cloudflare Pages (`deploy.yml`): PR -> preview (no approval); main -> `production` env with required reviewer; post-deploy smoke check asserts live COOP/COEP; rollback = re-promote previous immutable deploy (DEVOPS Sec 8, GATE-B approved).
- Serves: US-018; deployment (CON-2)
- Component: DevOps
- Deps: T-161, T-172
- Size: M
- Role: devops-engineer
- Gates: G-PRIV smoke, header smoke
#### T-431
- Desc: Companion docs: DEPLOYMENT.md, ROLLBACK.md, ENVIRONMENT.md, LOCAL_SETUP.md (lifted from DEVOPS Sec 10/11) + in-app honest messaging review ("Predefined vs Live", "estimate not exact GTO", storage eviction) (PRD Handoff to Documentation Engineer).
- Serves: NFR-008; trust/UX
- Component: Docs
- Deps: T-430
- Size: S
- Role: documentation-engineer
- Gates: docs review
#### T-432
- Desc: Full release gate run (QUALITY_GATES Sec 8): all PR/merge gates green; G3.4/G3.5 full suite; G4.8 all entries validated; G5.* + G-PRIV + G-PERS; cross-browser/isolation matrix; a11y triaged; critical journeys green; SDET risk-based release recommendation.
- Serves: release readiness
- Component: Test / DevOps (gate)
- Deps: T-402, T-421, T-430, T-230
- Size: M
- Role: sdet-lead + devops-engineer
- Gates: Release/Milestone gate

> **M4 EXIT:** offline/PWA working (incl. isolated), unsupported-browser gate, tooltips, a11y triaged, export/import (if kept), production deploy with approval + smoke + rollback, release gate green.

---

## Task Count Summary

| Milestone | Tasks | Of which TEST tasks |
|-----------|-------|---------------------|
| M0 — Feasibility Spike (go/no-go) | T-001..T-012 (12) | T-006/007/010/012 |
| M1 — Preflop end-to-end | T-100..T-172 (≈34) | T-104/115/122/133/143/152/161/171 |
| M2 — Cache breadth + trust harness | T-200..T-230 (≈12) | T-200/201/223 + harness |
| M3 — Constrained postflop (conditional) | T-300..T-321 (≈10) | T-312/321 |
| M4 — Polish/PWA/extras/release | T-400..T-432 (≈12) | T-402/411/421/432 |
| **Total** | **≈80 tasks** | test tasks alongside every feature epic |

## Coverage check (against the brief's required surfaces)

- Project scaffolding (Vite+TS+React, Rust/wasm workspace, CI): T-001..T-004, T-160, T-172, T-430.
- M0 spike: T-005..T-012.
- Trust-harness / toy-oracle (M0 critical path): T-006, T-010, T-011 (M0); T-104, T-200, T-201, T-202 (full).
- Solver engine (card/range/tree, CFR+ core, equity/EV, exploitability, single->multi-thread): T-005, T-100..T-104, T-110..T-115, T-170..T-172, T-310/311.
- Worker protocol: T-113, T-114, T-115.
- Predefined-cache generation pipeline + loader/matcher: T-008/009 (spike), T-150..T-153, T-210, T-320; pipeline T-153/210/320.
- Persistence layer: T-140..T-143.
- UI (range grid, board/spot config, strategy/EV viz, results): T-120/121, T-130..T-133, T-300/301.
- Practice/drill mode: T-220..T-223.
- Export/import: T-420/421.
- PWA/offline + unsupported-browser: T-400..T-402.

Every Must/Should AC (AC-001..027) is covered by at least one TEST task at the lowest useful level; Could items (AC-014 tooltips, AC-022 export/import) are present but late and non-blocking.
