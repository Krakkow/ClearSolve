# User Stories — Personal Browser-Native NLHE Preflop Decision Tool & GTO Solver

> STATUS: APPROVED by stakeholder (2026-06-24); MAJOR SCOPE EXPANSION APPROVED (2026-06-25)
> Owner: Product Owner Agent
> Last Updated: 2026-06-26
> Cross-references: features (FEAT-*) and requirements (REQ-*) defined in `PRD.md`; acceptance criteria (AC-*) in `ACCEPTANCE_CRITERIA.md`.
> Revision (2026-06-24): Reframed for personal-use (single user). Added a predefined-cache epic (US-024/US-025/US-026); promoted and expanded the practice/drill mode (US-021, US-027).
> Revision (2026-06-25 scope expansion): Added Epic E9 (Configurable Spot & Tiered Decision) with US-028..US-035 covering spot configuration (stack/players/game-type/position/prior-action), the per-action frequency taxonomy output, HU live solve (Tier 1), multiway cash charts (Tier 2), labeled multiway estimate (Tier 3), deep-stack buckets, and tournament/ICM (later phase). See PRD Sections 5A and 22.
> Throughout, "user" = the single owner of this personal-use tool.

---

## Story Index

| Story ID | Epic | Title | Priority | Status |
|----------|------|-------|----------|--------|
| US-001 | E1 Solver Engine | Run a real in-browser solve (novel spots) | Must | Draft |
| US-002 | E1 Solver Engine | Keep UI responsive during solve | Must | Draft |
| US-003 | E1 Solver Engine | See solve progress and iterations | Must | Draft |
| US-004 | E1 Solver Engine | Stop a running solve | Must | Draft |
| US-005 | E1 Solver Engine | Be warned before an over-budget solve | Must | Draft |
| US-024 | E8 Predefined Cache | Get instant answers for common spots | Must | Draft |
| US-025 | E8 Predefined Cache | Fall back to live solving on cache miss | Must | Draft |
| US-026 | E8 Predefined Cache | See whether a result is predefined or live | Must | Draft |
| US-006 | E2 Spot Config | Configure a preflop HU spot | Must | Draft |
| US-007 | E2 Spot Config | Edit a range in a 13x13 grid | Must | Draft |
| US-008 | E2 Spot Config | Configure a bet-sizing tree | Should | Draft |
| US-009 | E2 Spot Config | Input and validate a board | Should | Draft |
| US-010 | E3 Results & Insight | View the strategy grid | Must | Draft |
| US-011 | E3 Results & Insight | View EV and equity | Must | Draft |
| US-012 | E3 Results & Insight | See solve quality / exploitability | Must | Draft |
| US-013 | E3 Results & Insight | Understand GTO terms in-context | Should | Draft |
| US-014 | E4 Postflop | Solve a constrained postflop spot | Should | Draft |
| US-015 | E5 Persistence | Save a spot and its result locally | Must | Draft |
| US-016 | E5 Persistence | Load, rename, delete saved work | Must | Draft |
| US-017 | E5 Persistence | Understand local storage limits/eviction | Must | Draft |
| US-018 | E6 Platform | Use the app with no install and no account | Must | Draft |
| US-019 | E6 Platform | Be told clearly if my browser is unsupported | Should | Draft |
| US-020 | E6 Platform | Use the app offline after first load | Should | Draft |
| US-021 | E7 Practice | Drill a spot and get scored vs the solution | Must | Draft |
| US-027 | E7 Practice | Practice from predefined or saved spots | Must | Draft |
| US-022 | E5 Persistence | Export/import a spot as a file | Could | Draft |
| US-028 | E9 Configurable Spot & Tiered Decision | Configure stack, players, game type, position | Must | Draft |
| US-029 | E9 Configurable Spot & Tiered Decision | Specify the prior action (bet-context) | Must | Draft |
| US-030 | E9 Configurable Spot & Tiered Decision | Get per-action frequency output (full taxonomy) | Must | Draft |
| US-031 | E9 Configurable Spot & Tiered Decision | Get a trustworthy HU live solve (Tier 1) | Must | Draft |
| US-032 | E9 Configurable Spot & Tiered Decision | Get multiway cash charts (Tier 2, labeled) | Must | Draft |
| US-033 | E9 Configurable Spot & Tiered Decision | Get a labeled multiway/ICM estimate (Tier 3) | Should | Draft |
| US-034 | E9 Configurable Spot & Tiered Decision | See the trust tier and never see multiway as "exact GTO" | Must | Draft |
| US-035 | E9 Configurable Spot & Tiered Decision | Get deep-stack (200–1000bb) guidance via buckets | Should | Draft |
| US-036 | E9 Configurable Spot & Tiered Decision | Get tournament/ICM guidance (later phase) | Won't (this slice)/Future | Draft |

