# Quality Gates — Personal Browser-Native NLHE GTO Solver ("ClearSolve")

> Owner: SDET Lead Agent
> Last Updated: 2026-06-24
> Status: DRAFT for stakeholder / Architect / DevOps review
> Source of truth: `TEST_STRATEGY.md`, `PRD.md`, `ACCEPTANCE_CRITERIA.md`, `RISKS.md`, `ARCHITECTURE.md`, `API_SPEC.md`, `DATA_MODEL.md`
> Intended consumer: DevOps engineer wires these into CI. SDET owns definitions; gates are enforceable in CI unless explicitly marked manual.

This document defines concrete, measurable PASS/FAIL gates. Each gate states: what it checks, how it is measured, its PASS/FAIL definition, whether it is CI-enforceable, the tier it runs in, and its rationale. Gates respect the PRD's central decision: **correctness/accuracy is paramount; performance is best-effort with no latency SLA (NFR-001)** — so latency is *tracked and alerted*, never a blocker, while *correctness* and *resource-safety* gates are hard blockers.

## CI tiers

- **PR tier (fast, every push/PR):** must be quick and deterministic. Blocks merge.
- **Merge/main tier:** PR tier + a bit more integration; blocks the main branch staying green.
- **Nightly / pre-release tier (slow):** full reference benchmark + cross-browser/isolation matrix + perf tracking. Blocks release, not individual PRs.
- **Milestone gate (M0/M1/M2..):** formal go/no-go; human-confirmed (Sec 7).

Gates are labeled with the tier(s) they run in.

---

## 1. Development Gate (pre-implementation / story-ready)

Checked by SDET/PO before an engineer starts a story. Not CI-enforced; it is a readiness gate.

- [ ] Acceptance criteria for the story are observable and testable (they are, per `ACCEPTANCE_CRITERIA.md`).
- [ ] The story maps to at least one planned test at the lowest useful level (`TEST_COVERAGE_MATRIX.md`).
- [ ] For engine/cache stories: the relevant trust-harness ring(s) and tolerances are identified.
- [ ] No unresolved critical testability blocker (the Sec 18 invariants in `TEST_STRATEGY.md` are intact for this area).
- [ ] Required test data/fixtures are identified (toy oracle, reference fixture, or domain fixture).

PASS: all boxes checked. FAIL: any unchecked -> resolve before coding (or log as an accepted assumption).

---

## 2. Lint / Type / Build / Coverage Gates (PR tier, CI-enforced)

| Gate | Measure | PASS/FAIL | Rationale |
|------|---------|-----------|-----------|
| G2.1 TS lint | ESLint clean (no errors) | FAIL on any error | Baseline hygiene |
| G2.2 TS types | `tsc --noEmit` passes | FAIL on any type error | End-to-end type safety is a core ADR-004 benefit; broken types undermine the shared domain model |
| G2.3 Rust lint | `cargo clippy -D warnings` clean | FAIL on any warning | Engine is the highest-risk component; clippy catches correctness/UB-adjacent issues |
| G2.4 Rust fmt / TS format | `cargo fmt --check`, formatter check | FAIL on diff | Consistency |
| G2.5 Build | App (Vite) builds; Rust->WASM (`wasm-pack`) builds both single- and multi-thread variants | FAIL on build error | A non-building variant is a release blocker |
| G2.6 Unit-test pass | All TS unit + Rust `cargo test` pass | FAIL on any failing test | Non-negotiable |
| G2.7 Coverage — domain core (TS) | Line+branch coverage of `domain/` | FAIL if < 90% lines / < 85% branch | The domain core (validation, key normalization, scoring, equity/EV) is correctness-critical and pure -> high coverage is cheap and high-value |
| G2.8 Coverage — engine core (Rust) | `cargo llvm-cov` of engine crate | FAIL if < 85% lines | Engine correctness is paramount |
| G2.9 Coverage — app/UI overall | Overall project line coverage | WARN (not fail) if < 70% | Sensible, not dogmatic — UI glue and Could-features should not be force-covered; depth concentrated where risk is (domain/engine) |

