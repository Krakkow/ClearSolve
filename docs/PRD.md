# Product Requirements Document — Personal Browser-Native NLHE Preflop Decision Tool & GTO Solver

> STATUS: APPROVED by stakeholder (2026-06-24); MAJOR SCOPE EXPANSION APPROVED (2026-06-25)
> Owner: Product Owner Agent
> Last Updated: 2026-06-26
> Working product name (placeholder): "ClearSolve" (to be confirmed)
>
> NOTE ON THIS REVISION: This revision incorporates the stakeholder's scope answers (personal-use positioning, no accounts/monetization, best-effort performance, a bundled predefined-solution cache, practice mode in MVP, legal review deferred), confirmed 2026-06-24.
>
> NOTE ON 2026-06-25 SCOPE EXPANSION (APPROVED): The stakeholder approved a major expansion turning the product into a general, configurable PREFLOP decision tool, configurable by stack size (sub-10bb to 1000bb), number of players (2–9), game type (cash vs tournament/ICM), hero position, and prior action before hero (bet-context aware), outputting per-action FREQUENCIES (raise small/big/all-in, call, fold, 3-bet, 3-bet shove, 4-bet shove, 5-bet shove). The stakeholder chose **Option 1** (heads-up delivered as a trustworthy LIVE solve; multiway and tournament/ICM delivered as PRECOMPUTED CHARTS plus a clearly-labeled live "estimate" — explicitly NOT exact-GTO live solves) and **cash multiway first** (cash 6-max/full-ring before tournament/ICM). This is recorded as an ACCURACY/TRUST TIERING honesty requirement (new Section 5A). See revision note in Section 21 and approval gates in Section 22.

---

## 1. Overview

### 1.1 Summary

A single-page web application (SPA) — built as a **personal-use study tool for a single user** — that is a **general, configurable No-Limit Texas Hold'em (NLHE) PREFLOP decision tool**, backed by a **live Game Theory Optimal (GTO) solver running entirely in the browser** and a **bundled predefined (precomputed) chart/solution library** for situations that cannot be solved live to exact-GTO quality. The user configures a spot by **stack size (sub-10bb up to 1000bb), number of players at the table (2–9), game type (cash vs tournament/ICM), hero's position, and the prior action before hero (whether there were bets/raises and their sizes — bet-context aware)**. The tool outputs the **percentage frequencies of hero's actions**: RAISE (small / big / all-in), CALL, FOLD, plus 3-BET, 3-BET SHOVE, 4-BET SHOVE, and 5-BET SHOVE. For spots that match a precomputed entry the app serves it instantly; for live-solvable spots it computes on demand using a Counterfactual Regret Minimization (CFR) engine compiled to WebAssembly (WASM). All compute, data, and persistence run client-side; there is no backend server. The product (app shell, WASM engine, and predefined library) ships entirely as static assets.

This is a **hybrid, tiered tool**: a live CFR engine for the cases where exact GTO is well-defined and tractable (heads-up), plus a bundled precomputed chart/estimate library for the cases where it is not (multiway, tournament/ICM). It is positioned as a high-quality personal solver/study tool, not a multi-tenant commercial product.

> CRITICAL HONESTY REQUIREMENT (see Section 5A): Heads-up (2-player) is a zero-sum game with a well-defined, unique-value equilibrium, so HU results are delivered as a trustworthy **live solve** with an exploitability estimate. Multiway (3–9 players) is a **general-sum** game with no unique equilibrium and undefined exploitability; tournament/ICM adds a payout-structure-dependent utility model. Multiway and ICM results are therefore delivered as **precomputed charts or a clearly-labeled live "estimate"** and must NEVER be presented as "exact GTO".

### 1.2 Vision

Give a single dedicated poker student a high-quality, private, install-free preflop decision tool: for any table configuration (stack, player count, cash/tournament, position, prior action) get honest, clearly-tiered guidance — a trustworthy live solve where exact GTO is well-defined (heads-up), and clearly-labeled precomputed charts or estimates where it is not (multiway, ICM) — plus clear study/practice tooling, all running locally in the browser with no account, no server, and no cost.

### 1.3 Status

Draft, pending the user's own confirmation. This is the foundational product artifact. The relayed stakeholder answers (Section 21) are treated as direction and have been locked into scope below, but final sign-off rests with the user.

---

## 2. Problem Statement

A dedicated poker student wants to study GTO strategies to identify and correct leaks, but existing options force trade-offs:

- **Desktop solvers** (e.g. PioSOLVER-class tools) are powerful but require installation, are often Windows-bound, have steep UX, and are not portable.
- **Cloud/library products** (e.g. GTO Wizard-class) offer polished UX and huge spot coverage but require paid accounts/subscriptions and put compute behind a server; the user does not own the tool or control the compute.
- A single user who wants **a private, free, install-free study tool** with instant answers for common spots and the ability to solve novel spots locally currently has no strong web-native option.

**The gap:** A zero-install, zero-backend, privacy-preserving personal web app that gives **configurable preflop decisions across the real axes the user faces** — stack depth (sub-10bb to 1000bb), table size (2–9 players), cash vs tournament/ICM, hero position, and the prior action before hero — and is **honest about what it can and cannot solve to exact GTO**: it combines a bundled precomputed chart/solution library (instant answers, and the only honest delivery vehicle for multiway/ICM) with on-demand client-side GTO solving for the cases where exact GTO is well-defined (heads-up), plus study/practice tooling, all persisted locally.

**A second honesty gap the expansion addresses:** Many tools present "GTO" output for multiway and ICM spots as if it were exact equilibrium. Multiway poker is general-sum (no unique equilibrium; exploitability is undefined), and ICM strategies depend on the payout structure and all players' stacks. This product deliberately separates trust tiers (Section 5A) and never mislabels an estimate or a chart as "exact GTO".

**Scope-tension status — RESOLVED:** Earlier drafts flagged a tension between a "production-grade GTO Wizard competitor" and the "no backend" constraint. The stakeholder has resolved this by positioning the product as a **personal-use tool for a single user**: no accounts, no billing, no sync, no server-hosted library. The competitor-scale framing is dropped as a current goal and noted only as a possible FUTURE direction. See Section 4 (CON-3 revised), Section 21, and RISK-002 (now downgraded).

---

## 3. Target User

This is a **single-user, personal-use** product. There is one primary user; there is no multi-tenant audience, no segmentation, and no commercial market positioning.

### 3.1 Primary User

| User Type | Description | Primary Needs |
|-----------|-------------|---------------|
| The owner (dedicated poker student) | A single committed player studying GTO for their own improvement. Comfortable enough to configure spots (stack, players, game type, position, prior action); wants instant answers for common situations and the ability to solve novel ones. | Configurable preflop decisions across stack/player-count/game-type/position/prior-action; a clear per-action frequency output (raise sizes, call, fold, 3-bet/3-bet shove/4-bet shove/5-bet shove); honest trust-tiering (live HU solve vs labeled multiway/ICM charts/estimates); instant lookups for common spots; on-demand solving where exact GTO is well-defined; clear visualization; a practice/drill mode; trustworthy output; private local storage. |

### 3.2 Persona — "The Owner" (single user)
- Description: One dedicated poker player who owns and uses this tool for personal study. Studies regularly, faces a recurring set of common spots, and occasionally wants to explore custom/novel spots.
- Goals: Quickly look up the GTO play for common preflop (and selected postflop) spots; solve novel spots on demand; drill weak spots with a practice mode; keep a private, local library of studied spots; trust the output.
- Pain Points: Subscription cost and account friction of cloud tools; install/portability friction of desktop solvers; wants instant answers for routine spots without waiting for a solve every time.

> Note: Earlier multi-persona framing (grinder/coach/learner) is removed; the product targets one personal user per the stakeholder's personal-use decision.

---

## 4. Key Constraints (LOCKED — stakeholder-decided, fixed inputs)

These three constraints are treated as fixed and shape all scope decisions.