---

## Epic E1 — Solver Engine (CON-1)

### US-001: Run a real in-browser solve (novel spots)
**User Story**
As the user,
I want the app to actually compute a GTO strategy on demand in my browser when no predefined answer exists,
So that I get real solver output for custom/novel spots, not just lookups.

- Priority: Must
- Linked: FEAT-001, REQ-001, REQ-019
- Acceptance Criteria: AC-001, AC-002
- Notes: Engine is WASM/CFR (Architect chooses variant). Core capability (CON-1). Used as fallback when the predefined cache (US-024) misses.
- Dependencies: DEP-001, DEP-002
- Risks: RISK-001, RISK-004

### US-002: Keep the UI responsive during a solve
**User Story**
As a user,
I want the interface to stay responsive while a solve runs,
So that I can navigate and stop it without the tab freezing.

- Priority: Must
- Linked: FEAT-001, REQ-002, NFR-002
- Acceptance Criteria: AC-003
- Notes: Implies Web Worker execution.
- Dependencies: DEP-002

### US-003: See solve progress and iteration count
**User Story**
As a user,
I want to see live progress and iteration count during a solve,
So that I know it is working and roughly how far along it is.

- Priority: Must
- Linked: FEAT-006, REQ-007
- Acceptance Criteria: AC-004

### US-004: Stop a running solve
**User Story**
As a user,
I want to stop a solve in progress,
So that I can abandon a long-running or mistaken solve and keep partial results where available.

- Priority: Must
- Linked: FEAT-006, REQ-007
- Acceptance Criteria: AC-005
- Notes: On stop, show best-so-far strategy clearly labeled as not fully converged (EDGE-003, EDGE-006).

### US-005: Be warned before an over-budget solve
**User Story**
As a user on a normal laptop,
I want to be warned before starting a solve that is too large for my device,
So that I do not crash my tab or wait indefinitely.

- Priority: Must
- Linked: FEAT-001, FEAT-006, REQ-010, BR-006
- Acceptance Criteria: AC-006
- Risks: RISK-001, RISK-003

---

## Epic E8 — Predefined Solution Cache (FEAT-019)

### US-024: Get instant answers for common spots
**User Story**
As the user,
I want common spots to be answered instantly from a bundled predefined solution library,
So that I do not have to wait for a live solve for routine, frequently-studied situations.

- Priority: Must
- Linked: FEAT-019, REQ-018, BR-008
- Acceptance Criteria: AC-024
- Notes: Library ships as static assets (no backend). Coverage list per PRD Q-010.
- Dependencies: ASM-010, ASM-011
- Risks: RISK-014

### US-025: Fall back to live solving on cache miss
**User Story**
As the user,
I want the app to automatically run a live solve when no predefined answer matches my spot,
So that I always get an answer for novel spots without manual switching.

- Priority: Must
- Linked: FEAT-019, FEAT-001, REQ-019, BR-008
- Acceptance Criteria: AC-025
- Edge: EDGE-009, EDGE-010
- Dependencies: US-001

### US-026: See whether a result is predefined or live
**User Story**
As the user,
I want each result clearly labeled as coming from the predefined cache or a live solve (with the settings used),
So that I can trust and interpret the output correctly.

- Priority: Must
- Linked: FEAT-019, REQ-020, BR-007, NFR-011
- Acceptance Criteria: AC-026
- Risks: RISK-014, RISK-004

---

## Epic E2 — Spot Configuration

