# Project State

## Current Status

Project Name: ClearSolve (working name; not final)
Project Description: Pure client-side (no backend) browser-native NLHE GTO **preflop** solver SPA, personal-use.
Current Phase: Implementation (active development)
Current Milestone: Rust→WASM engine port — COMPLETE (equity + CFR+ core, single-threaded). Next: multi-threaded wasm or M5 full-hand analysis.
Current Workflow: Engine port — incremental TS→Rust with parity validation (done)
Overall Status: On track — working app, fully Rust/WASM engine, 96 tests passing, build clean
Last Updated: 2026-06-29

---

## Project Overview

### Purpose

A private, install-free, no-account GTO study tool for No-Limit Hold'em **preflop** decisions, running entirely in the browser. Live CFR+ solving + a predefined chart library + honest trust labeling.

### Target Users

Single owner (personal study tool). Not a multi-tenant / commercial product.

### Main Product Goals

Configurable preflop solving (2–9 handed, cash, any position, sub-10bb–1000bb); full action-frequency output; scenario builder; predefined charts with live fallback; honest "estimate vs solve vs predefined" labeling; production-grade solve quality within browser limits.

### Non-Goals

Backend/accounts/billing/sync; exact-GTO live multiway (general-sum); multiway deep-tree postflop. (Constrained HU postflop and full-hand analysis are now ON the roadmap — see docs/PRD.md FEAT-008 and the new full-hand-analysis epic.)

---

## Tech Stack

### Frontend
React + TypeScript + Vite; Zustand state. Web Worker for the solver.

### Backend
None (pure client-side, static hosting).

### Database
None server-side. Planned client-side: IndexedDB + OPFS (not built yet).

### Testing
Vitest (94 tests). Rust↔TS parity scripts (evaluator, equity) under `scripts/`.

### CI/CD
Starter GitHub Actions in `.github/workflows/` (ci/deploy/generate-library) — not yet exercised against the implemented app. Target host: Cloudflare Pages (COOP/COEP).

### Infrastructure
Rust toolchain (rustup 1.96 + wasm32 target + wasm-pack 0.13) for the `engine/` crate. Raw `wasm32` cdylib (no wasm-bindgen). Compiled wasm committed at `src/wasm/`.

---

## Active Features (built)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| FEAT-020 | Configurable preflop tool (2–9p, cash, position, stack) | Built | |
| FEAT-021 | Full action-frequency taxonomy | Built | |
| — | Scenario builder + default ranges + inline range editor | Built | |
| — | Position-calibrated multiway opens | Built | realization-edge model |
| FEAT-019 | Predefined chart cache + live fallback | Partial | RFI solved-offline; vs-open/vs-3bet curated |
| — | Offline generation pipeline (`gen:library`) | Built | RFI only |
| — | Rust→WASM: evaluator + equity + CFR+ | Built | full solve wired into worker (TS fallback) |
| FEAT-026 | Tournament / ICM | Not built | UI stub "coming soon" |
| FEAT-008 | Constrained HU postflop solving | Not built | part of full-hand-analysis epic |
| — | Full-hand analysis (hand-history import + replay + postflop) | Planned | new epic, see PRD |
| — | Local persistence / practice mode | Not built | |

---

## Current Risks (live)

| ID | Risk | Level | Mitigation | Status |
|----|------|-------|------------|--------|
| RISK-001 | In-browser postflop feasibility | High | constrained bound + spike; mostly deferred | Open |
| RISK-N1 | Multiway not exact GTO (general-sum) | High | 2-eff-player estimate, honest labels, curated charts | Mitigated/labeled |
| TD-002 | CFR still TS while equity is Rust (hybrid) | Med | port CFR — DONE (parity diff 0, 3.7x faster) | Resolved |

---

## Key Architecture Summary

### Current Architecture
Layered client-side SPA: UI (React/Zustand) → Web Worker (SolverEngine port) → engine (Rust/WASM CFR+ + equity, TS fallback) → domain core. Multiway reduced to a 2-effective-player game. See docs/ARCHITECTURE.md, docs/DATA_MODEL.md §13.

### Important Constraints
No backend; static hosting; honesty (never claim "exact GTO"); deterministic (seeded).

### Major Integrations
None external. Internal: Rust/WASM engine behind the same `SolverEngine` port (injectable equity builder).

---

## Quality Status

Testing Maturity: Good for the implemented preflop scope (94 vitest tests + Rust↔TS parity scripts).
Automation Status: Unit/integration via Vitest. No E2E yet. Reference-solver trust harness (planned) not built.
Known Coverage Gaps: No browser E2E; no automated wasm-in-worker test (validated via build + parity scripts); UI components lightly tested.
Flaky Tests: None known.

---

## CI/CD Status

Build Status: `npm run build` green; `npm run wasm:build` regenerates the wasm.
Test Pipeline Status: Local only (94 green). CI workflows are starters, not validated against the app.
Deployment Status: Not deployed. No git remote configured (local commits only).
Known CI/CD Issues: CI needs a Rust setup step if it builds the wasm (or rely on the committed wasm).

---

## Release Status

Current Release: None (pre-release, personal use).
Release Recommendation: N/A (active development).
Release Blockers: None blocking; license undecided (TBD).

---

## Notes

State files were dormant (templates) until 2026-06-28; now reflect reality. Source of truth remains the git history + README; these files summarize. Push: no remote yet — `git remote add origin <url> && git push -u origin main`.
