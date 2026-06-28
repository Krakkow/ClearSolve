# Implementation State

This file tracks implementation progress across features, bugs, refactors, and technical tasks.

---

## Implementation Summary

Current Implementation Status: In progress
Current Feature: Rust→WASM engine port
Current Task: Port CFR+ core to Rust (equity + evaluator already ported)
Current Implementing Agent: main (Claude) — direct implementation
Last Updated: 2026-06-28

---

## Feature Implementation

| Feature ID | Feature | Status | Test Status | Notes |
|------------|---------|--------|-------------|-------|
| FEAT-020/021 | Configurable preflop tool + action taxonomy | Done | green | TS engine, 2–9p cash |
| — | Scenario builder + default ranges + range editor | Done | green | per-seat actions; entering-range subgame solve |
| — | Position-calibrated multiway opens | Done | green | realization-edge by players-behind |
| FEAT-019 | Predefined chart cache + live fallback | Partial | green | RFI solved-offline; vs-open/vs-3bet curated |
| — | Offline generation pipeline (`gen:library`) | Done (RFI) | n/a | extending to response charts REJECTED (see decisions) |
| — | Rust eval7 + equity (wasm) | Done | parity-validated | equity wired into worker |
| — | Rust CFR+ core | Not started | — | NEXT |
| FEAT-008 | Constrained HU postflop | Not started | — | full-hand-analysis epic |
| — | Full-hand analysis (hand-history import/replay) | Planned | — | new epic |

---

## Changed Files Log (high level, recent)

| Date | Area | Summary |
|------|------|---------|
| 2026-06-26..28 | src/domain, src/engine, src/ui, src/app | scenario builder, multiway opens, range editor, charts (RFI/vs-open/vs-3bet), offline pipeline |
| 2026-06-28 | engine/ (Rust) | evaluator.rs, equity.rs, rng.rs, lib.rs (eval7, build_equity_matrix) |
| 2026-06-28 | src/wasm, src/engine/equityProvider, src/worker | wasm loader + injectable equity builder; worker uses Rust equity |

---

## Validation Log (recent)

| Date | Method | Result |
|------|--------|--------|
| 2026-06-28 | scripts/evalParity.ts (200k hands) | Rust eval7 == TS, bit-identical |
| 2026-06-28 | scripts/equityParity.ts | Rust equity == TS (max diff 0); 2.7x faster; AA vs KK 82.2% |
| 2026-06-28 | npm run build + vitest | build clean; 94 tests pass |

---

## Implementation Notes

Engine port strategy: port a piece to Rust, validate bit-parity vs the existing TS engine via a `scripts/*Parity.ts` script, then wire it in behind the `SolverEngine` port (injectable). Node/tests stay on the TS path; only the browser worker uses wasm.
