# Technical Debt

This file tracks known technical debt and follow-up improvements.

Agents should record debt here instead of silently expanding scope.

---

## Technical Debt Summary

| ID | Area | Severity | Priority | Status | Notes |
|----|------|----------|----------|--------|-------|
| TD-001 | Solver model | High | Should | Accepted | Multiway = 2-effective-player reduction (estimate) |
| TD-002 | Engine | Medium | Should | In progress | CFR+ still TS while equity is Rust (hybrid) |
| TD-003 | Engine build | Low | Could | Accepted | Raw wasm (no wasm-bindgen) → manual memory marshalling |
| TD-004 | Charts | Medium | Could | Open | vs-open/vs-3bet are curated, not solved (limited granularity) |
| TD-005 | Ops/QA | Medium | Should | Open | No git remote; CI starters unvalidated; no E2E |
| TD-006 | Legal | Low | Could | Open | License undecided (TBD) |
| TD-007 | Repo hygiene | Low | Could | Accepted | Committed wasm binary + generated JSON (for build-without-rust) |

---

## TD-001: Multiway is a 2-effective-player estimate

Status: Accepted
Area: Solver model
Severity: High
Priority: Should

### Description
3+ player tables are collapsed to hero-vs-one-composite-opponent. General-sum multiway has no unique equilibrium; the reduction can't represent defender position, and vs-3-bet / blind-vs-blind pot geometry is approximate.

### Impact
Multiway results are estimates, honestly labeled (never "exact GTO"). Curated reference charts cover common spots more accurately than the live estimate.

### Recommendation
Real fix requires a better engine (true multiway / postflop). Tracked as the engine-port + future multiway work.

---

## TD-002: Hybrid engine (Rust equity + TS CFR)

Status: In progress
Area: Engine
Severity: Medium
Priority: Should

### Description
Equity is Rust/WASM (fast); the CFR+ traversal, best-response, exploitability, and terminal-EV model are still TypeScript.

### Recommendation
Port the CFR+ core to Rust (bit-parity vs TS), then enable multi-threaded wasm. This is the current active task.

---

## TD-004: vs-open / vs-3-bet charts are curated, not solved

Status: Open
Area: Charts
Severity: Medium
Priority: Could

### Description
RFI charts are solver-generated (offline); vs-open and vs-3-bet are hand-authored reference ranges (tier-keyed). Attempting to solve them via the current 2p model was rejected (less accurate — see DEC-004 / README finding).

### Recommendation
Generate them once the engine can model multiway / postflop credibly.

---

## TD-005: Ops & QA gaps

Status: Open
Area: Ops/QA
Severity: Medium
Priority: Should

### Description
No git remote configured (local commits only). CI workflows are starters, never run against the app. No browser E2E; the wasm-in-worker path is validated only via build + parity scripts (not an automated test).

### Recommendation
Add a remote + push; wire CI (with a Rust setup step or the committed wasm); add a minimal Playwright smoke once deployment is set up.
