# ClearSolve — Personal Browser-Native NLHE Preflop Solver

> A private, install-free, no-account No-Limit Texas Hold'em GTO **preflop** study tool that runs entirely in your browser.

[![Status](https://img.shields.io/badge/status-working%20preflop%20solver%20%C2%B7%20active%20dev-brightgreen)](#roadmap)
[![Type](https://img.shields.io/badge/type-client--side%20SPA%20%C2%B7%20no%20backend-informational)](docs/ARCHITECTURE.md)
[![Engine](https://img.shields.io/badge/engine-Rust%2FWASM%20CFR%2B%20%2B%20equity-orange)](docs/TECH_DECISIONS.md)
[![Tests](https://img.shields.io/badge/tests-94%20passing-success)](#testing)
[![License](https://img.shields.io/badge/license-TBD-lightgrey)](#license)

> **Product name is a placeholder.** "ClearSolve" is a working name and is not final.

---

## Current Status — working preflop solver (active development)

There is a **real, runnable app**. You can configure a preflop spot, author the full action that came before you, and get a GTO strategy rendered as a 13×13 grid — all client-side, no backend.

**What's built and working today:**

- **Configurable preflop solver** — game type (cash; tournament/ICM is stubbed "coming soon"), **table size 2–9**, **hero position**, and **effective stack from sub-10bb to 1000bb**.
- **Full scenario builder** — author what *each* seat did before the hero (fold / limp / call / raise-to-X / all-in) to recreate the exact spot. Opponents are auto-assigned sensible **default ranges**, each **editable** via an inline 13×13 range editor.
- **Full action-frequency output** — raise (small / big / all-in), call, fold, plus **3-bet / 3-bet-shove / 4-bet-shove / 5-bet-shove**, labeled correctly by betting depth.
- **GTO-Wizard-style visualization** — a multi-action 13×13 grid (each cell split by action proportions), a betting-tree node navigator (labeled relative to *you*, not internal jargon), per-hand strategy on hover, and node action-frequency summaries.
- **Position-calibrated multiway opens** — open ranges tighten realistically by position (HU ~92% → BTN ~50% → CO ~32% → UTG ~16%).
- **Predefined chart cache + live fallback** — common spots (~100bb, 6-max & 9-max) are served **instantly** with a **PREDEFINED** badge; off-grid spots fall back to the live solver. Coverage so far: **RFI** by position (now **solved offline** — real mixed frequencies, see pipeline below); **vs a single open** (blind defense *and* in-position, defender-position aware); **vs a 3-bet** (fold/call/4-bet, via a "Hero opened, vs 3-bet" mode). 4-bet+ pots and other depths fall back to live.
- **Offline generation pipeline** — `npm run gen:library` runs the solver on the desktop (shared equity matrix, high CFR iterations — no browser limits) and writes a committed JSON library the app loads. This is how RFI charts become *solved* (with proper mixing) rather than hand-curated; it's the path to broader solved coverage.
- **First-class, honest trust labeling** — see below.

**What is *not* built yet (intentionally):** multi-threaded WASM (the engine is fully ported but still single-threaded), broader chart coverage (more depths), local persistence, practice/drill mode, postflop solving, and full-hand analysis (hand-history import). These remain on the roadmap.

---

## How it works (honest summary)

- **Engine: a real CFR+ solver, now fully Rust/WASM.** The solver runs in a **Web Worker**, off the main thread, behind a clean `SolverEngine` port. It uses a 169-class hand abstraction, a fast 7-card evaluator, and a seeded Monte-Carlo all-in equity matrix (deterministic: same input → same output). **Both the equity build *and* the CFR+ traversal run in Rust/WASM** (bit-identical to the original TypeScript, ~2.7× faster equity / ~3.7× faster solve), with an automatic TS fallback if the wasm fails to load — all behind the same port, **without UI changes**.
- **Multiway is reduced to a 2-effective-player game.** A 2–9-handed table is collapsed to *hero vs one composite opponent* (the live opponents' ranges combined), with dead money and pot odds modeled correctly. This keeps heads-up-resolved spots genuinely trustworthy and multiway spots a clearly-labeled estimate.
- **Trust is a first-class output, and the tier is honest:**
  - **1 live opponent** (heads-up, or folds-to-one-raiser) → **"LIVE SOLVE"** with an exploitability *estimate*.
  - **2+ live opponents** (genuine multiway) → amber **"ESTIMATE"** — the field is collapsed to one composite opponent; **not** exact multiway GTO.
  - The string **"exact GTO" never appears** (enforced by a test).
- **Exploitability is reported as an estimate**, within the abstraction used — never a guarantee.

For the deeper rationale (the 2-effective-player reduction, the cold-call pot-odds model, the open-calibration heuristic, and the range editor), see **[docs/DATA_MODEL.md §13.9.1](docs/DATA_MODEL.md)**.

---

## Getting started

Requires **Node.js 20+**. No Rust toolchain is needed to run the app — the compiled wasm is committed; Rust (+ wasm-pack) is only needed to *rebuild* the engine via `npm run wasm:build`.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build -> dist/
npm run test     # vitest (94 tests)
```

In the app: pick the **game type, table size, hero position, and stack**, set **the action before the hero** (each earlier seat), optionally **edit any opponent's range**, then **Solve**.

> The dev/preview server sets `COOP`/`COEP` headers (cross-origin isolation) so the planned multi-threaded WASM engine will work later; it has no effect on the current single-threaded TypeScript engine.

---

## Tech stack

| Layer | Current | Planned |
|-------|---------|---------|
| Solver engine | **Full Rust→WASM** (raw `wasm32` cdylib, no wasm-bindgen): equity build *and* CFR+ solve, both in a Web Worker behind the `SolverEngine` port, with a TS fallback | Multi-threaded wasm (SharedArrayBuffer) |
| Algorithm | CFR+ with regret-matching+ over the preflop bet tree; seeded Monte-Carlo equity (Rust eval7 + equity matrix, bit-identical to TS) | CFR+/DCFR, multi-threaded (SharedArrayBuffer), vanilla CFR oracle |
| Frontend | **React + TypeScript + Vite**, **Zustand** state | (same) |
| Hosting | Static build (`dist/`) | **Cloudflare Pages**/Netlify with COOP/COEP |
| Persistence | — (not yet) | IndexedDB + OPFS |

---

## Project structure

```
src/
  domain/    cards, evaluator7, equity, equityMatrix, range169, defaultRanges,
             handClasses, pairWeights, betTree, preflopCfr, pushfold,
             seatLayout, projectSpot, spotV2, actionLabels   (pure, framework-free)
  engine/    types (SolverEngine port), preflopEngine, resultV2
  worker/    protocol, solver.worker, workerClient            (the SolverEngine over postMessage)
  ui/        SpotConfig, BetTreeView, MultiActionGrid, NodeNavigator,
             RangeEditor, nodeLabels, ResultPanel, Legend, colors
  app/       App, store (Zustand), main
scripts/     realism / calibration dev utilities (not shipped)
docs/        design docs (PRD, ARCHITECTURE, DATA_MODEL, ...) — see map below
```

---

## Honest limitations

- **Preflop only.** No postflop solving.
- **Engine is now fully ported to Rust→WASM.** Both the **equity build** (~2.7× faster) and the **CFR+ solve** (~3.7× faster) run in **Rust/WASM** in the worker, bit-identical to the old TS path (validated to < 1e-9 max diff before wiring in). A TS fallback runs automatically if the wasm fails to load, and node tests/scripts stay on the TS path via injectable providers. Next step: multi-threaded wasm.
- **Multiway is a labeled estimate**, not true multiway GTO (3+ player games are general-sum — no single equilibrium). Reference-grade multiway needs precomputed charts (future work). Heads-up-resolved spots are the trustworthy ones.
- **Opponent ranges are heuristic defaults** (editable). Multiway opens are *position-calibrated estimates*, not chart-exact.
- **Only RFI is solver-generated; vs-open / vs-3-bet stay curated.** Solving the response spots offline via the current 2-player reduction was evaluated and **rejected** (see [finding](#finding-solver-generated-response-charts-need-a-better-engine)) — it produced *less* accurate output than the curated reference charts.
- **No persistence / practice mode yet.**

### Finding: solver-generated response charts need a better engine

We tried extending the offline pipeline (`gen:library`) to *solve* vs-open and vs-3-bet charts instead of curating them. The output was **structurally worse** than the curated charts — not a tuning/convergence issue:

- **vs-3-bet:** the opener "called" ~61% facing a 3-bet (should fold ~85%) — the depth-2 pot geometry in the 2-player reduction is wrong.
- **In-position defense collapsed** (MP = HJ = CO = BTN): the 2-player reduction can't represent defender position, so the per-defender granularity is lost.
- **Blind-vs-blind wrong** (BB vs SB defended too tight): the realization-edge model assumes the opener is in position.
- **CO and BTN openers collapse** because the opener's *assumed* range is tier-based.

RFI generation works only because it has a deliberate position-aware realization-edge model; the response spots have no analogous model, and the 2-player reduction is too coarse. **Conclusion:** solver-generated response/multiway charts are gated on a genuinely better engine (Rust→WASM with proper multiway / postflop), not more heuristics on the current TypeScript 2-player model.

---

## Testing

```bash
npm run test      # 94 tests
```

Coverage includes: 7-card evaluator cross-validation, known equities (AA vs KK ≈ 82%), determinism (same seed → identical strategy), CFR frequency-sum and zero-sum invariants, short-stack/push-fold parity, the scenario projection (composite ranges, dead-money pot odds, live-opponent counting), range overrides, open-calibration monotonicity, and the trust-labeling rules (incl. the "never says exact GTO" guard).

---

## Roadmap

**Done:** HU push/fold solver · HU preflop bet-tree CFR+ · generalized 2–9-handed preflop tool · full action taxonomy · scenario builder · default ranges + inline range editor · correct cold-call pot odds · position-calibrated multiway opens · honest trust labeling · **predefined chart cache (RFI solved-offline at ~100bb *and* ~200bb + vs-open defense + vs-3-bet, 6-max & 9-max) with live fallback** · **full Rust→WASM engine** (equity + CFR+, bit-identical, ~2.7×/3.7× faster) · **solve-quality selector (Fast/Balanced/Max)** · **depth-aware realization edge**.

**Next (candidates):** realistic open-sizing (the coarse min-raise/jam abstraction over-jams some opens — fix the open node to use a true non-jam raise) · more stack-depth buckets · 4-bet pots · multi-threaded wasm · **full-hand analysis** (postflop continuation + hand-history import/replay — Epic E10 / PRD §23) · tournament/ICM · local persistence (save/load) · practice/drill mode · true multiway via the engine. Build the wasm with `npm run wasm:build` (needs the Rust toolchain); the prebuilt wasm is committed so the app builds without Rust.

Original milestone planning lives in [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

---

## Documentation map

Design docs live in [`docs/`](docs/). They describe the full intended product (including not-yet-built pieces); the scope-expansion details are in `DATA_MODEL.md §13`.

| Document | Description |
|----------|-------------|
| [docs/PRD.md](docs/PRD.md) | Product requirements — vision, scope, constraints, features, trust tiering. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture — components, ports, data flow, multiway/ICM design. |
| [docs/TECH_DECISIONS.md](docs/TECH_DECISIONS.md) | Architecture Decision Records (ADRs) + approval gates. |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Domain types; **§13** = generalized model, **§13.9.1** = the scenario builder. |
| [docs/API_SPEC.md](docs/API_SPEC.md) | Internal contracts — Worker protocol + `SolverEngine`/cache/persistence ports. |
| [docs/USER_STORIES.md](docs/USER_STORIES.md) · [docs/ACCEPTANCE_CRITERIA.md](docs/ACCEPTANCE_CRITERIA.md) | Stories and acceptance criteria. |
| [docs/TEST_STRATEGY.md](docs/TEST_STRATEGY.md) · [docs/QUALITY_GATES.md](docs/QUALITY_GATES.md) · [docs/TEST_COVERAGE_MATRIX.md](docs/TEST_COVERAGE_MATRIX.md) | Test strategy, gates, coverage matrix. |
| [docs/RISKS.md](docs/RISKS.md) | Risk register. |
| [docs/DEVOPS.md](docs/DEVOPS.md) | CI/CD, Rust→WASM→Vite build, hosting, offline generation. |
| [docs/TASKS.md](docs/TASKS.md) · [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Backlog and delivery sequencing. |

---

## Disclaimer

ClearSolve is a **personal-use study tool**. The strategies it produces are **best-effort estimates within a simplified game model — not guaranteed exact Nash equilibria for full No-Limit Hold'em.** Multiway results are an explicit approximation (field collapsed to one opponent). Reported exploitability is an estimate at the current iteration count, within the abstraction used, and is always labeled as such — never a claim of "exact GTO". Intended for personal study, not real-time in-game assistance.

---

## License

**To be decided.** No license has been chosen yet; until one is added, all rights are reserved by default.
