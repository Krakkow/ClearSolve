# Completed Work

This file tracks completed features, bug fixes, refactors, test work, documentation work, DevOps work, and releases.

Do not delete completed history unless intentionally archiving.

---

## Completed Work Summary

| ID | Type | Summary | Completed | Notes |
|----|------|---------|-----------|-------|
| DONE-001 | Planning | Full new-project planning (PRD, ARCH, ADRs, test strategy, devops, tasks) | 2026-06-24..25 | approved |
| DONE-002 | Feature | HU push/fold + HU bet-tree CFR+ slices | 2026-06-25 | |
| DONE-003 | Feature | E1 generalized preflop tool (2–9p, position, stack, full taxonomy) | 2026-06-26 | |
| DONE-004 | Feature | Scenario builder + default ranges + inline range editor | 2026-06-27 | |
| DONE-005 | Feature | Position-calibrated multiway opens; hero-relative node labels | 2026-06-27 | |
| DONE-006 | Feature | E4 predefined chart cache: RFI + vs-open (defender-aware) + vs-3-bet | 2026-06-27 | curated |
| DONE-007 | Feature | Offline generation pipeline; solved RFI library | 2026-06-27 | `gen:library` |
| DONE-008 | Investigation | Solving response charts offline — REJECTED (2p model worse than curated) | 2026-06-27 | documented |
| DONE-009 | Infrastructure | Rust→WASM toolchain + scaffold + interop proof | 2026-06-28 | raw wasm32 |
| DONE-010 | Feature | Rust eval7 + equity (bit-identical, 2.7x faster); wired into worker | 2026-06-28 | |
| DONE-011 | Docs | README + `.claude/state/` brought current; full-hand-analysis epic spec'd | 2026-06-28 | |
| DONE-012 | Feature | Rust CFR+ core (bit-identical, 3.7x faster); worker fully Rust/WASM | 2026-06-29 | |
| DONE-013 | Feature | Solve-quality selector (Fast/Balanced/Max) + hover help + results-panel quality metric | 2026-06-29 | |
| DONE-014 | Feature | 200bb predefined RFI tier (gen multi-depth; generator routed through Rust/WASM) | 2026-06-29 | |
| DONE-015 | Feature | Depth-aware realization edge (position-scaled: late widens deep, early ~flat) | 2026-06-29 | DEC-006 |
| DONE-016 | Feature | Open-jam gated to short stacks (≤20bb) in TS + Rust; fixes deep over-jam artifact | 2026-06-29 | DEC-007 |

---

## DONE-009: Rust→WASM engine foundation

Type: Infrastructure
Completed Date: 2026-06-28
Workflow: Engine port
Related Files: `engine/`, `scripts/wasmCheck.mjs`, `package.json`
Related Decisions: DEC-003 (raw wasm vs wasm-bindgen)

### Summary
Installed the Rust toolchain and proved the Rust→WASM→JS pipeline (incl. linear-memory marshalling) end to end.

### What Changed
`engine/` raw `wasm32` cdylib (add/engine_version/sum_f64/alloc_f64/free_f64); `npm run wasm:build`/`wasm:check`.

### Validation
`node scripts/wasmCheck.mjs` — add(2,3)=5, sum_f64=11.

### Risks / Accepted Risks
Deviated from ADR-001 (no wasm-bindgen) to avoid the MSVC host-build dependency. See DEC-003.

---

## DONE-010: Rust evaluator + equity (drop-in, faster)

Type: Feature
Completed Date: 2026-06-28
Workflow: Engine port
Related Files: `engine/src/{evaluator,equity,rng,lib}.rs`, `src/engine/equityProvider.ts`, `src/wasm/wasmEngine.ts`, `src/worker/solver.worker.ts`
Related Decisions: DEC-003

### Summary
Ported the 7-card evaluator and the Monte-Carlo equity matrix to Rust, bit-identical to TS; wired the equity build into the worker (injectable, with TS fallback).

### What Changed
`eval7` + `build_equity_matrix` wasm exports; injectable `equityProvider`; worker prefers wasm equity. Compiled wasm committed at `src/wasm/`.

### Validation
`scripts/evalParity.ts` (200k hands, bit-identical); `scripts/equityParity.ts` (matrix max-diff 0, 2.7x faster); build + 94 tests green.

### Follow-Up Work
Port the CFR+ core to Rust; then multi-threaded wasm.

---

## DONE-012: Rust CFR+ core (full engine port)

Type: Feature
Completed Date: 2026-06-29
Workflow: Engine port
Related Files: `engine/src/cfr.rs`, `engine/src/lib.rs`, `src/wasm/wasmEngine.ts`, `src/engine/cfrProvider.ts`, `src/engine/preflopEngine.ts`, `src/worker/solver.worker.ts`, `scripts/cfrParity.ts`, `scripts/cfrBench.ts`
Related Decisions: DEC-003

### Summary
Ported the full CFR+ core (bet-tree builder, regret-matching+ traversal, terminal-EV model, best-response, exploitability) to Rust, bit-identical to TS; wired the live solve through it (injectable `cfrProvider`, worker prefers wasm with TS fallback). The engine is now fully Rust/WASM end-to-end.

