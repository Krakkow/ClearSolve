# Test Strategy — Personal Browser-Native NLHE GTO Solver ("ClearSolve")

> Owner: SDET Lead Agent
> Last Updated: 2026-06-24
> Status: DRAFT for stakeholder / Architect review
> Source of truth: `PRD.md`, `USER_STORIES.md`, `ACCEPTANCE_CRITERIA.md`, `RISKS.md`, `ARCHITECTURE.md`, `TECH_DECISIONS.md`, `DATA_MODEL.md`, `API_SPEC.md`
> Companion: `QUALITY_GATES.md` (enforceable gates), `TEST_COVERAGE_MATRIX.md` (AC/US -> test mapping)

This document defines WHAT we test, WHY, at WHICH level, and WHO (which automation specialist) implements it. It does not write production code or test code. Cross-references to PRD features (FEAT-*), requirements (REQ-*), business rules (BR-*), NFRs, acceptance criteria (AC-*), user stories (US-*), edge cases (EDGE-*), and risks (RISK-*) are inline.

---

## 1. Overview

ClearSolve is a pure client-side SPA NLHE GTO solver: a live CFR+ engine (Rust -> WASM, in a Web Worker, optionally multi-threaded via SharedArrayBuffer under COOP/COEP) plus a bundled predefined-solution cache and a practice/drill mode. All compute and persistence are local (IndexedDB + OPFS). There is no backend.

This shapes the entire test strategy in three decisive ways:

1. **Correctness/accuracy is the central quality risk, not performance.** Performance is best-effort with no latency SLA (NFR-001). The hardest and highest-value testing problem is *validating that a GTO solver is actually correct* — for both the live engine and the bundled cache. Section 6 (the Reference-Solver Trust Harness) is the centerpiece of this strategy.
2. **There is no HTTP API to test.** The system's real "API surface" is a set of internal TypeScript ports (`SolverEngine`, `PredefinedCache`, `PersistenceStore`, `AppApi`) and a Web Worker message protocol (`API_SPEC.md`). "API automation" here means contract/integration testing of these ports and the worker protocol, not REST/HTTP testing.
3. **The architecture was explicitly designed for testability** (ARCHITECTURE Sec 15): a pure domain core, ports as mockable seams, a deterministic seeded engine, and a versioned worker protocol. The strategy leans hard on these seams to keep the expensive real-WASM and E2E layers thin.

### 1.1 What "approaching production-grade fidelity" means for testing

The stakeholder steer is production-class solve *quality* (low measured exploitability), validated against an external reference solver. Translated to a testable definition:

- Quality is defined by **measured exploitability** and **strategy agreement vs a reference**, NOT by wall-clock time (decoupled per NFR-001).
- The pass/fail gate is an **exploitability tolerance threshold** plus a **per-action frequency divergence tolerance** against the reference, evaluated on a fixed benchmark suite.
- Toy games with *analytically known* equilibria (Kuhn poker, simplified push/fold) give us a ground-truth oracle the engine must match to tight tolerance — this is stronger than any reference solver because the answer is exact.

---

## 2. Quality Objectives & Risk-Based Priorities

Quality objectives in priority order, each mapped to risks and the dominant test type.

| # | Objective | Maps to | Dominant test approach | Priority |
|---|-----------|---------|------------------------|----------|
| QO-1 | **Solver correctness/accuracy** — live and predefined output is a genuine low-exploitability equilibrium and matches a trusted reference within tolerance | RISK-004, RISK-014, NFR-004/005, AC-002 | Trust harness: toy-game oracles + reference-solver benchmark (Sec 6) | Must |
| QO-2 | **Determinism & thread parity** — same input/seed -> same output; single-thread == multi-thread output | NFR-004, RISK-006, ADR-003 | Golden-output unit/integration; single-vs-multi parity tests (Sec 7.4) | Must |
| QO-3 | **Cache integrity & hybrid-flow correctness** — exact-key match only, correct hit/miss/fallback, correct source labeling, integrity/version handling | RISK-014, RISK-004, BR-007/008, AC-024/025/026, NFR-011 | Application-layer integration with fakes + real-cache integration (Sec 7.3) | Must |
| QO-3b | **Equity/EV correctness** — independent cross-check of equity and EV math | RISK-004, BR-004, AC-012 | Unit + independent oracle (Sec 6.4) | Must |
| QO-4 | **Resource safety** — over-budget gating, OOM resilience, no tab crash, best-so-far preservation | RISK-001/003/010, REQ-010, NFR-003, AC-006, EDGE-001/003 | Application integration + worker protocol + targeted real-WASM stress | Must |
| QO-5 | **Persistence integrity** — round-trip, quota handling, no partial/corrupt records, migration, eviction comms | RISK-003/013, NFR-007, AC-016/017/018, EDGE-004/008 | Persistence integration tests (fake-IDBFS / real IDB+OPFS) | Must |
| QO-6 | **Practice-mode scoring correctness** — scoring math is correct and spots draw from predefined/saved | REQ-021, AC-023/027 | Pure-unit (scoring) + application integration (Sec 7) | Must |
| QO-7 | **UI responsiveness during solve** — main thread not blocked > ~100ms | NFR-002, AC-003 | E2E long-task measurement (Sec 7.6) | Must |
| QO-8 | **No data egress / privacy** — zero compute/data network calls; only static-asset fetches | NFR-006, AC-001 | E2E network interception (Sec 7.6) | Must |
| QO-9 | **Input validation** — ranges, boards, card-uniqueness | BR-001/002/003, AC-007/008/010, EDGE-005 | Pure-unit + property-based (Sec 7.1) | Must |
| QO-10 | **Browser compatibility & cross-origin isolation** — graceful single/multi-thread selection; unsupported-browser gating | NFR-009/010, RISK-006, AC-019/020/021 | E2E across browser/isolation matrix (Sec 7.6, manual where needed) | Should |
| QO-11 | **Transparency/UX of strategy grids & trust labels** — grids render correctly; source + exploitability labels present and honest | BR-005/007, AC-011/013/026 | Component + E2E + visual + manual exploratory (Sec 7.5) | Should |
| QO-12 | **Accessibility** — keyboard/contrast for the dense grid UI | (NFR-008 adjacency) | Automated a11y scan + manual (Sec 7.7) | Could |