### US-006: Configure a preflop HU spot
**User Story**
As a poker student,
I want to set the effective stacks, both positions, and starting ranges for a heads-up preflop spot,
So that I can solve the situation I actually care about.

- Priority: Must
- Linked: FEAT-002, REQ-003
- Acceptance Criteria: AC-007
- Dependencies: US-007

### US-007: Edit a range in a 13x13 grid
**User Story**
As a poker student,
I want to build and weight a range using a 13x13 hand matrix,
So that I can express exactly which hands (and at what frequency) a player holds.

- Priority: Must
- Linked: FEAT-003, REQ-004, BR-001
- Acceptance Criteria: AC-008
- Notes: 169 canonical classes; weights 0–100%.

### US-008: Configure a bet-sizing tree
**User Story**
As an advanced user,
I want to choose the bet sizes available in the game tree from an allowed set,
So that the solve reflects realistic action options without exploding the tree.

- Priority: Should
- Linked: FEAT-009, REQ-012
- Acceptance Criteria: AC-009
- Notes: Limited fixed set in MVP for tractability.

### US-009: Input and validate a board
**User Story**
As a user solving postflop,
I want to enter the board cards with validation,
So that my postflop solve uses a correct, conflict-free runout.

- Priority: Should
- Linked: FEAT-010, REQ-013, BR-002
- Acceptance Criteria: AC-010

---

## Epic E3 — Results & Insight

### US-010: View the strategy grid
**User Story**
As a poker student,
I want to see the solved strategy as a colored 13x13 grid with per-hand action frequencies,
So that I can read the recommended play at a glance.

- Priority: Must
- Linked: FEAT-004, REQ-005, BR-003
- Acceptance Criteria: AC-011

### US-011: View EV and equity
**User Story**
As a poker student,
I want to see EV per action/hand and range-vs-range equity,
So that I understand the value behind each decision.

- Priority: Must
- Linked: FEAT-005, REQ-006, BR-004
- Acceptance Criteria: AC-012

### US-012: See solve quality / exploitability
**User Story**
As a discerning user,
I want to see how converged the solve is (exploitability estimate) and what settings/abstractions were used,
So that I can judge how much to trust the output.

- Priority: Must
- Linked: FEAT-006, REQ-008, NFR-005, BR-005
- Acceptance Criteria: AC-013
- Risks: RISK-004

### US-013: Understand GTO terms in-context
**User Story**
As a learner,
I want plain-language explanations/tooltips for terms like equity, EV, frequency, and exploitability,
So that I can understand the results without prior solver experience.

- Priority: Should
- Linked: NFR-008
- Acceptance Criteria: AC-014

---

## Epic E4 — Constrained Postflop Solving

### US-014: Solve a constrained postflop spot
**User Story**
As an advanced user,
I want to solve a bounded heads-up postflop spot (single board, limited sizing tree),
So that I can study postflop strategy within what my browser can realistically compute.

- Priority: Should
- Linked: FEAT-008, REQ-011
- Acceptance Criteria: AC-015
- Notes: Enforced tractability bound; documented limits shown to user.
- Risks: RISK-001, RISK-003
- Dependencies: US-008, US-009

---

## Epic E5 — Local Persistence (CON-2)

### US-015: Save a spot and its result locally
**User Story**
As a user,
I want to save a configured spot and its solved result in my browser,
So that my work survives page reloads and I can revisit it later.

- Priority: Must
- Linked: FEAT-007, REQ-009, NFR-006, NFR-007
- Acceptance Criteria: AC-016
- Dependencies: DEP-002 (IndexedDB)

### US-016: Load, rename, and delete saved work
**User Story**
As a user,
I want to list, load, rename, and delete my saved spots and results,
So that I can manage my study library locally.

- Priority: Must
- Linked: FEAT-007, REQ-009
- Acceptance Criteria: AC-017

### US-017: Understand local storage limits and eviction
**User Story**
As a user,
I want to see how much local storage I am using and be warned about browser eviction,
So that I do not unexpectedly lose saved work.

- Priority: Must
- Linked: FEAT-007, NFR-007
- Acceptance Criteria: AC-018
- Risks: RISK-003

