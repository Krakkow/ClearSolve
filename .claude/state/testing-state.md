# Testing State

This file tracks test strategy, coverage progress, automation status, quality gates, and known test risks.

---

## Testing Summary

Overall Testing Status: Healthy for the implemented preflop scope
Test Strategy Status: Documented (docs/TEST_STRATEGY.md); reference-solver trust harness not yet built
Automation Status: Vitest unit/integration (94 tests, 13 files) + Rust↔TS parity scripts
Manual Testing Status: In-browser by the owner (the equity speedup / scenario builder)
CI Test Status: Local only (CI workflows are starters)
Known Flaky Tests: None
Last Updated: 2026-06-28

---

## Automation Work (what's covered)

| Area | Type | Status | Notes |
|------|------|--------|-------|
| 7-card evaluator (evaluator7) | Unit | Done | + cross-check vs reference evaluator |
| Equity (known matchups, determinism) | Unit | Done | AA vs KK ≈ 82% |
| CFR+ (freq-sum, zero-sum, convergence, determinism, short-stack parity) | Unit | Done | preflopCfr.test |
| Scenario projection (composite, dead-money pot odds, live-opp count) | Unit | Done | scenario.test |
| Charts (RFI solved, vs-open defender-aware, vs-3bet, never "exact GTO") | Unit | Done | charts.test (9) |
| Range overrides, open-calibration monotonicity, trust labeling | Unit | Done | |
| Rust eval7 parity (200k hands) | Parity script | Done | scripts/evalParity.ts |
| Rust equity parity + benchmark | Parity script | Done | scripts/equityParity.ts |

---

## Quality Gates

| Gate | Status | Evidence |
|------|--------|----------|
| Acceptance criteria testable | Partial | preflop scope covered; postflop/hand-analysis future |
| Required tests implemented | Yes (current scope) | 94 vitest |
| CI green | Local only | `vitest run` = 94 pass; `npm run build` clean |
| Critical flows covered | Partial | solver/charts covered; no browser E2E |
| Never claims "exact GTO" | Yes | enforced by test |

---

## Coverage Gaps

| ID | Gap | Risk | Accepted? |
|----|-----|------|-----------|
| GAP-001 | No browser E2E (Playwright) | Med | Yes (for now) |
| GAP-002 | wasm-in-worker not auto-tested (build + parity scripts only) | Low | Yes |
| GAP-003 | Reference-solver trust harness (vs external solver) not built | Med | Yes (future) |
| GAP-004 | UI components lightly tested | Low | Yes |

---

## Test Execution Log (recent)

| Date | Command | Result |
|------|---------|--------|
| 2026-06-28 | `npx vitest run` | 94 passed (13 files) |
| 2026-06-28 | `npx vite-node scripts/evalParity.ts` | bit-identical (200k hands) |
| 2026-06-28 | `npx vite-node scripts/equityParity.ts` | matrix max-diff 0; 2.7x faster |