### What Changed
`solve_preflop_tree` wasm export marshalling config/equity/ranges over linear memory; `buildPreflopTreeWasm` parses the flat result buffer back into `NodeStrategy[]`; `cfrProvider` injectable solver; `solveBetTreeMode`/`solvePreflopSpotMode` now async via `getCfrSolver()`; worker `setCfrSolver(wasm → TS fallback)`.

### Validation
`scripts/cfrParity.ts` — full-range, range-weighted (vs CO open), and 10bb cases all max diff 0.00e+0 (< 1e-9). `scripts/cfrBench.ts` — 40.2s → 10.8s @1500 iters (3.74x). Build + 96 tests green.

### Follow-Up Work
Multi-threaded wasm (SharedArrayBuffer); then the full-hand-analysis epic (M5).

---

## DONE-013: Solve-quality selector

Type: Feature
Completed Date: 2026-06-29
Workflow: UX / engine settings
Related Files: `src/app/store.ts`, `src/ui/SpotConfig.tsx`, `src/ui/BetTreeView.tsx`, `src/app/app.css`

### Summary
Added a Fast / Balanced / Max quality selector for live (non-cached) solves, mapped to iteration + equity-sample presets, with an ⓘ hover explanation. The results panel shows which preset produced the current result.

### What Changed
`QUALITY_PRESETS` + `quality`/`resultQuality` state; `solve()` derives `SolveSettings` from the chosen preset (was fixed `DEFAULT_SETTINGS`); cached chart spots load instantly and ignore it. UI: "Solve quality" select + info badge; `Quality` metric in the result header (live results only).

### Validation
Build clean; 96 tests pass. (No behavior change to cached charts.)

### Follow-Up Work
None.

---

## DONE-014: 200bb predefined RFI tier

Type: Feature
Completed Date: 2026-06-29
Workflow: Library coverage
Related Files: `scripts/genLibrary.ts`, `src/domain/charts.ts`, `src/domain/generated/rfiLibrary.json`, `src/domain/charts.test.ts`
Related Decisions: DEC-006

### Summary
RFI is now solved offline at TWO depth tiers — ~100bb and ~200bb — and served instantly for both (200bb is the owner's cash game; it previously fell back to a slow live solve). The generator was also routed through the Rust/WASM engine (sync instantiate, TS fallback), ~3.7× faster.

### What Changed
`gen:library` parameterized over `GEN_STACKS="100,200"`, keys `cash|{size}|{pos}|{depth}bb|rfi`; `chartDepthTier()` maps stack → 100bb (~75–150) / 200bb (~150–300) tier. Curated vs-open/vs-3-bet stay 100bb-only, so 200bb response spots live-solve at the correct depth. 26 entries (13×100 + 13×200).

### Validation
100bb entries reproduce bit-identically (Rust==TS deterministic); 2 new 200bb chart tests; build + tests green.

### Follow-Up Work
More depth tiers (50bb, 300bb); solved deep response charts once the engine supports them.

---

## DONE-015: Depth-aware realization edge

Type: Feature
Completed Date: 2026-06-29
Workflow: Engine modeling
Related Files: `src/domain/projectSpot.ts`, `src/domain/generated/rfiLibrary.json`
Related Decisions: DEC-006

### Summary
The see-flop realization edge now grows with depth (zero at ≤100bb, capped above), position-scaled for opens so deep ranges widen in late position while staying ~flat early — matching real deep-stack play.

### What Changed
`depthRealizationBonus(stack)` (+0.03 at 200bb, cap +0.05) and `openDepthPositionFactor(behind)` (full on the button → 0.4 floor early). Opens add the position-scaled bonus; deep facing-action (live-solved) nudges the engine default. A first FLAT bonus over-widened every seat and was replaced by position scaling.

### Validation
100bb tier bit-identical (bonus=0); 200bb entries shifted (e.g. 6-max BTN 52%→62%, 9-max UTG ~flat). Build + tests green. Explicit heuristic, not a depth-resolved solve.

### Follow-Up Work
Revisit magnitudes if a true deep solver becomes available.

---

## DONE-016: Open-jam gated to short stacks

Type: Feature (modeling fix)
Completed Date: 2026-06-29
Workflow: Engine modeling
Related Files: `src/domain/betTree.ts`, `engine/src/cfr.rs`, `src/wasm/clearsolve_engine.wasm`, `src/domain/generated/rfiLibrary.json`, `src/domain/betTree.test.ts`, `src/engine/preflopSpot.test.ts`, `src/domain/charts.test.ts`
Related Decisions: DEC-007

### Summary
Fixed the deep open-jam artifact: the open node offered only min-raise or all-in, so the solver leaked frequency into an open-shove real GTO never makes deep (100bb 9-max UTG showed ~13.5% jam). Open-jamming is now gated to ≤20bb (`OPEN_JAM_MAX_BB`); deep, the open node is Fold / Open.

### What Changed
Stack-gated the explicit root all-in action in BOTH engines (TS `betTree.ts` + Rust `cfr.rs`); rebuilt + recommitted the wasm; regenerated the library (open-jam now 0.00000 everywhere, total open widths ~unchanged). Updated 3 tests that encoded the old behavior; added 2 (deep = no jam, ≤20bb = jam present).

### Validation
TS↔Rust CFR parity still 0.00e+0; short-stack jam + push/fold parity preserved; build + 99 tests green.

### Follow-Up Work
Add a true non-jam LARGE open/3-bet size per node (mix sizings like a production solver).