**Coverage philosophy (decisive):** thresholds are high where risk is high (domain 90%, engine 85%) and intentionally lenient overall (70% warn). We do not chase a single global number; per testing-standards, coverage is a visibility tool, not a target to game. Gaps must be *visible* (the matrix), not merely absent.

---

## 3. Solver-Correctness Gates (THE central gates)

These implement the trust harness (`TEST_STRATEGY.md` Sec 6). They are the reason the product can be trusted and are **decoupled from wall-clock time** (NFR-001).

### G3.1 — Toy-game oracle gate (Ring 1) — PR tier, CI-enforced
- **Measure:** engine converges to the known equilibrium for Kuhn poker, simplified push/fold, and a small zero-sum matrix game; converged exploitability <= `epsilon_toy`; strategy matches the analytic equilibrium within tolerance.
- **PASS:** all toy oracles within `epsilon_toy` and equilibrium-match tolerance.
- **FAIL:** any oracle exceeds tolerance.
- **Rationale:** exact ground truth. If this fails, the CFR+ machinery is broken — hard block, no exceptions. This is the single most important automated gate in the project.

### G3.2 — Self-consistency invariants (Ring 2) — PR tier, CI-enforced
- **Measure (on a small real-spot set):** (a) every hand's action frequencies sum to 1 within 1e-3 (BR-003); (b) reported exploitability is labeled `estimate` and `withinAbstraction` (BR-005); (c) determinism: same seed -> byte-identical strategy (NFR-004); (d) equity/EV independent cross-check within `tol_equity`/`tol_ev` (Sec 6.4 of strategy).
- **PASS:** all invariants hold.
- **FAIL:** any invariant violated.
- **Rationale:** catches regressions and internal incoherence without an external tool; runs fast in CI.

### G3.3 — Single-thread vs multi-thread parity — Merge tier (where threaded build exists), CI-enforced
- **Measure:** single- and multi-thread engine variants, same `(spot, settings, seed)`, produce identical strategy.
- **PASS:** identical (bit-exact target; if a documented floating-point epsilon is unavoidable, within that single-sourced epsilon).
- **FAIL:** divergence beyond the documented epsilon.
- **Rationale:** the stakeholder-mandated invariant — threading must change speed only, never correctness (ADR-003). A failure here directly undermines trust.

### G3.4 — Reference-solver benchmark (Ring 3) — Nightly / pre-release tier, CI-enforced
- **Measure (per benchmark spot, vs committed reference fixtures):** max per-action frequency divergence <= `tol_freq_max`; mean divergence <= `tol_freq_mean`; absolute exploitability <= `tol_exploit`; EV/equity within `tol_ev`/`tol_equity`.
- **Scope:** applies to BOTH live solves AND predefined cache entries (same bar — RISK-004 + RISK-014).
- **PASS:** all spots within all tolerances.
- **FAIL:** any spot outside any tolerance (with a documented allowance for a small, explicitly-accepted-risk subset only if stakeholder-approved and logged).
- **Rationale:** the "approaching production-grade fidelity" gate. Time-independent (NFR-001) — only result quality is judged. The exploitability tolerance is the primary correctness pass/fail criterion.

### G3.5 — Cache/live cross-source consistency — Nightly tier, CI-enforced
- **Measure:** for spots present in BOTH the cache and live-solvable, the predefined and live results agree within `tol_freq_max`/`tol_exploit`.
- **PASS:** within tolerance. **FAIL:** divergence.
- **Rationale:** the two result sources must not disagree, or the source label becomes a trust hazard (RISK-004/014, BR-007).

### G3.6 — Tolerance single-sourcing — PR tier, CI-enforced (static check)
- **Measure:** all correctness tests reference the shared tolerance config (no hard-coded local tolerances).
- **PASS:** no stray tolerances. **FAIL:** any local override.
- **Rationale:** the gate must be tunable in one place and auditable (Sec 6.6 of strategy).