### US-022: Export/import a spot as a file
**User Story**
As the user,
I want to export a spot (and optionally its result) to a file and re-import it,
So that I can back up my work (guarding against browser eviction) without any server.

- Priority: Could
- Linked: FEAT-014, REQ-017
- Acceptance Criteria: AC-022
- Notes: File-based backup given no sync (CON-2). Mitigates RISK-013.

---

## Epic E6 — Platform & Access

### US-018: Use the app with no install and no account
**User Story**
As the user,
I want to open the app and immediately use it with no install and no account,
So that I can study instantly and keep my data private and local.

- Priority: Must
- Linked: FEAT-001, FEAT-011, FEAT-019, REQ-001, NFR-006, CON-2
- Acceptance Criteria: AC-019

### US-019: Be told clearly if my browser is unsupported
**User Story**
As a user on an older or limited browser,
I want a clear message if my browser cannot run the solver,
So that I am not left with a broken page.

- Priority: Should
- Linked: NFR-009
- Acceptance Criteria: AC-020
- Edge: EDGE-002

### US-020: Use the app offline after first load
**User Story**
As a user with intermittent connectivity,
I want the app to work after the first load without a network,
So that I can study anywhere.

- Priority: Should
- Linked: FEAT-011, REQ-014
- Acceptance Criteria: AC-021

---

## Epic E7 — Practice / Drill (in MVP)

### US-021: Drill a spot and get scored vs the solution
**User Story**
As the user,
I want a practice mode that presents a spot, asks me to estimate the correct action/frequency, then reveals and scores my answer against the GTO solution,
So that I can test and reinforce my recall of correct play.

- Priority: Must
- Linked: FEAT-012, REQ-021
- Acceptance Criteria: AC-023
- Notes: Promoted from stretch to MVP. MVP scope = single-spot drill + scoring; advanced training analytics (spaced repetition, cross-session leak tracking) remain Future.

### US-027: Practice from predefined or saved spots
**User Story**
As the user,
I want practice mode to draw spots from the bundled predefined library or my own saved solves,
So that I can drill common situations immediately without configuring or solving each one first.

- Priority: Must
- Linked: FEAT-012, FEAT-019, REQ-021
- Acceptance Criteria: AC-027
- Dependencies: US-024, US-015

---

## Epic E9 — Configurable Spot & Tiered Decision (FEAT-020/021/022/023/024/025/026)

> Added by the 2026-06-25 scope expansion. This epic turns the tool into a general, configurable PREFLOP decision tool with honest accuracy/trust tiering (PRD Section 5A).

### US-028: Configure stack, players, game type, and position
**User Story**
As the user,
I want to configure a spot by stack size (sub-10bb to 1000bb), number of players (2–9), game type (cash or tournament/ICM), and my hero position,
So that I get a decision for the actual table situation I am studying.

- Priority: Must
- Linked: FEAT-020, REQ-022
- Acceptance Criteria: AC-028
- Notes: Stack is selected via buckets (Q-012); only positions valid for the chosen player count are offered (EDGE-014). For tournament/ICM, payout structure + all players' stacks are also required (US-036, BR-012).
- Dependencies: none (foundational for E9)
- Risks: RISK-015

### US-029: Specify the prior action before hero (bet-context)
**User Story**
As the user,
I want to specify the action before me — whether there were limps/bets/raises and their sizes,
So that the decision is computed for my position given that exact prior action (bet-context aware).

- Priority: Must
- Linked: FEAT-020, REQ-022, REQ-023, BR-009
- Acceptance Criteria: AC-029
- Notes: The prior action determines which hero actions are applicable (e.g. facing a 3-bet enables 4-bet shove) — EDGE-015.
- Dependencies: US-028

### US-030: Get per-action frequency output (full taxonomy)
**User Story**
As the user,
I want the result expressed as the percentage frequency of each of my applicable actions — RAISE (small/big/all-in), CALL, FOLD, 3-BET, 3-BET SHOVE, 4-BET SHOVE, 5-BET SHOVE,
So that I can study the mixed strategy, not just a single recommended action.

