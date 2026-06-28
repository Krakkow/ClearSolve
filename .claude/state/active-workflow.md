# Active Workflow

## Current Workflow Snapshot

Workflow ID: WF-ENGINE-PORT
Workflow Type: Build Feature (engine port)
Status: In progress
Current Phase: IMPLEMENTATION
Current Agent: main (Claude), direct implementation
Started: 2026-06-28
Last Updated: 2026-06-28

---

## Request Summary

Original User Request: Build the Rust→WASM engine (the foundational unlock for faster solving + the path to trustworthy multiway/postflop). Alongside: keep README + state files current, and spec a full-hand-analysis epic.

Goal: Replace the TS solver with a Rust/WASM engine incrementally, validating each piece against the TS engine.

Scope: evaluator (done) → equity (done, wired) → CFR+ core (next) → multi-threaded wasm (later).

Out of Scope (this workflow): postflop solver, hand-history import (separate epic — now planned).

---

## Workflow Phases

| Phase | Status | Notes |
|-------|--------|-------|
| DISCOVERY | Complete | toolchain check, ADR-001 revisit (raw wasm) |
| IMPLEMENTATION | In progress | evaluator + equity done; CFR+ next |
| TEST/VALIDATION | Ongoing | parity scripts per piece |
| DOCUMENTATION | In progress | README + state files updated 2026-06-28 |

---

## Current Next Step

Next: Port the CFR+ core (betTree + preflopCfr) to Rust with bit-parity vs TS, then expose a `solve_*` wasm entry and route the worker through it.
Gate Before Moving On: parity-validate the CFR output vs the TS engine before wiring it in.

---

## Recent History

- Documented the "response charts need a better engine" finding (commit ab68512).
- Rust scaffold + interop proof (f9bd824), evaluator (1eec468), equity (d4412d1), worker wasm integration (892027f).
- README + `.claude/state/` brought current; full-hand-analysis epic added to PRD.