> Tolerance values (`epsilon_toy`, `tol_exploit`, `tol_freq_max`, `tol_freq_mean`, `tol_equity`, `tol_ev`) are placeholders until **ratified in M0** against measured data. Until then, G3.4/G3.5 run in WARN mode in nightly and become hard gates once tolerances are ratified.

---

## 4. Cache-Integrity Gates (PR + Merge tier, CI-enforced)

Implements RISK-014 / BR-007/008 / NFR-011 / AC-024/025/026.

| Gate | Measure | PASS/FAIL | Rationale |
|------|---------|-----------|-----------|
| G4.1 Exact-match only | `lookup` returns `hit:true` only on exact normalized-key match; custom-range mismatch -> miss | FAIL if any fuzzy/approximate hit | BR-008: never serve an unlabeled approximate answer |
| G4.2 Board isomorphism correctness | suit-permuted equivalent flops -> same canonical key; suits map back correctly; non-isomorphic -> different key | FAIL on any mis-canonicalization | The one allowed normalization must be exact (ARCHITECTURE 7.2); property-based |
| G4.3 Hit -> no solve | on a hit, `iterations:0`, `source:'predefined'`, engine.solve never invoked | FAIL if a solve loop runs | AC-024 functional "instant" assertion (not a timing check) |
| G4.4 Miss -> live fallback | no match -> validate -> live solve, labeled `source:'live'` | FAIL if no fallback or mislabeled | AC-025, BR-008 |
| G4.5 Integrity/version handling | corrupt / missing / version-mismatched library -> cache disabled + clear notice + live fallback | FAIL if it serves bad data or crashes | NFR-011, EDGE-010, AC-025 |
| G4.6 Source labeling + provenance | result carries correct `source` + generation settings + exploitability | FAIL if missing/incorrect | BR-007, AC-026 |
| G4.7 Quantization round-trip | shard encode->decode preserves frequencies within documented tolerance | FAIL if outside tolerance | ADR-007; protects cache fidelity |
| G4.8 Shipped entries reference-validated | every predefined entry in the release bundle has `GenerationMeta.referenceValidated === true` | FAIL if any unvalidated entry ships | Release-only; ensures cache passed Ring 3 (RISK-014) |

---

## 5. Performance / Resource Gates — OBSERVABILITY vs HARD CEILINGS

Per NFR-001, **latency is never a blocker**. Two distinct categories:

### 5a. Tracked metrics with regression ALERTS (non-blocking) — Nightly tier
- **Measure & record baseline:** solve wall-time, iterations-to-`tol_exploit`, peak WASM memory, app+WASM+library-index bundle size, shard fetch+decode time, cache-hit latency.
- **Behavior:** a configurable regression vs baseline (e.g. > 25% slower, or > X% larger) raises a **non-blocking alert/annotation** on the run for human judgement.
- **PASS/FAIL:** informational only — does NOT fail the build.
- **Rationale:** prevents silent perf rot while honoring "correctness over speed". Latency has no SLA (NFR-001).

### 5b. HARD resource ceilings (blocking — these are safety/functional, not latency) — Merge/Release tier, CI-enforced
| Gate | Measure | PASS/FAIL | Rationale |
|------|---------|-----------|-----------|
| G5.1 Memory budget respected | a solve never exceeds its declared `memoryBudgetBytes`; over-budget is gated pre-solve | FAIL if a solve breaches the budget | RISK-003/010; device safety, not timing |
| G5.2 OOM does not crash UI | forced OOM yields structured error / detected worker termination; UI thread survives; best-so-far preserved where available | FAIL if the tab/UI crashes | NFR-003, EDGE-003, RISK-010 |
| G5.3 Over-budget gating | over-bound spot warns/blocks with reduction suggestions before allocating | FAIL if it proceeds silently | AC-006, EDGE-001 |
| G5.4 Bundle-size ceiling | total shipped bundle (app+WASM+index) under an agreed budget; shards lazy | FAIL if over ceiling | RISK-003; load + storage discipline |
| G5.5 Main-thread responsiveness | during an active live solve, no main-thread long task > ~100ms | FAIL if blocked beyond threshold | NFR-002, AC-003 — this is a *responsiveness functional* gate, distinct from solve latency |

