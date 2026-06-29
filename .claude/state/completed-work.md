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