**Decisive ranking:** QO-1 (correctness) is the project's reason to exist and its biggest risk; it gets the deepest, most novel investment (the trust harness). QO-2/3/4 protect that correctness against threading, caching, and resource failures. Everything else is standard SPA quality assurance.

---

## 3. Test Pyramid for This App

The architecture (pure domain, ports, deterministic engine) lets us keep the pyramid bottom-heavy and the expensive real-WASM/E2E tiers thin.

```
                 /\
                /  \   Manual / Exploratory  (trust, UX, browser matrix, a11y)
               /----\
              /  E2E \  Key flows only: lookup-or-solve, practice, save/reload,
             /--------\ no-network, offline, unsupported-browser, responsiveness
            /  Real-   \
           / WASM integ \  Thin: real engine on toy games + small benchmark suite;
          /--------------\ thread parity; OOM/cancel; worker protocol over real worker
         /  Application   \
        /   integration    \  lookupOrSolve hit/miss/fallback, budget gate, source
       /--------------------\ labeling, persistence round-trip, drill flow — with FAKES
      /     Component         \  Range editor, strategy grid, EV/equity, transparency
     /------------------------ \ banner, practice view — RTL/component tests
    /          Unit (largest)    \  Domain core: validation, match-key normalization
   /------------------------------\ (board isomorphism), frequency-sum, scoring,
  /   Rust cargo unit/property      \ equity/EV oracle, quantization round-trip;
 /__________________________________\ Rust engine: regret-matching, tree build, CFR step
```

### 3.1 Layer responsibilities

- **Rust `cargo test` (engine core, native):** The CFR+ math, regret matching, tree construction, average-strategy computation, best-response/exploitability calculation, and the toy-game oracle checks live here. Native Rust tests are faster, richer, and run the *same core* that compiles to WASM and powers the offline generation pipeline (ADR-001/009). This is where most engine correctness is proven cheaply, before WASM ever enters the picture.
- **TS Unit (Vitest):** The pure domain core (DATA_MODEL types) — input validation (BR-001/002/003), lookup-key derivation incl. board isomorphism (ARCHITECTURE 7.1/7.2), frequency-sum invariant, drill scoring math (AC-023), shard quantization decode round-trip, equity/EV formatting. No mocks needed (ARCHITECTURE Sec 15).
- **Component (Vitest + React Testing Library):** UI units — 13x13 range editor, strategy grid coloring + per-cell breakdown, EV/equity panel, transparency banner (source label + exploitability), practice view, storage meter, unsupported-browser gate.
- **Application integration (Vitest, with port fakes):** `lookupOrSolve` and the use-cases composed over **fake** `SolverEngine`/`PredefinedCache`/`PersistenceStore`. This deterministically exercises hit/miss/fallback (AC-024/025), budget gating (AC-006), source labeling (AC-026), drill flow (AC-023/027), and persistence orchestration — without a real WASM run.
- **Real-WASM integration (Vitest/Playwright-worker or node-wasm):** A *thin* tier that runs the actual compiled engine in a real worker on the toy-game oracles and a small benchmark suite, plus worker-protocol contract tests, thread parity, cancel, and OOM.
- **E2E (Playwright):** Only the critical user journeys and cross-cutting invariants that require a real browser (network, OPFS, IndexedDB, cross-origin isolation, main-thread responsiveness).
- **Manual / Exploratory:** Trust spot-checks, strategy-grid visual correctness, GTO-term UX, the browser/device matrix (Q-007), and accessibility nuance.

---

## 4. Test Types & Scope

### 4.1 Functional testing
All Must/Should ACs (AC-001..027) are covered; mapping is in `TEST_COVERAGE_MATRIX.md`. Could-priority items (AC-022 export/import, AC-014 tooltips, responsive) are covered lightly or deferred.

### 4.2 Solver correctness / accuracy testing (the centerpiece — Sec 6)
The trust harness. Covers QO-1, QO-3b. Pass/fail is exploitability-tolerance and reference-agreement based, **decoupled from time** (NFR-001).

### 4.3 Determinism / reproducibility testing (Sec 7.4)
Same `(SpotConfig + SolveSettings + seed)` -> byte-identical strategy (NFR-004, AC-002). Includes single-thread vs multi-thread parity (the testable threading invariant: threading changes speed only, never correctness — ADR-003).

### 4.4 Performance as OBSERVABILITY, not a gate (Sec 8 / QUALITY_GATES Sec 5)
Per NFR-001 there is **no pass/fail latency gate**. We still *measure and track* solve time, iterations-to-target-exploitability, memory high-water mark, bundle size, shard decode time, and cache-hit latency, and we **alert on regressions** against a recorded baseline. Cache-hit must be "effectively instant / no solve loop" — that *is* a functional assertion (AC-024), not a timing one.