**Decisive distinction:** G5.5 (responsiveness) and the resource ceilings ARE gates because they protect the device and the UX contract; *how long a solve takes* is NOT a gate.

---

## 6. PR / Merge Gate (consolidated, CI-enforced)

A PR may merge only if ALL of:
- [ ] G2.* lint/type/build/unit/coverage gates PASS.
- [ ] G3.1 (toy oracles) and G3.2 (self-consistency) PASS.
- [ ] G3.3 (thread parity) PASS where a threaded build is in play.
- [ ] G4.1-G4.7 (cache integrity) PASS for any change touching cache/domain-key logic.
- [ ] G5.1-G5.3, G5.5 (resource-safety + responsiveness) PASS for any change touching engine/worker/UI-solve paths.
- [ ] Relevant automated tests added/updated for the change; new ACs covered at the lowest useful level.
- [ ] Code review completed; test review completed (SDET or delegate).
- [ ] No new flaky test introduced; any quarantine is documented with the risk it leaves uncovered.
- [ ] `TEST_COVERAGE_MATRIX.md` updated if coverage scope changed.

PASS: all checked and CI green. FAIL: any unchecked or red -> no merge (or explicitly accepted with a logged, signed-off risk).

---

## 7. M0 Feasibility-Spike Gate (formal go/no-go)

M0 is a hard go/no-go gate (PRD Sec 18). Quality-owned and co-owned items:

**GO requires ALL of:**
- [ ] Ring 1 toy-game oracles operational and passing on the prototype engine (G3.1 in spirit).
- [ ] Engine produces a valid strategy (frequency sums == 1) on a real preflop HU spot.
- [ ] Determinism holds (same seed -> identical output); if threaded prototype exists, a first parity check passes.
- [ ] At least one Ring 3 reference benchmark spot (>= 1 preflop + ideally 1 flop) measured and either within tolerance or with a documented, credible path to it.
- [ ] Cache prototype demonstrates: exact-key hit served, deliberate miss -> live fallback, corrupt-library -> disabled+fallback.
- [ ] Tractability bound (Q-001) and trust tolerances (Sec 6.6 of strategy) set/ratified with measured backing.
- [ ] (Architect/DevOps co-owned) feasibility of in-browser CFR perf/memory and the offline-generation+bundle+match approach demonstrated (validates ASM-001/002/010/011).

**NO-GO / RE-SCOPE if:** the engine cannot reach acceptable exploitability within any in-browser-feasible budget; OR determinism/parity cannot be achieved; OR the cache cannot match/serve correctly; OR memory/bundle envelope is infeasible. Triggers an Architect + Delivery + stakeholder re-scope decision.

PASS = GO (proceed to M1). FAIL = NO-GO (re-scope/escalate). Decision is human-confirmed and logged in the decision log.

---

## 8. Release / Milestone Gate (M1+; CI + human, blocks release)