| ID | Constraint | Implication |
|----|------------|-------------|
| CON-1 | **Live solver engine (with predefined cache).** The app runs an actual GTO/CFR solving engine (intended WASM, in-browser) that computes strategies on demand. It is augmented by a bundled predefined-solution cache that serves common spots instantly; the engine handles novel spots. It is NOT merely a precomputed-solution viewer — live solving remains core. | The live solver is still the core capability. The predefined cache is a first-class complement, not a replacement. Both ship as static assets. |
| CON-2 | **Pure client-side SPA.** No backend server. All compute (WASM solver), data, predefined solution library, and persistence run in/are served from the browser (static assets + IndexedDB). Static hosting only. | No accounts, billing, sync, or server-side compute. The predefined solution library is bundled static data, not server-hosted. All limits (memory, CPU, storage) are the user's device limits. |
| CON-3 | **Personal-use, high-quality tool (REVISED).** The goal is a high-quality study tool for a single personal user — good UX and correctness, but NOT multi-tenant, NOT built for scale, NOT a commercial GTO Wizard competitor. | Drop competitor/scale positioning. Aim for quality and correctness at single-user scope. "Production-grade competitor" is a possible FUTURE direction only (Section 6.3). |

> NOTE — TENSION RESOLVED: The earlier CON-2 vs CON-3 tension is resolved by the personal-use decision. Because the product is single-user with no backend by design, there is no longer a conflict to manage: accounts/billing/sync/server-library are simply out of scope by intent, not by compromise. RISK-002 is correspondingly downgraded.

---

## 5A. Accuracy / Trust Tiering (HONESTY REQUIREMENT — APPROVED 2026-06-25)

This is the most important product principle introduced by the 2026-06-25 scope expansion. The product spans game configurations with **fundamentally different mathematical guarantees**, and the UI and docs MUST reflect those differences honestly. The stakeholder approved **"Option 1"**: live solve where exact GTO is well-defined; precomputed charts / labeled estimate where it is not.

### Why tiering is mandatory

- **Heads-up (2 players)** is a **two-player zero-sum** game: a Nash equilibrium exists, its value is unique, and **exploitability is well-defined and measurable**. A live solve can be trusted and quality-reported as an exploitability estimate.
- **Multiway (3–9 players)** is a **general-sum** game: there is **no unique equilibrium**, equilibria need not be interchangeable, and **exploitability is undefined** in the HU sense. A live in-browser "solve" cannot honestly claim to be exact GTO. It is at best a labeled estimate of an approximate equilibrium under stated assumptions.
- **Tournament / ICM** further replaces chip-EV with a **payout-structure-dependent** utility (Independent Chip Model or similar), which requires the payout structure and all players' stacks as inputs and is itself a model/approximation.

### The three trust tiers

| Tier | Configuration | Delivery | Quality signal shown | Labeling rule |
|------|---------------|----------|----------------------|----------------|
| **Tier 1 — Live (trustworthy)** | Heads-up (2 players), cash, supported stack buckets | LIVE in-browser solve (with predefined cache for common spots) | Exploitability estimate (bb/100 or % pot) at current iteration | "Live solve" / may show exploitability; never "exact GTO" without the convergence caveat (BR-005) |
| **Tier 2 — Precomputed chart** | Multiway (3–9) cash; later tournament/ICM | PRECOMPUTED chart bundled as static data | Generation method + assumptions; NOT exploitability | MUST be labeled "Predefined chart" / "Precomputed"; MUST NOT be labeled "exact GTO" |
| **Tier 3 — Live estimate (labeled)** | Multiway / ICM spots with no matching chart | LIVE approximate computation | Clearly marked approximate / assumptions stated; NO exploitability claim | MUST be labeled "Estimate (not exact GTO)"; MUST visibly differ from Tier 1 labeling |

### Hard labeling rules (testable — see ACCEPTANCE_CRITERIA.md AC-031/AC-032)

- TR-1: HU live results MAY show an exploitability estimate and be called a "live solve"; they MUST still carry the convergence caveat (not "exact GTO" unless fully converged within tolerance — BR-005).
- TR-2: Multiway and ICM results MUST be labeled "Estimate" or "Predefined/Precomputed chart" and MUST NEVER use the words "exact GTO", "GTO solution", or "solved" without an explicit estimate/approximation qualifier.
- TR-3: Every result MUST display which tier it is (Tier 1/2/3), the inputs/assumptions used, and (for ICM) the payout structure and stack distribution assumed.
- TR-4: The tool MUST NOT report an exploitability number for multiway/ICM results, because exploitability is undefined there. It may report a different, honestly-named confidence/assumption indicator instead.

### Delivery sequencing (stakeholder: "cash multiway first")

1. Tier 1 HU cash live solve (core).
2. Tier 2 cash multiway charts (6-max, then full-ring) — **prioritized before tournament/ICM**.
3. Tier 2/3 tournament/ICM charts/estimates — **after** cash multiway. Requires payout structure + all players' stacks as inputs.

### Deep stacks (200–1000bb)

Deep-stack support (200–1000bb) is delivered via **abstraction + stack buckets**, NOT full-resolution live solving (combinatorial blow-up — see RISK-015). Stack depth is bucketed; the active bucket and its abstraction are shown with the result.

---

## 5. Goals & Non-Goals

### 5.1 Goals (MVP)

- G1: Deliver a working in-browser CFR solver that produces a **correct, best-effort** equilibrium strategy for **preflop heads-up (Tier 1, live)** spots, with an exploitability estimate.
- G2: Ship a **bundled predefined chart/solution library** that the app serves instantly: HU caches (Tier 1) and **multiway cash charts (Tier 2)** — the only honest delivery vehicle for multiway — falling back to live solving/estimate appropriately.
- G3: Let the user configure a spot along all approved axes through an approachable UI: **stack size (sub-10bb–1000bb, bucketed), number of players (2–9), game type (cash vs tournament/ICM), hero position, and prior action before hero (bet-context aware)**.
- G4: Produce the approved **per-action frequency output taxonomy**: RAISE (small / big / all-in), CALL, FOLD, 3-BET, 3-BET SHOVE, 4-BET SHOVE, 5-BET SHOVE — with frequencies summing to 100% over the applicable action set.
- G5: Enforce the **accuracy/trust tiering** (Section 5A): live HU solves with exploitability; multiway/ICM as clearly-labeled precomputed charts or estimates, never "exact GTO".
- G6: Present output with clear, study-tool-quality visualization: action-frequency display per hand/range, and (where defined) EV/equity.
- G7: Provide a **practice/drill mode** so the user can test and reinforce recall.
- G8: Persist user configurations and completed solves locally (IndexedDB) so work survives reloads.
- G9: Be honest and transparent about result quality and **source/tier** (live solve vs predefined chart vs estimate), settings, and assumptions.
- G10: Run entirely from static hosting with no backend and no required account.

> SEQUENCING: Per stakeholder, **cash multiway charts (6-max then full-ring) are prioritized before tournament/ICM**. Tournament/ICM is a later phase (Section 6.3).

### 5.2 Non-Goals (MVP)

- NG1: We are NOT building any **server-hosted** solution library or server-side compute. (Note: a *bundled, client-side* predefined library IS in scope — see G2/FEAT-019.)
- NG2: We are NOT building accounts, authentication, billing, or subscription management. (Personal-use tool.)
- NG3: We are NOT building cross-device cloud sync.
- NG4 (RESCOPED 2026-06-25): Multiway (3–9) is **no longer a blanket non-goal**. It is now a SCOPED, TIERED capability for **preflop**: multiway is delivered as **precomputed charts (Tier 2)** or a **clearly-labeled live estimate (Tier 3)** — see Section 5A and FEAT-020/FEAT-021. What REMAINS out of scope: (a) **exact-GTO live multiway solving** (general-sum; no unique equilibrium; exploitability undefined — we never claim it), and (b) **multiway deep-tree POSTFLOP** solving (still infeasible in-browser — see RISK-001). The expansion is preflop-focused.
- NG5: We are NOT building hand-history import/auto-analysis from poker sites in MVP.
- NG6: We are NOT guaranteeing solve quality competitive with high-iteration desktop solvers for large trees; performance is best-effort (see NFR-001).
- NG7: We are NOT providing real-time in-game assistance.
- NG8: We are NOT building this as a multi-tenant or commercial product; no market/scale features.