### 4.5 Memory / OOM resilience testing (Sec 7 / QO-4)
Over-budget estimation and gating (AC-006, EDGE-001); graceful OOM handling without tab crash where avoidable (NFR-003, EDGE-003, RISK-010); best-so-far preservation; worker isolation (a worker crash must not kill the UI).

### 4.6 Persistence / storage-eviction testing (QO-5)
IndexedDB + OPFS round-trip; quota-exceeded leaves no partial/corrupt record (AC-018, EDGE-004); schema migration + version-mismatch warning (EDGE-008); OPFS-absent fallback to IDB blobs (ADR-006); storage-usage and eviction communication (AC-018); persistent-storage request.

### 4.7 Browser compatibility incl. cross-origin isolation (QO-10)
- Single-thread baseline must work on a non-isolated context (no COOP/COEP).
- Multi-thread variant must engage only when `crossOriginIsolated === true` and produce identical results (parity, QO-2).
- Unsupported-browser gate when WASM/Web Workers/IndexedDB are missing (AC-020, EDGE-002).
- Offline after first load (AC-021): app shell, WASM, library index/shards from cache.
- Support matrix is Q-007-dependent (open). Default assumption: current Chromium + Firefox desktop; document as an assumption pending Q-007.

### 4.8 Accessibility (QO-12, Could)
Automated scan (axe) on key views; manual keyboard navigation of the 13x13 grid and solve controls; color-contrast check for the action-colored grid (important because the grid encodes meaning via color — a colorblind-safe palette and a non-color cue should be verified).

### 4.9 Visual / UX of strategy grids (QO-11, Should)
The 13x13 strategy grid, action-frequency coloring, and EV/equity panels are the product's core surface. Component tests assert structure/data; a small set of visual-regression snapshots guards rendering; manual exploratory confirms the grid is *readable and correct* (a subjective, high-value check that should not be over-automated).

### 4.10 Security (light, by design)
Threat surface is tiny (no backend, no auth). In scope: the no-egress assertion (AC-001, QO-8), import-file schema validation/sanitization (AC-022, data-only), and content-integrity handling of corrupt/version-mismatched library/WASM (NFR-011, EDGE-010). Deep security review is the Security Reviewer's remit; SDET provides the egress and import-validation tests.

---

## 5. Test Data Strategy

Test data must be deterministic, isolated, documented, and version-stamped (testing-standards Sec "Test Data"). Four categories:

### 5.1 Toy-game oracles (ground truth — highest trust value)
Small games with **analytically known equilibria**, used as exact correctness oracles for the engine:
- **Kuhn poker** — known Nash equilibrium family (parameterized by alpha); the engine's average strategy must converge to a known-exploitability point (exploitability -> 0).
- **Simplified push/fold (jam-or-fold) HU preflop** — for short stacks, the Nash jam/call ranges are computable (Nash equilibrium tables exist and are independently derivable); the engine must reproduce them within tolerance.
- **A trivial single-decision matrix / Rock-Paper-Scissors-style 2x2 or 3x3 zero-sum game** — closed-form equilibrium; smoke-tests regret matching itself.

These oracles are the strongest gate because the answer is *exact*, not "what another solver said." They run fast and live primarily in Rust `cargo test`.

### 5.2 Canonical NLHE benchmark spots (reference-solver validation)
A fixed, curated suite of real NLHE spots solved offline by an external reference solver (e.g. an open desktop solver such as the open-source TexasSolver / WASMPostflop-class engine, or PioSOLVER/GTO+ outputs where available). Each fixture stores: the `SpotConfig + SolveSettings`, the reference strategy (per-hand action frequencies), reference EV/equity, and reference exploitability. Used to validate both the live engine and the predefined cache. Suite is split:
- **Preflop tranche:** HU open/3bet/4bet at 20/40/60/100/200bb with standard ranges (mirrors the cache coverage in ARCHITECTURE Sec 18.2).
- **Postflop tranche:** HU SRP BTN vs BB 100bb on a handful of canonical flop classes with the fixed small bet tree (mirrors Sec 18.3).

### 5.3 Domain fixtures (deterministic, hand-built)
For unit/component/integration tests: sample `Range` objects (named + custom-with-hash), boards (valid, duplicate, conflicting — EDGE-005), bet-sizing trees of varying size (for cost-estimate monotonicity, AC-009), `SolveResult` fixtures (live + predefined variants), a synthetic `PredefinedIndex` + shard for cache tests, and corrupt/version-mismatched library fixtures (AC-025, EDGE-010).

### 5.4 Persistence fixtures
Saved spots/results/drills, oversized result blobs (to force the OPFS offload path), and a prior-schema-version DB image to test migration (EDGE-008).

### 5.5 Governance
- All benchmark fixtures are **version-stamped** with the reference solver + version + settings, and stored as committed assets (or generated by a documented, reproducible offline step). Stale fixtures are a tracked risk (RISK-014 analog for test data).
- Tolerances (exploitability + frequency divergence) are defined once in a shared config and referenced by every correctness test, so the gate is single-sourced and tunable (see Sec 6.5).

---

## 6. The Reference-Solver Trust Harness (CENTERPIECE)

This is the answer to the hardest quality problem: **how do you prove a GTO solver is correct?** A solver can run, converge, and still be wrong (bad tree, bad regret update, abstraction bug, equity bug). We attack this with a layered oracle strategy — from exact ground truth to external reference — with explicit, time-independent tolerance gates.

### 6.1 Design: three concentric rings of trust