A release is approved only if ALL of:
- [ ] All PR/Merge gates green on main (Sec 6).
- [ ] G3.4 (reference benchmark) PASS on the full suite at ratified tolerances; any exception is an explicitly accepted, logged risk.
- [ ] G3.5 (cache/live consistency) PASS.
- [ ] G4.8 (all shipped predefined entries reference-validated) PASS.
- [ ] G5.* resource-safety + responsiveness gates PASS; perf tracking reviewed (alerts triaged, not necessarily zero).
- [ ] Cross-browser / cross-origin-isolation matrix E2E PASS (single-thread baseline + multi-thread where isolated produce identical results); within the agreed support matrix (Q-007).
- [ ] Privacy gate (G-PRIV below) PASS.
- [ ] Persistence gates (G-PERS below) PASS.
- [ ] Accessibility scan reviewed (Could-priority; violations triaged, criticals addressed or accepted).
- [ ] Critical user journeys (lookup-or-solve, practice, save/reload, offline, over-budget) covered and green.
- [ ] Known gaps documented in `TEST_COVERAGE_MATRIX.md`; flaky tests assessed; quarantines disclosed.
- [ ] SDET Lead provides a risk-based release recommendation: **Go / Go-with-Accepted-Risk / No-Go / Blocked**.

### G-PRIV — Privacy / no-egress (Release tier, CI-enforced)
- **Measure:** E2E with request interception during lookup-hit, live solve, save, and practice; assert zero compute/data network calls — only static-asset GETs (app/WASM/library).
- **PASS:** no unexpected egress; CSP `connect-src 'self'` holds. **FAIL:** any compute/data call leaves the device.
- **Rationale:** NFR-006, AC-001 — a foundational privacy promise; a single leak is a hard fail.

### G-PERS — Persistence integrity (Merge/Release tier, CI-enforced)
- **Measure:** round-trip save/reload/restart retrieval (AC-016/017); quota-exceeded leaves no partial/corrupt record (AC-018, EDGE-004); schema migration + version-mismatch warning (EDGE-008); OPFS-absent fallback to IDB (ADR-006); storage-usage + eviction comms present (AC-018).
- **PASS:** all behaviors correct. **FAIL:** any data loss/corruption or missing comms.
- **Rationale:** RISK-003/013 — the only copy of the owner's work is local; integrity is non-negotiable.

---

## 9. Bug-Fix Gate (every bug fix)

A bug fix is not done until:
- [ ] A reproduction path exists and is captured as a failing test (red before fix).
- [ ] The regression test passes after the fix (green) and is added to the suite at the lowest useful level.
- [ ] Regression risk + nearby areas assessed (esp. engine/cache/persistence adjacency).
- [ ] If the bug reveals a coverage gap, the gap is filled or logged.
- [ ] For engine/cache bugs: relevant trust-harness ring re-run; consider adding a new oracle/fixture.

PASS: regression test present and green + risk assessed. FAIL: fix without a regression test (not allowed for correctness/cache/persistence bugs).

---

## 10. Gate Enforcement Summary (for DevOps wiring)

| Gate group | Tier | Enforcement |
|------------|------|-------------|
| G2.* lint/type/build/unit/coverage | PR | Hard block |
| G3.1 toy oracles, G3.2 self-consistency, G3.6 tolerance-sourcing | PR | Hard block |
| G3.3 thread parity | Merge | Hard block (when threaded build present) |
| G4.1-G4.7 cache integrity | PR/Merge | Hard block on cache/domain changes |
| G5.1-G5.3, G5.5 resource-safety + responsiveness | Merge/Release | Hard block |
| G5a perf tracking | Nightly | Non-blocking alert |
| G5.4 bundle ceiling | Merge/Release | Hard block |
| G3.4 reference benchmark, G3.5 cache/live consistency | Nightly/Release | Hard block at ratified tolerances (WARN until ratified) |
| G4.8 shipped-entries validated | Release | Hard block |
| G-PRIV privacy, G-PERS persistence | Release (+Merge for G-PERS) | Hard block |
| Cross-browser/isolation matrix | Nightly/Release | Hard block within support matrix |
| a11y scan | Release | Review/triage (Could) |
| M0 go/no-go | Milestone | Human-confirmed gate |

**Single overriding principle:** correctness (G3.*), cache-integrity (G4.*), privacy (G-PRIV), persistence (G-PERS), and resource-safety/responsiveness (G5 ceilings) are hard blockers. **Solve latency is tracked and alerted, never blocking** (NFR-001). When in doubt, protect correctness and the device, not the clock.