---

## 6. Scope

### 6.1 MVP — In Scope

- **Solver engine (CON-1):** WASM-compiled CFR-based solver (e.g. CFR+/Discounted CFR variant — final algorithm is an Architect decision) running in a Web Worker.
- **Configurable preflop spot model (NEW — core of the expansion):** The user configures a spot along all approved axes: **stack size (sub-10bb up to 1000bb, delivered via stack buckets), number of players (2–9), game type (cash vs tournament/ICM), hero position (by table size: UTG..BTN/SB/BB), and the prior action before hero** (whether there were limps/bets/raises and their sizes — **bet-context aware**). The decision is computed for hero's position given that prior action.
- **Per-action frequency output taxonomy (NEW):** Output is the percentage frequency of each of hero's actions over the applicable action set: **RAISE (small / big / all-in), CALL, FOLD, 3-BET, 3-BET SHOVE, 4-BET SHOVE, 5-BET SHOVE**. The applicable subset depends on the bet-context (e.g. facing a 3-bet enables 4-bet shove). Frequencies sum to 100% over the applicable set (BR-003 / BR-009).
- **Tier 1 — HU live solve (core):** Heads-up (2-player) preflop spots: configurable stack bucket, hero position, prior action; serve from cache when available, else produce equilibrium strategy live, with an exploitability estimate.
- **Tier 2 — Multiway cash charts (NEW, cash-first):** Bundled **precomputed charts** for 3–9 player **cash** preflop spots, prioritized **6-max then full-ring** ahead of tournament/ICM. Served instantly; clearly labeled "Predefined chart"; never "exact GTO".
- **Tier 3 — Multiway/ICM live estimate (NEW, labeled):** For multiway/ICM spots without a matching chart, an approximate live computation, **clearly labeled "Estimate (not exact GTO)"** with assumptions shown. No exploitability number is reported (undefined for general-sum).
- **Predefined chart/solution library (NEW):** A bundled, client-side library of precomputed entries (HU caches + multiway cash charts). On lookup, serve a genuine match instantly; otherwise fall back to live solve (Tier 1) or labeled estimate (Tier 3). Entries are labeled by tier and tagged with generation settings/assumptions.
- **Deep-stack abstraction (NEW):** Stacks 200–1000bb are supported via **abstraction + stack buckets**, not full-resolution live solving (RISK-015). Active bucket shown with the result.
- **Constrained postflop solving (Tier 1, HU only, secondary to the preflop expansion):** A deliberately limited class of postflop spots — heads-up, single-board, limited bet-sizing tree, with abstraction. Exact bound is an Architect + performance-budget decision; documented in-app. NOTE: the 2026-06-25 expansion is preflop-focused; postflop remains HU-only and lower priority than completing the preflop tier work.
- **Practice / drill mode (NEW, promoted to MVP):** The user can drill against solved/predefined spots — the app presents a spot, the user estimates the correct action/frequency, and the app reveals and scores the answer against the GTO solution.
- **Spot configuration UI:** stacks, positions, pot/effective stack, range editor (13x13), board/runout input, bet-sizing tree selection.
- **Range editor:** interactive 13x13 hand matrix for range construction (select/weight hands).
- **Strategy visualization:** 13x13 grid colored by action; per-hand action frequencies; aggregate frequencies.
- **EV & equity display:** show EV per action/hand and range-vs-range equity.
- **Solve controls & transparency:** start/stop solve, progress indicator, iteration count, convergence/exploitability estimate, the settings/abstractions used, and the result source (predefined cache vs live solve).
- **Local persistence (CON-2):** save/load spot configurations and completed solve results in IndexedDB; list/manage saved items.
- **Pure static SPA:** loads and runs offline-capable after first load (PWA-style caching is a Should, not a Must).

### 6.2 MVP — Out of Scope (explicitly)

- Any **server-hosted** solution library or server-side compute (NG1). (Bundled client-side predefined cache is IN scope.)
- Accounts, auth, billing, subscriptions, monetization (NG2).
- Cross-device sync (NG3).
- **Exact-GTO live multiway solving** and any presentation of multiway/ICM output as "exact GTO" (NG4 rescoped — multiway preflop is IN scope only as Tier 2 charts / Tier 3 labeled estimates).
- **Multiway deep-tree postflop** solving (NG4 — still infeasible).
- **Tournament/ICM in the first delivery slice** — explicitly **after** cash multiway (stakeholder "cash multiway first"); ICM is a later phase (Section 6.3), not an MVP-slice deliverable.
- Hand-history import / site integration (NG5).
- Advanced training analytics: spaced-repetition scheduling, long-term leak tracking across sessions, and rich progress dashboards (the MVP practice mode is single-spot drill + score; richer training is Future).
- Nodelocking (constraining opponent strategy at a node) — Future.
- Real-time in-game assistance (NG7).
- Mobile-optimized layout (desktop-first for MVP; responsive is a Could).

### 6.3 Future Scope (post-MVP)

- **Tournament / ICM charts and estimates (Tier 2/3)** — the next major phase AFTER cash multiway (stakeholder "cash multiway first"). Requires payout structure + all players' stacks as inputs; chip-EV replaced by an ICM utility model.
- Expanded multiway cash chart coverage (more player counts, stack buckets, positions, bet-context branches) beyond the initial generated set (Q-010/Q-011).
- Larger/faster solving via better abstraction, multi-threaded WASM (SharedArrayBuffer + cross-origin isolation), SIMD.
- Expanded predefined library (deeper postflop coverage, more HU stack buckets).
- Richer training: spaced repetition, leak tracking, progress dashboards.
- Nodelocking and exploitative analysis.
- Multiway POSTFLOP support (if ever feasible/honestly deliverable).
- Hand-history import and bulk analysis.
- Shareable spot links / export.
- POSSIBLE FUTURE DIRECTION ONLY: evolving toward a multi-user / production-grade "GTO Wizard competitor" — would require a backend (accounts, sync, server-hosted library, billing) and a deliberate re-scoping decision. Explicitly NOT a current goal.

---

## 7. Prioritized Feature List (MoSCoW)

Feature IDs (FEAT-*) are referenced by user stories in `USER_STORIES.md` and requirements below.