```
  Ring 1 (innermost, EXACT): Analytic toy-game oracles
     Kuhn poker, push/fold Nash, 2x2/3x3 zero-sum.
     Gate: exploitability -> below epsilon_toy; strategy matches known equilibrium.
     -> Proves the CFR+ machinery (regret matching, averaging, BR/exploitability) is correct.

  Ring 2 (SELF-CONSISTENCY, no external dependency): Internal invariants
     - frequency sums == 1 (BR-003)
     - exploitability (own best-response) monotonically non-increasing trend & -> low
     - determinism: same seed -> identical output
     - single-thread == multi-thread (parity)
     - equity/EV independent cross-check (Sec 6.4)
     -> Proves the engine is internally coherent on real-sized spots even where no
        external ground truth exists.

  Ring 3 (outermost, EXTERNAL): Reference-solver benchmark
     Compare live + predefined output to an external reference solver on the
     canonical benchmark suite (Sec 5.2).
     Gate: per-action frequency divergence and exploitability within tolerance.
     -> Proves real-NLHE fidelity "approaching production-grade".
```

Each ring catches a different class of bug. Ring 1 catches engine-math bugs with certainty. Ring 2 catches regressions and threading/determinism bugs without needing an external tool in CI. Ring 3 catches abstraction/modeling fidelity gaps against the production-class bar.

### 6.2 Ring 1 — Analytic toy-game oracles (exact)
- Implemented primarily in Rust `cargo test` (fast, runs the real core).
- Kuhn poker: assert the converged average strategy's exploitability is below `epsilon_toy` (a tight bound, e.g. << 1 mbb/pot-equivalent) after a bounded iteration count, and that the strategy lies on the known equilibrium manifold.
- Push/fold HU: assert jam/call thresholds match an independently computed Nash table within a small hand-fraction tolerance.
- These are the **non-negotiable** engine gate: if Ring 1 fails, the engine is broken regardless of anything else.

### 6.3 Ring 2 — Self-consistency invariants
Run on real-sized preflop/bounded-postflop spots (live engine, real WASM in the thin integration tier):
- **Frequency-sum invariant** (BR-003, AC-002/011): every hand's action frequencies sum to 1 within tolerance.
- **Exploitability behavior:** the reported best-response exploitability decreases over iterations and reaches a low absolute value; it is always labeled an estimate and computed within the abstraction (honesty caveat, ARCHITECTURE Sec 8).
- **Determinism** (NFR-004): identical seed -> byte-identical strategy.
- **Thread parity** (ADR-003): single- and multi-thread variants produce identical strategy for the same seed (the explicit testable invariant requested by the stakeholder). Tolerance for parity is *tight* (ideally bit-exact; if floating-point reduction order differs across threads, define a small documented epsilon and justify it — but the goal is exact).
- **Cross-check equity/EV** (Sec 6.4).

### 6.4 Independent equity/EV cross-check
EV/equity bugs are a distinct correctness risk (BR-004, AC-012) and must not be validated by the same code that produces them:
- **Equity:** for a board + two ranges, compute range-vs-range equity with an *independent* method — exhaustive enumeration (or a large fixed-seed Monte Carlo with a tolerance) implemented separately from the engine's internal equity path — and assert agreement. Small/known cases (e.g. AA vs KK preflop equity ~ 81/19) are exact assertions.
- **EV:** assert internal consistency — at equilibrium, the EV of actions taken with positive frequency are equal within tolerance (indifference principle); and total EV is zero-sum consistent across the two players for the modeled pot.

### 6.5 Ring 3 — External reference-solver benchmark
- For each benchmark spot (Sec 5.2), compute a **per-action frequency divergence** between our output and the reference (e.g. mean and max absolute frequency difference across hands/actions, and/or an earth-mover/L1 metric), plus compare exploitability and EV/equity.
- **PASS** iff all of: max per-action frequency divergence <= `tol_freq_max`, mean divergence <= `tol_freq_mean`, our exploitability <= `tol_exploit` (absolute, e.g. in mbb/100), and EV/equity within `tol_ev` / `tol_equity`.
- This gate is **time-independent** (NFR-001): the engine may take as long as it needs (or run to a target exploitability) — only the *quality* of the converged result is judged.
- Applies identically to **predefined cache entries** (validated at generation time and re-validated as fixtures) and to **live solves**. This is exactly the RISK-004/RISK-014 mitigation: both result sources pass the same external bar.

### 6.6 Tolerance thresholds (single-sourced; Architect/SDET co-own)
Starter proposal (to be ratified in M0 against measured data; numbers are placeholders pending the spike):

| Threshold | Symbol | Starter proposal | Applies to |
|-----------|--------|------------------|------------|
| Toy-game exploitability | `epsilon_toy` | very tight, near-zero (e.g. <= 1 mbb/pot-equiv) | Ring 1 |
| Live/predefined absolute exploitability | `tol_exploit` | low (e.g. <= a few mbb/100; M0-tuned per spot class) | Rings 2/3 gate |
| Reference per-action freq divergence (max) | `tol_freq_max` | e.g. <= 0.05 (5 percentage points) on mixed nodes | Ring 3 |
| Reference per-action freq divergence (mean) | `tol_freq_mean` | e.g. <= 0.01-0.02 | Ring 3 |
| Equity cross-check | `tol_equity` | <= 0.5% (enumeration is near-exact) | Sec 6.4 |
| EV indifference | `tol_ev` | small relative tolerance | Sec 6.4 |
| Frequency-sum tolerance | — | <= 1e-3 | BR-003 everywhere |
| Quantization round-trip error | — | within display tolerance (e.g. <= 0.5% per action) | shard decode (ADR-007) |

These are defined in one shared test-config module and referenced everywhere. **Decisively: the exploitability tolerance is the primary pass/fail correctness gate, and it is decoupled from wall-clock time** (PRD NFR-001).

