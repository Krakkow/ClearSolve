# Implementation State

This file tracks implementation progress across features, bugs, refactors, and technical tasks.

---

## Implementation Summary

Current Implementation Status: Engine port complete + post-port realism pass complete
Current Feature: 200bb tier + depth-aware edge + open-jam fix + quality selector — all DONE
Current Task: — (next: a non-jam LARGE open/3-bet size, multi-threaded wasm, or M5 full-hand analysis)
Current Implementing Agent: main (Claude) — direct implementation
Last Updated: 2026-06-29

---

## Feature Implementation

| Feature ID | Feature | Status | Test Status | Notes |
|------------|---------|--------|-------------|-------|
| FEAT-020/021 | Configurable preflop tool + action taxonomy | Done | green | TS engine, 2–9p cash |
| — | Scenario builder + default ranges + range editor | Done | green | per-seat actions; entering-range subgame solve |
| — | Position-calibrated multiway opens | Done | green | realization-edge by players-behind |
| FEAT-019 | Predefined chart cache + live fallback | Partial | green | RFI solved-offline at ~100bb AND ~200bb; vs-open/vs-3bet curated |
| — | Offline generation pipeline (`gen:library`) | Done (RFI) | n/a | multi-depth (100/200bb), runs on Rust/WASM; response charts REJECTED (see decisions) |
| — | Rust eval7 + equity (wasm) | Done | parity-validated | equity wired into worker |
| — | Rust CFR+ core (wasm) | Done | parity-validated (diff 0) | full solve wired into worker; 3.7x faster |
| — | Solve-quality selector (Fast/Balanced/Max) | Done | green | per-spot precision + hover help + result metric |
| — | Depth-aware realization edge (position-scaled) | Done | green | DEC-006; deep widens late, ~flat early |
| — | Realistic open-sizing (open-jam gated ≤20bb) | Done | green | DEC-007; TS+Rust, wasm rebuilt |
| FEAT-008 | Constrained HU postflop | Not started | — | full-hand-analysis epic |
| — | Full-hand analysis (hand-history import/replay) | Planned | — | new epic |

---

## Changed Files Log (high level, recent)

| Date | Area | Summary |
|------|------|---------|
| 2026-06-26..28 | src/domain, src/engine, src/ui, src/app | scenario builder, multiway opens, range editor, charts (RFI/vs-open/vs-3bet), offline pipeline |
| 2026-06-28 | engine/ (Rust) | evaluator.rs, equity.rs, rng.rs, lib.rs (eval7, build_equity_matrix) |
| 2026-06-28 | src/wasm, src/engine/equityProvider, src/worker | wasm loader + injectable equity builder; worker uses Rust equity |
| 2026-06-29 | engine/src/cfr.rs, lib.rs | CFR+ core port (bet-tree, regret-matching+, terminal-EV, best-response, exploitability) |
| 2026-06-29 | src/wasm, src/engine/cfrProvider, src/engine/preflopEngine, src/worker | buildPreflopTreeWasm + injectable cfrProvider; async solve modes; worker uses Rust CFR |
| 2026-06-29 | src/app/store, src/ui/SpotConfig, src/ui/BetTreeView, src/app/app.css | solve-quality selector (presets, hover help) + result quality metric |
| 2026-06-29 | scripts/genLibrary, src/domain/charts, generated/rfiLibrary.json | 200bb tier (multi-depth gen on Rust/WASM; chartDepthTier) |
| 2026-06-29 | src/domain/projectSpot | depth-aware realization edge (depthRealizationBonus + openDepthPositionFactor) |
| 2026-06-29 | src/domain/betTree, engine/src/cfr.rs, src/wasm/*.wasm | open-jam gated ≤20bb (both engines, wasm rebuilt); library regenerated |

---

## Validation Log (recent)

| Date | Method | Result |
|------|--------|--------|
| 2026-06-28 | scripts/evalParity.ts (200k hands) | Rust eval7 == TS, bit-identical |
| 2026-06-28 | scripts/equityParity.ts | Rust equity == TS (max diff 0); 2.7x faster; AA vs KK 82.2% |
| 2026-06-28 | npm run build + vitest | build clean; 94 tests pass |
| 2026-06-29 | scripts/cfrParity.ts | Rust CFR == TS (max diff 0.00e+0) on full-range, vs-CO-open, 10bb |
| 2026-06-29 | scripts/cfrBench.ts | Rust solve 3.74x faster (40.2s → 10.8s @1500 iters) |
| 2026-06-29 | npm run build + vitest | build clean; 96 tests pass |
| 2026-06-29 | gen:library (multi-depth) | 26 RFI entries (100+200bb); 100bb bit-identical to committed |
| 2026-06-29 | scripts/cfrParity.ts (post open-jam gate) | TS==Rust still 0.00e+0 after gating both engines |
| 2026-06-29 | npm run build + vitest | build clean; 99 tests pass (open-jam 0.00000 in library) |

---

## Implementation Notes

Engine port strategy: port a piece to Rust, validate bit-parity vs the existing TS engine via a `scripts/*Parity.ts` script, then wire it in behind the `SolverEngine` port (injectable). Node/tests stay on the TS path; only the browser worker uses wasm.