| ID | Feature | Priority | Notes |
|----|---------|----------|-------|
| FEAT-001 | WASM CFR solver engine (core compute) | Must | CON-1. Runs in Web Worker; reports progress & convergence. |
| FEAT-002 | Preflop HU spot configuration & solve (Tier 1) | Must | Stack bucket, hero position, prior action (bet-context). Live solve + exploitability. |
| FEAT-020 | Configurable spot model: stack (sub-10bb–1000bb buckets), players (2–9), game type (cash/tournament-ICM), hero position, prior action (bet-context aware) | Must | NEW (2026-06-25). The core configuration axes of the expansion. Stack via buckets; deep stacks via abstraction (FEAT-023). |
| FEAT-021 | Per-action frequency output taxonomy: RAISE (small/big/all-in), CALL, FOLD, 3-BET, 3-BET SHOVE, 4-BET SHOVE, 5-BET SHOVE | Must | NEW. Applicable subset depends on bet-context; frequencies sum to 100% over applicable set (BR-009). |
| FEAT-022 | Multiway cash preflop charts (Tier 2), 6-max then full-ring | Must | NEW. Precomputed, bundled, labeled "Predefined chart"; never "exact GTO". Cash-first. |
| FEAT-025 | Multiway/ICM live "estimate" (Tier 3), clearly labeled | Should | NEW. Approximate live computation for multiway/ICM spots without a chart; labeled "Estimate (not exact GTO)"; no exploitability claim. |
| FEAT-023 | Deep-stack support via abstraction + stack buckets (200–1000bb) | Should | NEW. Not full-resolution live solving (RISK-015). Active bucket shown. |
| FEAT-026 | Tournament / ICM charts & estimates (payout structure + all stacks as inputs) | Won't (this slice) / Future | NEW. Explicitly AFTER cash multiway (stakeholder "cash multiway first"). Requires payout structure + all players' stacks. |
| FEAT-024 | Accuracy/trust tiering & labeling enforcement (Tier 1/2/3) | Must | NEW. UI/data must label every result by tier/source; multiway/ICM never "exact GTO" (Section 5A, BR-010/011). |
| FEAT-003 | 13x13 range editor | Must | Build/weight ranges for both players. |
| FEAT-004 | Strategy grid visualization | Must | Action-colored 13x13 grid + frequencies. |
| FEAT-005 | EV & equity display | Must | Per-action/hand EV; range-vs-range equity. |
| FEAT-006 | Solve controls + convergence/exploitability transparency | Must | Start/stop, progress, iterations, exploitability estimate, settings shown. |
| FEAT-007 | Local persistence (IndexedDB) of spots & results | Must | CON-2. Save/load/list/delete. |
| FEAT-008 | Constrained postflop solving (single board, limited tree, abstraction) | Should | Tractability-bounded; documented limits. Curated spots also in predefined cache. |
| FEAT-009 | Bet-sizing tree configuration | Should | Limited, fixed set of sizes in MVP. |
| FEAT-010 | Board/runout input | Should | Required for postflop; flop/turn/river input. |
| FEAT-011 | Static hosting + offline-capable load (PWA caching) | Should | App shell + WASM + predefined library cached for offline use. |
| FEAT-012 | Practice / drill mode (estimate the action/frequency, scored vs solution) | Must | Promoted to MVP. Drills against predefined + solved spots. |
| FEAT-013 | Responsive/mobile layout | Could | Desktop-first; not blocking MVP. |
| FEAT-014 | Spot export/import (file-based) | Could | Local backup/share without backend. |
| FEAT-015 | Nodelocking | Won't (MVP) | Future. |
| FEAT-016 | Server-hosted library / accounts / sync / billing / multi-tenant | Won't (MVP) | Out of scope by intent (personal-use, no backend). Possible FUTURE direction only. |
| FEAT-017 | Multiway (3+) POSTFLOP solving / exact-GTO live MULTIWAY solving | Won't | RESCOPED 2026-06-25: multiway PREFLOP is now in scope as Tier 2 charts (FEAT-022) / Tier 3 estimate (FEAT-025). Stays Won't: multiway deep-tree POSTFLOP (RISK-001) and any EXACT-GTO LIVE MULTIWAY solve (general-sum; never claimed — RISK-016). |
| FEAT-018 | Hand-history import & auto-analysis | Won't (MVP) | Future. |
| FEAT-019 | Predefined (precomputed) chart/solution library, bundled client-side | Must | Instant answers; HU caches (Tier 1) + multiway cash charts (Tier 2). Live fallback/estimate on miss. Key RISK-001 mitigation and the only honest delivery vehicle for multiway. |

---

## 8. Functional Requirements

| ID | Requirement | Priority | Linked Feature |
|----|-------------|----------|----------------|
| REQ-001 | The system shall run a CFR-based solver compiled to WASM that computes an equilibrium strategy on demand without any server call. | Must | FEAT-001 |
| REQ-002 | The solver shall execute off the main UI thread (Web Worker) so the UI remains responsive during a solve. | Must | FEAT-001 |
| REQ-003 | The system shall let a user configure a heads-up preflop spot: effective stack depth, both positions, and a starting range per player. | Must | FEAT-002 |
| REQ-004 | The system shall provide a 13x13 hand-matrix range editor supporting selecting and weighting hands (0–100%). | Must | FEAT-003 |
| REQ-005 | The system shall display the solved strategy as a 13x13 grid where each cell shows the action mix (frequencies) for that hand. | Must | FEAT-004 |
| REQ-006 | The system shall display per-hand EV per action and range-vs-range equity. | Must | FEAT-005 |
| REQ-007 | The user shall be able to start and stop a solve, and the system shall display live progress (iterations and/or % toward target). | Must | FEAT-006 |
| REQ-008 | The system shall display a convergence/exploitability estimate (e.g. estimated exploitability in bb/100 or % of pot) and the abstraction/settings used for the solve. | Must | FEAT-006 |
| REQ-018 | The system shall ship a bundled, client-side predefined solution library and, on a spot lookup that matches a predefined entry, serve that solution instantly without running a live solve. | Must | FEAT-019 |
| REQ-019 | When no predefined solution matches the requested spot, the system shall fall back to live solving. | Must | FEAT-019, FEAT-001 |
| REQ-020 | The system shall clearly indicate the source of a displayed result (predefined cache vs live solve) and the settings used to generate it. | Must | FEAT-019, FEAT-006 |
| REQ-021 | The system shall provide a practice/drill mode that presents a spot (from the predefined library or a saved solve), prompts the user to estimate the correct action/frequency, then reveals and scores the user's answer against the GTO solution. | Must | FEAT-012 |
| REQ-009 | The system shall persist spot configurations and completed solve results in browser-local storage (IndexedDB) and let the user list, load, and delete them. | Must | FEAT-007 |
| REQ-010 | The system shall warn the user before starting a solve whose estimated cost (memory/time) exceeds a safe threshold for in-browser execution. | Must | FEAT-001, FEAT-006 |
| REQ-011 | The system shall support a constrained class of heads-up postflop solves with a documented, enforced bound on tree size (sizes, streets, range size). | Should | FEAT-008, FEAT-009, FEAT-010 |
| REQ-012 | The user shall be able to define a bet-sizing tree from a limited set of allowed sizes. | Should | FEAT-009 |
| REQ-013 | The user shall be able to input a board (flop/turn/river) for postflop solves with validation (no duplicate cards, valid ranks/suits). | Should | FEAT-010 |
| REQ-014 | The app shall load and run from static hosting and, after first load, function without network connectivity. | Should | FEAT-011 |
| REQ-015 | (Superseded by REQ-021; practice mode promoted to Must.) The system shall provide a practice mode that presents a spot and asks the user to estimate an action frequency, then reveals the solved answer. | Must | FEAT-012 |
| REQ-016 | The system shall be usable on common desktop screen sizes; mobile/responsive support is best-effort. | Could | FEAT-013 |
| REQ-017 | The user shall be able to export a spot (and optionally its result) to a file and re-import it. | Could | FEAT-014 |
| REQ-022 | The system shall let the user configure a spot by: stack size (sub-10bb up to 1000bb, selected via stack buckets), number of players (2–9), game type (cash or tournament/ICM), hero position (valid for the chosen table size), and the prior action before hero (limps/bets/raises and their sizes — bet-context). | Must | FEAT-020 |
| REQ-023 | The system shall compute hero's decision for the configured position given the prior action (bet-context aware), and output the percentage frequency of each applicable hero action: RAISE (small/big/all-in), CALL, FOLD, 3-BET, 3-BET SHOVE, 4-BET SHOVE, 5-BET SHOVE. | Must | FEAT-021 |
| REQ-024 | The applicable action set shall depend on the bet-context (e.g. 4-BET SHOVE is only offered when hero faces a 3-bet), and the displayed frequencies shall sum to 100% over that applicable set within tolerance. | Must | FEAT-021 |
| REQ-025 | For heads-up (2-player) cash spots, the system shall deliver a Tier 1 LIVE solve with an exploitability estimate. | Must | FEAT-002, FEAT-024 |
| REQ-026 | For multiway (3–9 player) cash spots, the system shall serve a Tier 2 PRECOMPUTED chart when one matches, prioritizing 6-max then full-ring coverage ahead of tournament/ICM. | Must | FEAT-022, FEAT-024 |
| REQ-027 | For multiway/ICM spots with no matching chart, the system shall produce a Tier 3 LIVE ESTIMATE that is clearly labeled "Estimate (not exact GTO)" and shall NOT report an exploitability number. | Should | FEAT-025, FEAT-024 |
| REQ-028 | The system shall label every result with its trust tier and source (Tier 1 live solve / Tier 2 predefined chart / Tier 3 estimate) and shall NEVER label a multiway or ICM result as "exact GTO". | Must | FEAT-024 |
| REQ-029 | The system shall support deep stacks (200–1000bb) via abstraction and stack buckets (not full-resolution live solving), and shall display the active stack bucket and abstraction with the result. | Should | FEAT-023 |
| REQ-030 | For tournament/ICM spots, the system shall require the payout structure and all players' stacks as inputs and shall display the ICM assumptions used. (Delivery is a later phase — after cash multiway.) | Should (Future phase) | FEAT-026 |