### 6.7 Where the harness runs
- **CI (every PR / merge):** Ring 1 (toy oracles, fast) + Ring 2 (self-consistency on a tiny spot set) + cache-integrity + the frequency-sum and quantization round-trip checks. Fast and deterministic.
- **CI (nightly / pre-release / milestone):** the full Ring 3 reference benchmark suite (slower; larger spots). The external reference outputs are committed fixtures so CI does not need the reference solver installed — it compares against stored reference data. Regeneration of reference fixtures is a documented, deliberate offline step (owned jointly with the offline-generation pipeline, ADR-009).
- **Offline generation pipeline (ADR-009):** every predefined entry is reference-validated at generation time and stamped `referenceValidated: true` (GenerationMeta). A release gate asserts all shipped entries carry that stamp.

### 6.8 What is automatable vs manual here
- **Automatable:** all of Rings 1-3 (oracle math, invariants, divergence metrics, tolerances). This is the bulk of the trust harness and is fully deterministic.
- **Manual/expert:** periodic expert spot-review of a few strategies for "does this look like sane GTO?" sanity (a cheap, high-value human check that catches modeling assumptions a metric can miss), and the decision to *update tolerances* or *accept abstraction error* — these are judgement calls, not automatable, and are logged as accepted-risk decisions.

---

## 7. Testing By Layer / Concern (detailed scope)

### 7.1 Domain core — Unit + property-based (Vitest; Rust where in core)
- Card/board validation: card-uniqueness, board-vs-locked-card conflict, valid ranks/suits (BR-002, AC-010, EDGE-005).
- Range model: 169-class layout (pairs diagonal, suited upper-right, offsuit lower — BR-001, AC-008), weight bounds [0,1], all-zero-range invalid (AC-007), combo expansion with board removal.
- **Lookup-key normalization** (the correctness-critical cache logic): canonical serialization; **board isomorphism** — strategically equivalent flops map to the same `boardCanonical` and suits map back correctly on retrieval (ARCHITECTURE 7.1/7.2). This is a prime **property-based testing** target: for random suit permutations of a flop, the canonical key is invariant; for non-isomorphic boards, keys differ.
- Frequency-sum invariant helper (BR-003).
- Drill scoring math (AC-023): accuracy/mean-abs-error/passed are correct for known estimate-vs-solution pairs; property: accuracy in [0,1], symmetric/monotone in error.
- Shard quantization decode round-trip (ADR-007): encode->decode preserves frequencies within tolerance.

Property-based testing (fast-check for TS, proptest for Rust) is recommended for: board isomorphism invariance, frequency-sum preservation through encode/decode, range hash stability/collision-resistance, and validation total-coverage (no input crashes the validator).

### 7.2 Rust engine core — `cargo test` (native)
- Regret matching / CFR+ update math (unit).
- Game-tree construction determinism and `infoSets` counting (feeds cost estimation).
- Average-strategy and best-response/exploitability computation.
- Toy-game oracles (Ring 1, Sec 6.2) — proptest where helpful.
- Native run of the *same core* used in WASM and the offline pipeline, so engine correctness is proven before WASM packaging.

### 7.3 Application layer — Integration with port fakes (Vitest)
Target: `lookupOrSolve` and use-cases (API_SPEC Sec 6), using fake `SolverEngine`/`PredefinedCache`/`PersistenceStore`.
- **Hybrid flow** (AC-024/025, BR-008): cache hit -> predefined result, `iterations:0`, **no engine.solve called** (assert the fake engine is never invoked on a hit); cache miss -> validate -> estimateCost -> live solve; cache-disabled -> live with notice.
- **Strict matching**: custom-range mismatch is a miss -> live (Sec 7.2 of ARCHITECTURE); never return unlabeled approximate predefined (BR-008).
- **Budget gate** (AC-006, EDGE-001): over-budget estimate -> OverBudgetError -> UI blocks/warns with suggestions; in-budget -> proceeds.
- **Source labeling** (AC-026): result carries correct `source` + generation settings/exploitability.
- **Drill flow** (AC-023/027): solution withheld until scoreDrill; draws from predefined or saved; record persisted.
- **Persistence orchestration** (AC-016/017): save/load/list/rename/delete via fake store.

### 7.4 Real-WASM integration — thin (Vitest node-wasm / Playwright worker)
- Worker message-protocol contract tests (API_SPEC Sec 3): init/estimate/solve/cancel/dispose; progress throttling; `solved` vs `stopped`; error codes (`oom`, `invalid-input`, `protocol-mismatch`); correlation ids; protocol-version mismatch handling.
- Run the real engine on toy oracles + a small benchmark subset (Rings 1-3 smoke in a real worker).
- **Determinism & thread parity** (QO-2): real single- vs multi-thread engine, same seed -> identical strategy.
- **Cancellation** (AC-005, EDGE-003/006): stop returns best-so-far within bounded time, `converged:false`, exploitability present.
- **OOM** (NFR-003, RISK-010): a deliberately over-budget-but-forced solve yields a structured `oom` error or a cleanly terminated worker that the client detects, with best-so-far where available and **no UI-thread crash**.

### 7.5 Component — RTL/Vitest
- 13x13 range editor: select/weight, visual reflection, 169-class mapping, output range correctness (AC-008).
- Strategy grid: cells colored by action mix, per-cell frequency breakdown, frequencies sum displayed (AC-011); colorblind-safe + non-color cue check feeds a11y.
- EV/equity panel: units shown, equity as % (AC-012, BR-004).
- Transparency banner: "Predefined" vs "Live solve" label, exploitability labeled *estimate*, abstraction/settings shown (AC-013/026, BR-005/007).
- Practice view: prompt, estimate input, reveal+score (AC-023).
- Storage meter + eviction notice (AC-018); unsupported-browser gate (AC-020).