- Priority: Must
- Linked: FEAT-021, REQ-023, REQ-024, BR-009
- Acceptance Criteria: AC-030
- Notes: The applicable action subset depends on bet-context; frequencies sum to 100% over that subset (BR-009). Raise-size thresholds per Q-014.
- Dependencies: US-029

### US-031: Get a trustworthy HU live solve (Tier 1)
**User Story**
As the user,
I want heads-up (2-player) cash spots delivered as a real live solve with an exploitability estimate,
So that I can fully trust the HU output as exact-GTO-quality within convergence.

- Priority: Must
- Linked: FEAT-002, FEAT-024, REQ-025
- Acceptance Criteria: AC-031
- Notes: Tier 1. HU is two-player zero-sum, so exploitability is well-defined. Served from cache when available, else live solve.
- Dependencies: US-001, US-030
- Risks: RISK-004

### US-032: Get multiway cash charts (Tier 2, labeled)
**User Story**
As the user,
I want multiway (3–9 player) cash spots answered from bundled precomputed charts, clearly labeled as charts,
So that I get instant, honest multiway guidance without the tool pretending to live-solve an exact multiway equilibrium.

- Priority: Must
- Linked: FEAT-022, FEAT-024, REQ-026
- Acceptance Criteria: AC-032
- Notes: Tier 2. Cash 6-max first, then full-ring (cash-first; tournament/ICM later). Labeled "Predefined chart"; never "exact GTO". Initial coverage per Q-011.
- Dependencies: US-024, US-030
- Risks: RISK-016, RISK-015, RISK-018

### US-033: Get a labeled multiway/ICM estimate (Tier 3)
**User Story**
As the user,
I want multiway/ICM spots with no matching chart answered by a clearly-labeled live estimate,
So that I still get guidance for uncovered spots without being misled into thinking it is exact GTO.

- Priority: Should
- Linked: FEAT-025, FEAT-024, REQ-027
- Acceptance Criteria: AC-033
- Notes: Tier 3. Labeled "Estimate (not exact GTO)"; NO exploitability number shown (undefined for general-sum — BR-011). Assumptions shown.
- Dependencies: US-032
- Risks: RISK-016, RISK-018

### US-034: See the trust tier and never see multiway as "exact GTO"
**User Story**
As the user,
I want every result clearly labeled with its trust tier (live solve / precomputed chart / estimate) and its assumptions, with multiway/ICM never labeled "exact GTO",
So that I always know how much to trust the output.

- Priority: Must
- Linked: FEAT-024, REQ-028, NFR-012, NFR-013, BR-010, BR-011
- Acceptance Criteria: AC-034
- Notes: Honesty requirement (PRD Section 5A). Tier and assumptions shown at the point of use, not buried.
- Dependencies: US-031, US-032, US-033
- Risks: RISK-016, RISK-018

### US-035: Get deep-stack (200–1000bb) guidance via buckets
**User Story**
As the user,
I want deep-stack spots (200–1000bb) handled via abstraction and stack buckets,
So that I get usable deep-stack guidance even though full-resolution solving is infeasible, and I can see which bucket it represents.

- Priority: Should
- Linked: FEAT-023, REQ-029, BR-013
- Acceptance Criteria: AC-035
- Notes: Result shows active stack bucket and abstraction; not full-resolution (EDGE-016, EDGE-018).
- Dependencies: US-028
- Risks: RISK-015

### US-036: Get tournament/ICM guidance (later phase)
**User Story**
As the user,
I want tournament/ICM spots supported (after cash multiway), with the payout structure and all players' stacks as inputs,
So that I can study ICM-adjusted preflop decisions with the model's assumptions made explicit.

- Priority: Won't (this slice) / Future
- Linked: FEAT-026, REQ-030, BR-012
- Acceptance Criteria: AC-036
- Notes: Explicitly AFTER cash multiway (stakeholder "cash multiway first"). Requires payout structure + all stacks (EDGE-017); chip-EV replaced by ICM utility. Delivered as Tier 2 chart or Tier 3 estimate, never exact GTO. Model/coverage per Q-015.
- Dependencies: US-032, US-033