---

## 9. Non-Functional Requirements

| ID | Requirement | Category | Priority |
|----|-------------|----------|----------|
| NFR-001 | Performance is BEST-EFFORT: the system shall solve as well as it can within reasonable in-browser time and memory. There is NO hard pass/fail latency SLA. The predefined cache (REQ-018) provides instant results for common spots; live solves should be as fast as practical but are not gated on a fixed time budget. | Performance | Must |
| NFR-011 | Predefined solutions shall be served correctly and not silently corrupted; the app shall validate predefined data integrity (e.g. version/format check) and clearly attribute results to the predefined source. | Correctness/Trust | Must |
| NFR-012 | The system shall enforce trust-tier honesty (Section 5A): multiway and ICM results shall never be presented as "exact GTO"; only Tier 1 HU live solves may report exploitability. This is a non-negotiable correctness/ethics requirement. | Correctness/Trust/Ethics | Must |
| NFR-013 | The trust tier and its assumptions shall be visible at the point of use (alongside the frequencies), not buried in a separate screen. | Trust/Usability | Must |
| NFR-002 | The UI shall remain responsive (no frozen main thread > 100ms) during solving. | Performance/Usability | Must |
| NFR-003 | The app shall detect and gracefully handle out-of-memory / oversized-solve conditions without crashing the tab where avoidable, and shall surface a clear error. | Reliability | Must |
| NFR-004 | The solver output shall be deterministic/reproducible given the same inputs and settings (or, if randomized, the seed shall be recorded). | Correctness/Trust | Must |
| NFR-005 | Solve quality shall be transparently reported (exploitability estimate) so users can judge trustworthiness. | Trust | Must |
| NFR-006 | All user data shall remain on the user's device; no data shall be transmitted to any server. | Privacy | Must |
| NFR-007 | Persisted data shall survive page reload and browser restart, subject to browser storage eviction policy, which the app shall communicate. | Reliability | Must |
| NFR-008 | The app shall present clear, jargon-aware UX with definitions/tooltips for GTO terms (equity, EV, exploitability, frequency). | Usability | Should |
| NFR-009 | The app shall degrade gracefully on browsers lacking required features (WASM, Web Workers, IndexedDB), showing a clear unsupported-browser message. | Reliability/Compatibility | Should |
| NFR-010 | Where multi-threaded WASM is used, the hosting shall meet cross-origin isolation requirements (COOP/COEP); if unavailable, fall back to single-thread. | Performance/Compatibility | Should |

---

## 10. Business / Domain Rules

| ID | Rule | Notes |
|----|------|-------|
| BR-001 | Ranges are expressed over the 169 canonical starting-hand classes (13x13 matrix: pairs on diagonal, suited upper-right, offsuit lower-right). | Standard NLHE convention. |
| BR-002 | A board may not contain duplicate cards, and board cards may not conflict with locked/forced cards in either range. | Card-uniqueness invariant. |
| BR-003 | Action frequencies for a given hand at a given node must sum to 100% (within tolerance). | Strategy validity. |
| BR-004 | Equity and EV are reported in consistent, displayed units (equity in %, EV in chips/bb of pot — unit shown in UI). | Trust/clarity. |
| BR-005 | Reported exploitability is an estimate at the current iteration count; the app must label it as such (not "exact GTO"). | Honesty about convergence. |
| BR-006 | Solves exceeding the configured tractability bound must be blocked or explicitly warned before running. | Protects device + UX. |
| BR-007 | Every displayed result must be attributed to its source: "Predefined" (from the bundled cache) or "Live solve". Predefined results must show the settings/abstraction used to generate them. | Trust/clarity. |
| BR-008 | Predefined lookup must only return a result for a spot that genuinely matches the predefined entry's parameters; on no exact match, fall back to live solving (Tier 1) or a labeled estimate (Tier 3) rather than returning an approximate predefined answer unlabeled. | Correctness/trust. |
| BR-009 | Hero's output action frequencies must sum to 100% (within tolerance) over the action set applicable to the current bet-context. The applicable set is determined by the prior action (e.g. facing no raise: raise/call(limp)/fold; facing a raise: 3-bet / 3-bet shove / call / fold; facing a 3-bet: 4-bet shove / call / fold; facing a 4-bet: 5-bet shove / call / fold). | Strategy validity / bet-context. |
| BR-010 | Multiway (3–9) and tournament/ICM results must NEVER be labeled "exact GTO", "GTO solution", or "solved" without an explicit estimate/approximation/predefined-chart qualifier. Only HU (2-player) live solves may be presented as solves (still subject to BR-005 convergence labeling). | Honesty / trust tiering (Section 5A). |
| BR-011 | Exploitability must only be reported for Tier 1 HU solves. Multiway/ICM results must not display an exploitability number (it is undefined for general-sum games); any confidence indicator shown there must be honestly named (not "exploitability"). | Honesty about general-sum games. |
| BR-012 | Tournament/ICM computations must state the payout structure and the stack distribution assumed; changing either may change the recommendation, so these assumptions must be shown with the result. | ICM model validity. |
| BR-013 | Stack depth is handled via discrete buckets; a result must show which stack bucket and abstraction it represents, since it may not be the user's exact stack. | Deep-stack abstraction honesty. |

---

## 11. Key User Flows

### Flow 1 — Get a preflop decision for a configured spot (primary, Must)
1. User opens app (static load, no login).
2. User configures the spot: **number of players (2–9), game type (cash / tournament-ICM), stack size (bucketed, sub-10bb–1000bb), hero position (valid for the table size), and the prior action before hero** (limps/bets/raises and sizes — bet-context). For tournament/ICM, the user also provides the payout structure and all players' stacks.
3. The app determines the **trust tier** from the configuration:
   - 2 players, cash -> **Tier 1 (live solve)**.
   - 3–9 players, cash -> **Tier 2 chart** if a match exists, else **Tier 3 estimate**.
   - tournament/ICM -> Tier 2 chart if available (later phase), else **Tier 3 estimate** (or "not yet covered" notice).
4. The app resolves the result:
   - Tier 1: serve from cache if available (labeled "Predefined"), else run a live solve in a Web Worker (progress + iterations; labeled "Live solve") with an exploitability estimate.
   - Tier 2: serve the precomputed chart instantly, labeled "Predefined chart"; NO "exact GTO" wording.
   - Tier 3: run an approximate live computation, labeled "Estimate (not exact GTO)"; NO exploitability number.
5. App shows the **per-action frequencies** (RAISE small/big/all-in, CALL, FOLD, 3-BET, 3-BET SHOVE, 4-BET SHOVE, 5-BET SHOVE — applicable subset), the **trust tier/source**, the inputs/assumptions used (incl. stack bucket; for ICM, payout + stacks), and exploitability only for Tier 1.
6. User saves the spot + result to local storage.