### 7.6 E2E — Playwright (critical journeys only)
- **Flow 1 lookup-or-solve**: cache-hit instant path (assert no solve progress loop) and cache-miss live path (progress shown, result labeled) — AC-024/025/026, US-001/024/025/026.
- **No-network/privacy** (AC-001, NFR-006, QO-8): intercept requests; assert zero compute/data egress; only static-asset GETs (app/WASM/library) allowed. `connect-src 'self'` CSP behavior.
- **Responsiveness during solve** (AC-003, NFR-002): measure main-thread long tasks while a live solve runs; assert no block > ~100ms.
- **Save/reload/restart** (AC-016/017): persist, reload, restart-equivalent, data retrievable; rename/delete.
- **Over-budget** (AC-006): configure an over-bound spot; assert warning/block + suggestions.
- **Practice** (AC-023/027): drill a predefined + a saved spot, get scored.
- **Offline after first load** (AC-021): second load with network disabled; app + cache + saved work function.
- **Unsupported browser** (AC-020): simulate missing capability; assert clear gate.
- **Cross-origin isolation matrix** (QO-10): isolated context engages multi-thread; non-isolated falls back to single-thread; results identical (ties to parity).

E2E is deliberately narrow per testing-standards (critical journeys, not every edge case). Edge cases are pushed down to unit/integration.

### 7.7 Accessibility & visual
- axe automated scan on key views; manual keyboard nav of grid + solve controls; contrast on action palette.
- Visual-regression snapshots for the strategy grid and EV/equity panel (small, stable set; not screenshot-as-assertion overuse).

---

## 8. Performance Strategy — Observability, NOT a Gate

Per NFR-001, performance is best-effort with **no pass/fail latency SLA**. Strategy:
- **Track, don't block.** Record per-benchmark-spot: solve wall-time, iterations to reach `tol_exploit`, peak WASM memory, bundle size (app + WASM + library index), shard fetch+decode time, cache-hit latency. Store a baseline.
- **Regression ALERTS (non-blocking by default).** A configurable % regression vs baseline raises an alert/annotation on the PR for human judgement; it does not fail the build (unless a hard *resource* ceiling is crossed — see below). This respects "correctness over speed" while preventing silent perf rot.
- **Hard resource ceilings ARE functional gates** (distinct from latency): a solve must not exceed its declared `memoryBudgetBytes` (else the budget gate/OOM handling failed — QO-4), and the predefined bundle must stay under an agreed size budget (RISK-003). These are pass/fail because they protect device safety and load, not because they time anything.
- **Cache-hit "instant"** is asserted functionally (no solve loop ran, `iterations:0` — AC-024), not as a time threshold.
- Owner: performance-test-engineer builds the tracking harness; SDET defines what is tracked and the alert thresholds.

---

## 9. WASM / Worker Code Testing Approach

The engine is the hardest, highest-risk component (RISK-005); it is tested at four removes from "expensive E2E":
1. **Native Rust** (`cargo test`) for all engine math + toy oracles — fast, no WASM, runs the same core (ADR-001/009).
2. **Domain-side TS** validates everything the worker consumes/produces that lives in TS (keys, validation, result shaping) without the worker.
3. **Application fakes** validate the orchestration around the engine without a real solve.
4. **Thin real-WASM-in-real-worker** validates packaging, the message protocol, determinism, thread parity, cancel, and OOM — the things only the real worker can prove.

Worker-specific testability requirements (Sec 11 flags these to the Architect/engineers):
- The worker protocol is **versioned** (`protocolVersion`) and **contract-tested** as a first-class artifact.
- Progress events are **throttled deterministically** (so tests aren't flaky on event volume).
- Cancellation is **cooperative with bounded latency** (testable stop time).
- Errors are **structured** (`WorkerError.code`) so tests assert on codes, not message strings.
- The engine is a **pure function of `(spot, settings, seed)`** so golden-output tests are stable (NFR-004).

---

## 10. Traceability

Full mapping is in `TEST_COVERAGE_MATRIX.md`. Summary of coverage by epic/story:

| Epic / area | Stories | Key ACs | Primary level | Owner agent |
|-------------|---------|---------|---------------|-------------|
| Solver engine | US-001..005 | AC-001..006 | Rust unit + real-WASM integ + trust harness | api-automation-engineer (ports/protocol), engineer (Rust unit) |
| Predefined cache | US-024..026 | AC-024/025/026 | Application integ (fakes) + real-cache integ | api-automation-engineer |
| Spot config | US-006..009 | AC-007/008/009/010 | Unit + component | playwright-engineer (component/E2E), engineer (domain unit) |
| Results & insight | US-010..013 | AC-011/012/013/014 | Component + unit (equity/EV oracle) | playwright-engineer + engineer |
| Postflop | US-014 | AC-015 | Real-WASM integ + trust harness | api-automation-engineer |
| Persistence | US-015..017, US-022 | AC-016/017/018/022 | Persistence integ + E2E | api-automation-engineer + playwright-engineer |
| Platform | US-018..020 | AC-019/020/021 | E2E (browser/isolation matrix) | playwright-engineer |
| Practice | US-021, US-027 | AC-023/027 | Unit (scoring) + application integ + E2E | engineer + playwright-engineer |
| Cross-cutting trust | (all engine/cache) | AC-002 (trust gate) | Trust harness (Sec 6) | SDET-led, api-automation-engineer + engineer |
| Cross-cutting privacy/perf/a11y | — | AC-001/003 | E2E + perf-harness + a11y scan | playwright-engineer + performance-test-engineer |

Every AC maps to at least one automated test at the lowest useful level; the matrix flags any AC that is manual-only or has a coverage gap.

---

## 11. M0 Feasibility-Spike Testing & Exit Criteria

M0 proves (a) in-browser CFR feasibility and (b) the predefined-cache approach. From a quality standpoint, M0 is also where the **trust harness and tolerances are first stood up and ratified against real data**. M0 is a formal go/no-go gate (also stated in QUALITY_GATES Sec 7).

**M0 testing deliverables (SDET-owned or co-owned):**
- Ring 1 toy-game oracle harness operational in Rust (Kuhn + push/fold) and passing for the prototype engine.
- A minimal Ring 3 reference benchmark: at least one preflop spot + one canonical flop spot, with reference fixtures, and a measured divergence/exploitability result.
- Determinism check (same seed -> identical output) on the prototype.
- If a threaded prototype exists: a first single-vs-multi parity check.
- Cache prototype: an index + sample shard, an exact-key match served, a deliberate miss falling back to live, and a corrupt-library fallback — all asserted.
- Measured (tracked, non-gating) perf/memory/bundle numbers to **ratify or revise the tractability bound (Q-001)** and the tolerance thresholds (Sec 6.6).

**M0 EXIT CRITERIA (go/no-go) — quality view:**
- GO requires: Ring 1 oracles pass; the engine produces a valid strategy (frequency sums == 1) on a real preflop spot; determinism holds; at least one Ring 3 benchmark spot meets (or is credibly within reach of, with a documented path) the exploitability + divergence tolerances; the cache hit/miss/fallback + integrity behaviors are demonstrated; and the tractability bound + tolerances are set with measured backing.
- NO-GO / RE-SCOPE if: the engine cannot reach acceptable exploitability on bounded spots in *any* in-browser-feasible budget, OR determinism/parity cannot be achieved (undermines trust), OR the cache approach cannot match/serve correctly. (These would trigger an architecture/scope revisit — escalate to Architect + Delivery + stakeholder.)

The full M0 exit gate (including non-quality feasibility items owned by Architect/DevOps) is consolidated in `QUALITY_GATES.md` Sec 7.

---

## 12. Automatable vs Manual/Exploratory — explicit split

**Automatable (the large majority):**
- All engine correctness (toy oracles, invariants, reference divergence, equity/EV cross-check) — Sec 6.
- Determinism + thread parity — Sec 6.3/7.4.
- Cache hit/miss/fallback/integrity/labeling — Sec 7.3/7.4.
- Budget gating + OOM/cancel handling — Sec 7.3/7.4.
- Persistence round-trip/quota/migration — Sec 7 (QO-5).
- Drill scoring + flow — Sec 7.1/7.3.
- No-network/privacy, responsiveness, offline, unsupported-browser — Sec 7.6.
- Input validation (incl. property-based) — Sec 7.1.
- a11y automated scan, visual-regression snapshots — Sec 7.7.
- Perf/memory/bundle tracking (alerts) — Sec 8.

**Manual / Exploratory (small, high-judgement):**
- Expert "does this strategy look like sane GTO?" spot-review (catches modeling assumptions metrics miss).
- Strategy-grid *readability* and color-encoding clarity (subjective).
- GTO-term UX / tooltip helpfulness (AC-014, Should).
- Real browser/device matrix beyond the CI set (Q-007-dependent; for a single-user tool this is light — primarily the owner's own browser).
- Accept-the-risk decisions: tolerance changes, abstraction-error acceptance, flaky-test quarantine.

---

## 13. Flakiness Management

Per testing-standards, a flaky test is a delivery-system bug, not a nuisance to retry away. Specific risks here and mitigations:
- **Solve-progress event volume** -> throttle deterministically; assert on final/structured state, not event counts.
- **Floating-point nondeterminism across threads** -> the goal is bit-exact parity; if reduction order forces a documented epsilon, single-source it and justify it. Never paper over with loose tolerances that could hide real divergence.
- **Real-WASM/E2E timing** -> use event/state waits, never sleeps; rely on the deterministic seeded engine for golden outputs.
- **OPFS/IndexedDB cross-test bleed** -> each test uses an isolated origin/DB and cleans up; no shared mutable storage.
- **Reference-fixture staleness** -> version-stamp fixtures; regeneration is deliberate and reviewed.
- Quarantine policy: quarantined tests are documented with the risk they no longer cover, surfaced in release decisions, never silently skipped.

---

## 14. Tooling Recommendations

| Concern | Recommended tool | Rationale |
|---------|------------------|-----------|
| TS unit / component / application integ | **Vitest** + **React Testing Library** | First-class Vite integration (ADR-004), fast, ESM/WASM-friendly |
| Property-based (TS) | **fast-check** | Board isomorphism, validation, hashing invariants |
| Engine unit + toy oracles (native) | **Rust `cargo test`** (+ **proptest**) | Same core as WASM + offline pipeline (ADR-001/009); fastest path to engine correctness |
| Worker-protocol + real-WASM integ | **Vitest (node + wasm)** and/or **Playwright workers** | Contract-test the protocol; run real engine on oracles |
| E2E | **Playwright** | Cross-browser, network interception, OPFS/IDB, long-task/perf, cross-origin-isolation contexts |
| Visual regression | **Playwright snapshots** (small set) | Guards grid rendering without screenshot overuse |
| Accessibility | **axe-core** (via Playwright/Vitest) + manual | Automated scan + human keyboard/contrast |
| Perf/memory/bundle tracking | **Playwright tracing + custom harness**; bundle-size check in CI | Observability + regression alerts (non-gating latency) |
| Coverage | Vitest coverage (c8) + `cargo llvm-cov` | Sensible thresholds (QUALITY_GATES Sec 2) |

Final tool selection is the implementing agents' call within these recommendations; deviations should be justified.

---

## 15. Coverage Gaps & Known Limitations

- **Reference-solver authority:** our Ring 3 bar is only as good as the chosen reference solver (GATE-A / ADR-009). If the reference itself is imperfect, Ring 1 (exact oracles) and Ring 2 (self-consistency) remain our backstops. The *choice of reference solver* is an open dependency SDET co-owns (ADR-009 follow-up).
- **Abstraction error is partially unmeasurable in-app:** reported exploitability is *within the abstraction*; the gap to full NLHE is a known, honestly-labeled limitation (ARCHITECTURE Sec 8), not a thing we can fully gate. Ring 3 (reference comparison on the unabstracted-as-played benchmark) is our best handle on it.
- **Browser/device matrix (Q-007 open):** until the support matrix is fixed, compatibility coverage targets a default Chromium+Firefox-desktop assumption; broaden once Q-007 resolves.
- **Tractability bound (Q-001 open) and tolerances (Sec 6.6):** placeholders until M0 ratifies them with measured data.
- **Predefined coverage list (Q-010 open):** test fixtures mirror the Architect's proposed coverage (ARCHITECTURE Sec 18); they must track whatever coverage is finally chosen.
- **Could-priority items** (export/import AC-022, responsive, tooltips AC-014) get light coverage and may be deferred without blocking MVP.

---

## 16. Open Risks (quality view)

- The hardest risk remains **proving correctness of a result for which there is no exact ground truth** (real NLHE postflop). Mitigated by the three-ring harness but never reduced to zero — hence the permanent honesty labeling (BR-005/007) and the expert manual spot-review.
- **Determinism under threading** must hold or trust is undermined (QO-2). If bit-exact parity proves infeasible, that is a material finding requiring a documented decision.
- **Reference-fixture maintenance** is ongoing operational cost (RISK-014 analog for test assets).
- **Cache/live divergence:** a predefined entry and a live solve of the *same* spot should agree within tolerance; a dedicated cross-source consistency test guards this (ties RISK-004 + RISK-014).

---

## 17. Handoff Notes

- **To Architect/engineers:** see Sec 11 of this doc and Sec 18 below for the testability requirements that must be honored (deterministic seeded engine, versioned/contract-testable worker protocol, structured errors, pure domain, injectable ports, exposed `crossOriginIsolated`/threading mode, reference-solver choice). Most are already promised in ARCHITECTURE Sec 15 — they must be preserved through implementation.
- **To api-automation-engineer:** own the internal-contract tests — `SolverEngine`/`PredefinedCache`/`PersistenceStore` ports, the worker message protocol, `lookupOrSolve` hybrid flow, cache integrity/fallback, and the reference-benchmark divergence harness (with engineer for the Rust side).
- **To playwright-engineer:** own the E2E critical journeys, no-network/privacy, responsiveness, offline, unsupported-browser, cross-origin-isolation matrix, component tests, visual regression, and a11y scans.
- **To performance-test-engineer:** own the perf/memory/bundle tracking + regression-alert harness (non-gating latency, gating resource ceilings).
- **To senior engineer:** own Rust `cargo test` engine units + toy-game oracles + equity/EV cross-check implementation, and the domain-core TS unit/property tests.
- **To DevOps:** wire the gates in `QUALITY_GATES.md` into CI (fast PR tier vs nightly/release tier), including the COOP/COEP isolated-context E2E run.

---

## 18. Testability Requirements the Architect / Engineers Must Honor

These are the load-bearing testability invariants. If any is dropped during implementation, the trust strategy weakens — flag immediately.

1. **Deterministic, seeded engine** — `(spot, settings, seed)` -> identical strategy (NFR-004). Enables golden outputs, the oracle gates, and parity.
2. **Single-thread == multi-thread output** — threading affects speed only (ADR-003). Must be a verifiable, ideally bit-exact, invariant.
3. **Versioned, contract-testable worker protocol** — `protocolVersion`, structured `WorkerError.code`, throttled progress, bounded-latency cooperative cancel (API_SPEC Sec 3).
4. **Pure, I/O-free domain core** — validation, key derivation/board isomorphism, frequency-sum, scoring, equity/EV all unit-testable without mocks (ARCHITECTURE Sec 15).
5. **Ports are real seams** — `SolverEngine`/`PredefinedCache`/`PersistenceStore` injectable and fakeable (API_SPEC).
6. **Cache exactness is inspectable** — `lookup` returns the normalized key + hit/miss reason; `getEntry` yields `iterations:0` + provenance, so "no solve ran on a hit" is directly assertable (AC-024).
7. **Exposed engine/runtime info** — `EngineInfo` reports `threading`, `crossOriginIsolated`, `simd`, `maxMemoryBytes` so tests can assert variant selection and the budget cap.
8. **Reference-solver choice** (ADR-009 / GATE-A) — must be decided (SDET co-owns) so Ring 3 fixtures have a definitive source; fixtures version-stamped.
9. **Structured OOM/over-budget signaling** — `CostEstimate.withinBudget`, `WorkerError code:'oom'` + `partialResult`, worker-termination detection — so resource-safety is testable without crashing the test runner.
10. **Quantization tolerance documented** — shard encode/decode error bound (ADR-007) so the round-trip test has a defined gate.