### Flow 1b — Practice / drill (Must)
1. User opens Practice mode.
2. App selects a spot (from the predefined library or the user's saved solves).
3. App presents the spot and asks the user to estimate the correct action/frequency for a hand.
4. User submits an estimate.
5. App reveals the GTO solution, scores the user's answer (difference/accuracy), and lets them continue to the next spot.

### Flow 2 — Solve a constrained postflop spot (Should)
1. From a preflop spot or fresh, user enters a postflop configuration.
2. User inputs the board (flop/turn/river as applicable) — validated.
3. User selects a bet-sizing tree from allowed sizes.
4. App estimates tree size/cost; warns if over bound.
5. User confirms; solver runs in worker with abstraction applied.
6. Results displayed as in Flow 1, plus board-aware context.

### Flow 3 — Manage saved work (Must)
1. User opens "Saved" view.
2. App lists saved spots/results from IndexedDB.
3. User loads, renames, or deletes an item.
4. App communicates storage usage and eviction risk.

> (Former "Flow 4 — Minimal practice" is now the in-scope Flow 1b above.)

---

## 12. Edge Cases

| ID | Edge Case | Expected Behavior |
|----|-----------|-------------------|
| EDGE-001 | User requests a solve exceeding device memory/tractability bound. | Block or warn with explanation before running (REQ-010, BR-006). |
| EDGE-002 | Browser lacks WASM/Web Workers/IndexedDB. | Show clear unsupported-browser message (NFR-009). |
| EDGE-003 | Solve is interrupted (tab backgrounded, user stops, OOM). | Preserve best strategy so far where possible; report partial/estimate; never silently show stale data as final. |
| EDGE-004 | IndexedDB storage full or evicted by browser. | Surface a clear error; warn about eviction policy (NFR-007). |
| EDGE-005 | Invalid range/board input (duplicate cards, empty range). | Validation error; block solve until corrected (BR-002). |
| EDGE-006 | Non-converged solve presented to user. | Label clearly as not fully converged with current exploitability (BR-005). |
| EDGE-007 | Very long solve on a slow device. | Show progress + estimated time; allow stop; suggest reducing tree/abstraction. |
| EDGE-008 | Reopening a saved result whose app/solver version changed. | Detect version mismatch; warn results may not match current engine; allow re-solve. |
| EDGE-009 | Requested spot has no matching predefined entry. | Fall back to live solving; label result "Live solve" (BR-008). |
| EDGE-010 | Predefined library data is missing/corrupt/version-mismatched. | Validate on load; if invalid, disable cache and fall back to live solving with a clear notice (NFR-011). |
| EDGE-011 | Predefined entry exists but its generation settings differ from what the user expects. | Display the predefined entry's settings/abstraction so the user can see how it was produced (BR-007). |
| EDGE-012 | User configures a multiway/ICM spot and (mis)reads the result as exact GTO. | UI must label it Tier 2/3 "chart"/"estimate", never "exact GTO" (BR-010, NFR-012); no exploitability shown (BR-011). |
| EDGE-013 | User requests a multiway/ICM spot with no matching chart and no Tier 3 estimate available yet (e.g. tournament/ICM before its phase). | Show a clear "not yet covered" notice; do not fabricate a result or mislabel a HU/cash answer as applicable. |
| EDGE-014 | Hero position is invalid for the chosen table size (e.g. UTG+2 at a 3-handed table). | Validation error; only offer positions valid for the selected player count. |
| EDGE-015 | Prior-action / bet-context implies an action set that excludes a taxonomy action (e.g. no 4-bet shove when hero has not faced a 3-bet). | Only display/allow the applicable action subset; frequencies sum over that subset (BR-009). |
| EDGE-016 | User's exact stack falls between stack buckets. | Map to the nearest/applicable bucket and clearly show which bucket the result represents (BR-013). |
| EDGE-017 | Tournament/ICM spot submitted without payout structure or without all players' stacks. | Block/validate: ICM requires payout structure + all stacks (BR-012); prompt for the missing inputs. |
| EDGE-018 | Deep stack (e.g. 1000bb) requested where only abstracted buckets exist. | Serve the abstracted bucket result, labeled as abstraction-based, not full-resolution (BR-013, RISK-015). |

---

## 13. Assumptions

| ID | Assumption | Impact | Needs Validation |
|----|------------|--------|------------------|
| ASM-001 | A CFR variant compiled to WASM can solve HU preflop spots to acceptable quality within an acceptable time in-browser on a typical modern laptop. | Core feasibility of MVP. | Yes (spike/prototype) |
| ASM-002 | A meaningfully useful subset of HU postflop spots can be solved in-browser within tractability bounds and acceptable accuracy using abstraction. | Determines FEAT-008 viability. | Yes (spike) |
| ASM-003 | The single user accepts best-effort, transparently-labeled solves (and predefined-cache answers) vs desktop-solver precision, in exchange for zero-install/zero-backend/zero-cost. | Fit of the trade-off for the personal user. | Confirmed by stakeholder (personal-use) |
| ASM-004 | IndexedDB capacity plus the bundled predefined library fit within browser/device limits for a single user's spots and results. | Persistence + bundle-size design. | Yes |
| ASM-005 | Static hosting can be configured for cross-origin isolation (COOP/COEP) to enable multi-threaded WASM if needed. | Performance ceiling. | Yes |
| ASM-006 | Desktop-first is acceptable for the personal user. | UX scope. | Yes |
| ASM-007 | RESOLVED: Accounts, billing, sync, and any server-hosted library are OUT of scope by intent (personal-use, no backend). No CON-2/CON-3 tension remains. | Scope clarity. | Resolved (stakeholder) |
| ASM-008 | RESOLVED: No monetization of any kind. | Business model. | Resolved (stakeholder) |
| ASM-009 | RESOLVED for now: legal/ToS review is not required for a personal-use study tool. Revisit only if the product is ever distributed publicly. | Legal posture. | Resolved/deferred (stakeholder) |
| ASM-010 | A useful set of common spots can be precomputed offline and bundled as static assets at acceptable bundle size, and matched to user requests at runtime. | Viability of the predefined cache (FEAT-019). | Yes (prototype) |
| ASM-011 | Precomputed solutions can be generated to acceptable quality by an offline/build-time process (which may use a more capable solver than the in-browser engine). | Quality of cached answers. | Yes |
| ASM-012 | A useful set of multiway (3–9) cash preflop charts can be precomputed offline (via an accepted approximate-equilibrium method) and bundled at acceptable size, with each entry honestly labeled as a chart/estimate. | Viability of Tier 2 (FEAT-022). | Yes (prototype + method choice) |
| ASM-013 | The discretization (stack buckets, bet-context branches, position set) is granular enough to be useful while keeping the bundled chart set and live solves tractable. | Tractability vs usefulness of the config model (FEAT-020). | Yes |
| ASM-014 | The user accepts that multiway/ICM outputs are explicitly estimates/charts (not exact GTO) and that exploitability is only meaningful for HU. | Fit of the honesty trade-off; expectation gap (RISK-018). | Confirmed by stakeholder (Option 1, 2026-06-25) |
| ASM-015 | An ICM (or comparable) model is an acceptable basis for tournament results, given payout structure + all players' stacks, and its assumptions can be shown to the user. | Validity basis for Tier 2/3 ICM (FEAT-026). | Yes (model choice; later phase) |
| ASM-016 | Deep stacks (200–1000bb) can be handled to acceptable usefulness via abstraction + stack buckets rather than full-resolution solving. | Viability of FEAT-023. | Yes (spike) |

---

## 14. Dependencies

| ID | Dependency | Type | Notes |
|----|------------|------|-------|
| DEP-001 | A CFR solver implementation compilable to WASM (Rust/C++/AssemblyScript — Architect decision). | Technical | Core of CON-1. |
| DEP-002 | Browser platform features: WASM, Web Workers, IndexedDB; optionally SharedArrayBuffer/SIMD. | Platform | Determines compatibility matrix. |
| DEP-003 | Static hosting provider supporting COOP/COEP headers. | Infrastructure | For multi-threaded WASM. |
| DEP-004 | Frontend SPA framework + visualization tooling (Architect decision). | Technical | For grids/charts. |
| DEP-005 | Equity/combinatorics computation (may be part of solver or separate lib). | Technical | For equity display. |

---

## 15. Open Questions

| ID | Question | Owner | Status |
|----|----------|-------|--------|
| Q-001 | What exact tractability bound (streets, # sizes, range size, target iterations) defines an acceptable in-browser live solve? | Architect + PO | Open |
| Q-002 | RESOLVED: Performance is best-effort; no hard solve-time/exploitability SLA. Cache provides instant common-spot answers. (See NFR-001.) | Stakeholder | Resolved |
| Q-003 | Is multi-threaded WASM (and the COOP/COEP hosting requirement) in scope for MVP, or single-thread MVP first? | Architect | Open |
| Q-004 | RESOLVED: No monetization (ASM-008). | Stakeholder | Resolved |
| Q-005 | RESOLVED: Personal-use tool; no accounts/sync/server-library; competitor scope is future-only (ASM-007, CON-3 revised). | Stakeholder | Resolved |
| Q-006 | RESOLVED: Practice/drill mode IS in MVP (FEAT-012, now Must). | Stakeholder | Resolved |
| Q-007 | Which browsers/devices form the support matrix? (Lower stakes now — single personal user; likely just the user's own browser.) | User + Architect | Open |
| Q-008 | RESOLVED/DEFERRED: Legal/ToS review not needed for personal use (ASM-009). Revisit only if publicly distributed. | Stakeholder | Resolved |
| Q-009 | What is the product/brand name? (Low priority for personal use.) | User | Open |
| Q-010 | What is the initial coverage list for the predefined solution library (which preflop spots, which postflop spots), and how are predefined entries matched to user requests? | User + Architect | Open |
| Q-011 | NEW (top product question): For the FIRST multiway cash chart generation slice, which exact combinations to generate first — which player counts (6-max only, or also full-ring?), which stack buckets/depths, which hero positions, and which prior-action/bet-context branches (e.g. RFI, vs-single-raise, vs-3-bet)? | User + Architect | Open |
| Q-012 | NEW: What is the stack-bucket scheme across sub-10bb to 1000bb (bucket boundaries, count), and where does the sub-10bb push/fold regime switch on? | User + Architect | Open |
| Q-013 | NEW: Which approximate-equilibrium method is acceptable for generating multiway cash charts (and later ICM), and how is its quality judged given exploitability is undefined? | Architect + PO | Open |
| Q-014 | NEW: What raise-size definitions back the taxonomy buckets (what counts as "small" vs "big" raise; min-raise vs all-in thresholds) across stack depths? | User + Architect | Open |
| Q-015 | NEW (ICM phase): Which ICM/payout model, and what payout structures should ship first? | User + Architect | Open (later phase) |

---

## 16. Product Risks (summary — full detail in RISKS.md)

| ID | Risk | Impact | Likelihood | Mitigation (summary) |
|----|------|--------|------------|----------------------|
| RISK-001 | In-browser live postflop solving may be too slow/memory-heavy to be useful. | High | High | Predefined cache for common spots (primary mitigation); constrain live-solve scope; best-effort perf; feasibility spike. |
| RISK-002 | (DOWNGRADED) Scope-vs-backend tension. | Low | Low | RESOLVED by personal-use positioning; no backend features in scope. Retained for traceability. |
| RISK-003 | Browser memory/storage limits cap solve size, saved data, and bundled library size. | High | Medium | Tractability bounds, warnings, storage management, bundle-size discipline. |
| RISK-004 | Solver/cache correctness/trust — wrong output undermines the tool. | High | Medium | Validation vs reference solver; show exploitability + result source; transparency. |
| RISK-014 | Predefined cache quality/coverage/staleness or mismatched lookups. | Medium | Medium | Strict match rules + live fallback (BR-008); show source/settings; integrity checks. |
| RISK-015 | NEW: Combinatorial blow-up at deep stacks / high player counts (config space explosion across stack x players x position x bet-context). | High | High | Stack buckets + abstraction (FEAT-023); precomputed charts not live solves for multiway; scope coverage (Q-011/Q-012); deep stacks not full-resolution. |
| RISK-016 | NEW: Multiway non-zero-sum correctness/trust — general-sum has no unique equilibrium; exploitability undefined; "solve" could mislead. | High | High | Never claim exact GTO (BR-010/011, NFR-012); deliver as labeled charts/estimates (Tier 2/3); show assumptions; no exploitability for multiway. |
| RISK-017 | NEW: ICM model validity — chip-EV replaced by payout-dependent utility; wrong model/inputs => wrong advice. | High | Medium | Require payout + all stacks (BR-012); show ICM assumptions; ship ICM only after cash multiway; validate model choice (Q-013/Q-015). |
| RISK-018 | NEW: User-expectation gap — stakeholder may expect full-fidelity exact multiway GTO despite Option 1. | Medium | High | Explicit tiering + labeling everywhere (Section 5A, NFR-012/013); Option 1 recorded as approved; honest UX/docs. |
| RISK-008 | (DEFERRED) Legal/ToS. | Low | Low | RESOLVED/deferred for personal use; revisit only if distributed. |

See `RISKS.md` for the full register (likelihood, impact, mitigation, owner).

---

## 17. Success Metrics / KPIs

> This is a personal-use tool, so success is measured by the owner's own usefulness and trust, not market/commercial metrics. Competitor and growth KPIs are dropped. Measurement is qualitative/self-assessed (no analytics backend).

- M1 (Feasibility): The in-browser engine produces a usable preflop HU solve in reasonable time, and the predefined cache returns common-spot answers instantly. (No fixed latency SLA — best-effort.)
- M2 (Trust): Live-solve and predefined output validated within tolerance against a reference solver on a benchmark set of spots.
- M3 (Coverage): The predefined library covers the common spots the user actually studies — including the first multiway cash chart slice (target coverage list per Q-010/Q-011).
- M8 (Honesty/trust tiering): Every result is correctly labeled by tier; no multiway/ICM result is ever shown as "exact GTO"; exploitability appears only for HU (Section 5A, NFR-012).
- M9 (Config coverage): The user can configure and get a sensible result across the supported axes (players 2–9 within tier rules, stack buckets, cash; ICM later) with the correct per-action frequency taxonomy.
- M4 (Usefulness — qualitative): The owner reports the tool answers their study questions quickly and is worth using over alternatives.
- M5 (Practice value — qualitative): The owner finds the practice/drill mode useful for improving recall.
- M6 (Reliability): Crashes/OOM during normal personal use are rare; over-budget solves are handled gracefully.
- M7 (Data safety): The owner's saved work persists reliably across sessions (with export as backup).

---

## 18. High-Level Milestones

| Milestone | Description | Key Deliverables / Gates |
|-----------|-------------|--------------------------|
| M0 — Feasibility Spike | Prove in-browser CFR solve is viable AND prove the predefined-cache approach (offline gen + bundle + match). | WASM CFR prototype; sample predefined entries served + matched; perf/memory/bundle data; go/no-go (validates ASM-001, ASM-010/011). |
| M0b — Multiway/Config Feasibility Spike (NEW) | Prove the config model + chart pipeline: stack-bucket scheme, multiway cash chart generation method, bet-context action sets, and tier labeling. | Sample 6-max cash charts generated + bundled + matched; config UI prototype (players/stack/position/prior-action); taxonomy frequencies; tier labels; validates ASM-012/013/016, Q-011/012/013/014. |
| M1 — HU Tier 1 Preflop (config-aware) | Usable HU preflop live solver with config model + cache + taxonomy output + tier labeling. | FEAT-001–007, FEAT-019, FEAT-020, FEAT-021, FEAT-024; per-action frequencies; exploitability (HU only); source/tier labeling. |
| M2 — Multiway Cash Charts (Tier 2, cash-first) | Bundled multiway cash charts, 6-max then full-ring, with honest labeling. | FEAT-022, FEAT-024; chart lookup/match; "Predefined chart" labeling; no "exact GTO"; deep-stack buckets (FEAT-023) as scoped. |
| M2b — Practice + Constrained Postflop | Practice/drill mode and bounded HU postflop. | FEAT-012 (practice), FEAT-008–010; abstraction; cost warnings; board input. |
| M3 — Tier 3 Estimate + Polish & Offline | Labeled live multiway estimate, UX hardening. | FEAT-025 (labeled estimate); FEAT-011 (offline); tooltips (NFR-008); error handling. |
| M4 — Tournament / ICM (later phase) | ICM charts/estimates AFTER cash multiway. | FEAT-026; payout structure + all-stacks inputs; ICM assumptions shown (BR-012); Q-015. |
| M5 — Optional Extras | Stretch items. | FEAT-014 export, FEAT-013 responsive (as prioritized). |
| Future | Possible later direction. | Expanded chart coverage/training; or (only if re-scoped) a backend toward a multi-user product. |

---

## 19. Acceptance Summary

The expanded product is acceptable when: the user can, with no install and no account, (1) **configure a preflop spot** by players (2–9), game type (cash; ICM later), stack bucket (sub-10bb–1000bb), hero position, and prior action (bet-context); (2) get a result with the correct **per-action frequency taxonomy** (raise small/big/all-in, call, fold, 3-bet, 3-bet shove, 4-bet shove, 5-bet shove), delivered honestly per tier — **HU as a live solve with exploitability (Tier 1)**, **multiway cash as a labeled precomputed chart (Tier 2)** or **labeled estimate (Tier 3)**, with **multiway/ICM never shown as "exact GTO"**; (3) drill spots in a practice mode that scores answers; and (4) save/reload that work locally — all from static hosting with no backend, with transparent handling of over-budget solves and clearly-shown assumptions (stack bucket; for ICM, payout + stacks).

See `ACCEPTANCE_CRITERIA.md` for testable criteria per story.

---

## 20. Handoff Notes

- **To Software Architect:** CON-1/CON-2 are hard constraints; CON-3 is "personal-use, high-quality". The 2026-06-25 expansion adds a configurable spot model (FEAT-020) and a tiered delivery (Section 5A). Key decisions you own now also include: the **stack-bucket scheme** (Q-012), the **multiway cash chart generation method** and how its quality is judged when exploitability is undefined (Q-013), **raise-size taxonomy thresholds** (Q-014), the **bet-context / action-set model** (BR-009), **deep-stack abstraction** (FEAT-023), and the **ICM model** for the later phase (Q-015). Multiway is delivered as precomputed charts (Tier 2) / labeled estimate (Tier 3), NOT exact-GTO live solves — enforce this in the data model and APIs. Cash multiway is prioritized before tournament/ICM.
- **To SDET Lead:** New highest-value focus: **trust-tier labeling correctness** — multiway/ICM must NEVER render as "exact GTO" and must NEVER show exploitability (NFR-012, BR-010/011, AC-031/AC-032); **per-action frequency taxonomy** correctness incl. bet-context-dependent action sets summing to 100% (BR-009, AC-028/AC-029); **config validation** (valid positions per table size, ICM input completeness, stack-bucket mapping — EDGE-014/016/017); plus all prior cache/solve/persistence focus. Criteria in `ACCEPTANCE_CRITERIA.md`.
- **To Delivery Manager:** Two go/no-go gates now: M0 (HU CFR + cache) and M0b (config model + multiway chart pipeline + tiering). Cash-multiway-first sequencing is approved; tournament/ICM is a later phase. New open items: Q-011 (initial multiway chart coverage — TOP question), Q-012 (stack buckets), Q-013 (chart method), Q-014 (raise-size thresholds), Q-015 (ICM model). Prior open items Q-001/Q-003/Q-007/Q-009/Q-010 remain.
- **To Documentation Engineer:** Beyond GTO concept explanations (NFR-008) and "Predefined vs Live" labeling, the docs/UX must clearly explain the **three trust tiers** and the honesty rule that multiway/ICM are estimates/charts, never "exact GTO" (Section 5A, NFR-012/013). Explain why (zero-sum vs general-sum; ICM). Keep proportionate for personal use.

---

## 21. Revision Note — Stakeholder Scope Answers (relayed via coordinator)

This revision incorporates the following answers, relayed via the coordinator and attributed to the stakeholder. They are treated as product direction and locked into scope above, but because they were relayed (not stated directly by the user), this PRD remains a DRAFT pending the user's own confirmation.

1. Personal-use, single user. No accounts, billing, sync, or server-hosted library. Competitor-scale positioning dropped (future-only). CON-3 revised; CON-2/CON-3 tension resolved. (ASM-007, Q-005)
2. No monetization. (ASM-008, Q-004)
3. Performance is best-effort; no hard latency SLA (NFR-001, Q-002). Added a first-class predefined/precomputed solution cache (FEAT-019, REQ-018–020) for instant common-spot answers with live-solve fallback; this is now the primary mitigation for in-browser postflop cost (RISK-001).
4. Legal/ToS review not needed for personal use; deferred (ASM-009, Q-008).
5. Practice/drill mode promoted into the MVP as a Must (FEAT-012, REQ-021).

---

## 22. Revision Note — Major Scope Expansion (APPROVED 2026-06-25)

The stakeholder APPROVED expanding the product into a general, configurable PREFLOP decision tool. This is locked into scope above. Summary of what was approved:

1. **Configuration axes** (FEAT-020, REQ-022): stack size (sub-10bb–1000bb, via buckets), number of players (2–9), game type (cash vs tournament/ICM), hero position (by table size), and prior action before hero (bet-context aware).
2. **Per-action frequency output taxonomy** (FEAT-021, REQ-023/024, BR-009): RAISE (small/big/all-in), CALL, FOLD, 3-BET, 3-BET SHOVE, 4-BET SHOVE, 5-BET SHOVE — applicable subset by bet-context.
3. **"Option 1" trust tiering (honesty requirement)** (Section 5A, FEAT-024, NFR-012/013, BR-010/011): HU = trustworthy LIVE solve with exploitability (Tier 1); multiway (3–9) and tournament/ICM = PRECOMPUTED CHARTS (Tier 2) or clearly-labeled LIVE ESTIMATE (Tier 3), explicitly NOT exact-GTO live solves. Multiway is general-sum (no unique equilibrium; exploitability undefined), so this is mandatory honesty, not a limitation to hide.
4. **"Cash multiway first"** (FEAT-022 before FEAT-026): cash 6-max/full-ring charts prioritized ahead of tournament/ICM.
5. **Deep stacks via abstraction + stack buckets** (FEAT-023, REQ-029), not full-resolution live solving.
6. **Tournament/ICM** (FEAT-026, REQ-030, BR-012): later phase; requires payout structure + all players' stacks as inputs; chip-EV replaced by an ICM utility model.
7. NG4 RESCOPED: multiway preflop moves from blanket non-goal to a scoped, tiered capability; exact-GTO live multiway and multiway postflop remain out of scope.

### Approval Gates (this expansion)

| Gate | Decision | Status |
|------|----------|--------|
| GATE-EXP-1 | Adopt configurable preflop tool with the stated axes + taxonomy output | APPROVED (2026-06-25) |
| GATE-EXP-2 | "Option 1": HU live solve; multiway/ICM as charts/labeled estimate, never exact GTO (trust tiering) | APPROVED (2026-06-25) |
| GATE-EXP-3 | "Cash multiway first" sequencing (cash 6-max/full-ring before tournament/ICM) | APPROVED (2026-06-25) |
| GATE-EXP-4 | Deep stacks via abstraction + stack buckets (not full-resolution) | APPROVED (2026-06-25) |
| GATE-EXP-5 | Initial multiway cash chart coverage list (player counts / stack depths / positions / bet-context branches) | OPEN — Q-011 (needs stakeholder input before M2 chart generation) |

---

> REMINDER: The 2026-06-24 personal-use answers (Section 21) were coordinator-relayed. The 2026-06-25 scope-expansion decisions (Section 22, including Option 1 and cash-first) are recorded as APPROVED by the stakeholder. Remaining product input needed: the initial multiway chart coverage list (Q-011) and the supporting discretization questions (Q-012–Q-015).
