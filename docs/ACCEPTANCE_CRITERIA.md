# Acceptance Criteria — Personal Browser-Native NLHE Preflop Decision Tool & GTO Solver

> STATUS: APPROVED by stakeholder (2026-06-24); MAJOR SCOPE EXPANSION APPROVED (2026-06-25)
> Owner: Product Owner Agent
> Last Updated: 2026-06-26
> Cross-references: stories (US-*) in `USER_STORIES.md`; requirements (REQ-*), NFRs, and business rules (BR-*) in `PRD.md`.
> Revision (2026-06-24): Performance is best-effort (no hard latency SLA — PRD NFR-001/Q-002), so prior "(TBD — perf budget)" pass/fail timing gates are removed/softened. Added cache criteria (AC-024–026), updated practice criteria (AC-023, AC-027).
> Revision (2026-06-25 scope expansion): Added AC-028..AC-036 for the configurable spot model, the per-action frequency taxonomy, and the accuracy/trust tiering — including criteria that REQUIRE correct trust-labeling per tier (multiway/ICM must be labeled "estimate"/"predefined", never "exact GTO", and must not show exploitability). See PRD Sections 5A and 22.
> Note for SDET: criteria are observable/testable. Where solve quality is asserted for HU (Tier 1), validate against a reference solver within an agreed exploitability tolerance. For multiway/ICM (Tier 2/3) exploitability is undefined — validate labeling/assumptions and (for charts) byte-equality with the bundled entry instead.

---

## Criteria Index

| ID | Title | Story | Priority | Status |
|----|-------|-------|----------|--------|
| AC-001 | Live solve runs locally with no network call | US-001 | Must | Draft |
| AC-002 | Solve produces a valid strategy | US-001 | Must | Draft |
| AC-003 | UI stays responsive during solve | US-002 | Must | Draft |
| AC-004 | Progress and iterations are shown | US-003 | Must | Draft |
| AC-005 | Solve can be stopped | US-004 | Must | Draft |
| AC-006 | Over-budget solve is warned/blocked | US-005 | Must | Draft |
| AC-024 | Common spot served instantly from cache | US-024 | Must | Draft |
| AC-025 | Cache miss falls back to live solve | US-025 | Must | Draft |
| AC-026 | Result source (predefined vs live) is labeled | US-026 | Must | Draft |
| AC-007 | Preflop HU spot can be configured | US-006 | Must | Draft |
| AC-008 | Range editor works on 13x13 grid | US-007 | Must | Draft |
| AC-009 | Bet-sizing tree can be configured | US-008 | Should | Draft |
| AC-010 | Board input is validated | US-009 | Should | Draft |
| AC-011 | Strategy grid is displayed correctly | US-010 | Must | Draft |
| AC-012 | EV and equity are displayed | US-011 | Must | Draft |
| AC-013 | Solve quality/exploitability is shown | US-012 | Must | Draft |
| AC-014 | GTO terms have in-context explanations | US-013 | Should | Draft |
| AC-015 | Constrained postflop solve works within bound | US-014 | Should | Draft |
| AC-016 | Spot and result persist locally | US-015 | Must | Draft |
| AC-017 | Saved work can be loaded/renamed/deleted | US-016 | Must | Draft |
| AC-018 | Storage usage and eviction communicated | US-017 | Must | Draft |
| AC-019 | App usable with no install/account | US-018 | Must | Draft |
| AC-020 | Unsupported browser handled | US-019 | Should | Draft |
| AC-021 | App works offline after first load | US-020 | Should | Draft |
| AC-022 | Spot export/import round-trips | US-022 | Could | Draft |
| AC-023 | Practice mode scores answer vs solution | US-021 | Must | Draft |
| AC-027 | Practice draws from predefined/saved spots | US-027 | Must | Draft |
| AC-028 | Spot configurable by stack/players/game-type/position | US-028 | Must | Draft |
| AC-029 | Prior action (bet-context) configurable and drives action set | US-029 | Must | Draft |
| AC-030 | Per-action frequency taxonomy output sums to 100% over applicable set | US-030 | Must | Draft |
| AC-031 | HU spot delivered as Tier 1 live solve with exploitability | US-031 | Must | Draft |
| AC-032 | Multiway cash served as Tier 2 chart, labeled (never "exact GTO") | US-032 | Must | Draft |
| AC-033 | Multiway/ICM estimate labeled Tier 3, no exploitability shown | US-033 | Should | Draft |
| AC-034 | Trust tier always labeled; multiway/ICM never "exact GTO" | US-034 | Must | Draft |
| AC-035 | Deep-stack handled via buckets, bucket shown | US-035 | Should | Draft |
| AC-036 | Tournament/ICM requires payout + all stacks, shows assumptions | US-036 | Future | Draft |

---

## AC-001: Live solve runs locally with no network call
Story: US-001 | Requirements: REQ-001, REQ-019, NFR-006

```gherkin
Given a configured, in-budget preflop HU spot with no matching predefined entry
And browser network activity is being monitored
When the user requests the strategy
Then the strategy is computed in the browser by the live solver
And no outbound network request is made to any solver/compute endpoint
```
Testability: assert via network inspection / request interception that zero compute-related requests occur. (Loading bundled static assets such as the predefined library file is permitted; calling a remote compute/API endpoint is not.)

---

## AC-002: Solve produces a valid strategy
Story: US-001 | Requirements: REQ-001, BR-003

```gherkin
Given a configured, in-budget preflop HU spot
When the solve completes
Then a strategy is returned for every hand in each player's range
And for each hand at each decision node the action frequencies sum to 100% within tolerance
And (trust gate) the output matches a reference-solver baseline for a known benchmark spot within an agreed exploitability tolerance
```
Testability: programmatic frequency-sum check; benchmark comparison against a reference solver (see RISK-004). The exploitability tolerance is an agreed quality threshold (Architect/SDET), independent of solve time (performance is best-effort — NFR-001). Applies to both live and predefined results.

---

## AC-003: UI stays responsive during solve
Story: US-002 | Requirements: REQ-002, NFR-002

```gherkin
Given a solve is running
When the user interacts with the UI (e.g. opens a menu, navigates)
Then the UI responds without the main thread being blocked for more than ~100ms
```
Testability: long-task / main-thread blocking measurement during an active solve.

---

## AC-004: Progress and iterations are shown
Story: US-003 | Requirements: REQ-007

```gherkin
Given a solve is running
When the user views the solve panel
Then a live progress indicator and the current iteration count are displayed
And the displayed values update over time as the solve proceeds
```

---

## AC-005: Solve can be stopped
Story: US-004 | Requirements: REQ-007 | Edge: EDGE-003, EDGE-006

```gherkin
Given a solve is running
When the user clicks Stop
Then the solve halts within a short, bounded time
And the best strategy computed so far is displayed
And it is clearly labeled as not fully converged, with its current exploitability estimate
```

---

## AC-006: Over-budget solve is warned/blocked
Story: US-005 | Requirements: REQ-010, BR-006 | Edge: EDGE-001

```gherkin
Given a configured spot whose estimated cost exceeds the in-browser tractability bound
When the user attempts to start the solve
Then the system displays a clear warning explaining the spot is too large for in-browser solving
And the system either blocks the solve or requires explicit confirmation before proceeding
And it suggests ways to reduce cost (e.g. fewer sizes, tighter ranges, more abstraction)
```

---

## AC-007: Preflop HU spot can be configured
Story: US-006 | Requirements: REQ-003

```gherkin
Given the user is creating a preflop heads-up spot
When the user sets effective stack depth, both positions, and a range for each player
Then the configuration is accepted and validated
And the user can start a solve from this configuration
```
```gherkin
Given an invalid configuration (e.g. an empty range for a player)
When the user attempts to solve
Then a validation error is shown and the solve is blocked until corrected
```

---

## AC-008: Range editor works on 13x13 grid
Story: US-007 | Requirements: REQ-004, BR-001

```gherkin
Given the 13x13 range editor for a player
When the user selects hands and assigns weights between 0% and 100%
Then the editor reflects the selection visually
And the resulting range (169-class representation with weights) is stored for that player
And pairs appear on the diagonal, suited combos upper-right, offsuit lower-left/right per convention
```

---

## AC-009: Bet-sizing tree can be configured
Story: US-008 | Requirements: REQ-012

```gherkin
Given a spot that supports betting
When the user selects bet sizes from the allowed set
Then the chosen sizes are incorporated into the game tree used for solving
And selecting more sizes increases the displayed estimated solve cost
```

---

## AC-010: Board input is validated
Story: US-009 | Requirements: REQ-013, BR-002 | Edge: EDGE-005

```gherkin
Given a postflop spot requiring a board
When the user enters board cards
Then valid, conflict-free boards are accepted
And boards containing duplicate cards or cards conflicting with locked range cards are rejected with a clear error
```

---

## AC-011: Strategy grid is displayed correctly
Story: US-010 | Requirements: REQ-005, BR-003

```gherkin
Given a completed solve
When the user views the strategy grid
Then a 13x13 grid is shown with each cell colored by its action mix
And selecting a cell shows that hand's per-action frequencies
And the displayed frequencies for a hand sum to 100% within tolerance
```

---

## AC-012: EV and equity are displayed
Story: US-011 | Requirements: REQ-006, BR-004

```gherkin
Given a completed solve
When the user inspects a hand or the range
Then EV per action/hand is displayed with its unit
And range-vs-range equity is displayed as a percentage
```

---

## AC-013: Solve quality / exploitability is shown
Story: US-012 | Requirements: REQ-008, NFR-005, BR-005

```gherkin
Given a completed or stopped solve
When the user views the results
Then an exploitability/convergence estimate is displayed
And it is explicitly labeled as an estimate at the current iteration (not "exact GTO")
And the abstraction and settings used for the solve are shown
```

---

## AC-014: GTO terms have in-context explanations
Story: US-013 | Requirements: NFR-008

```gherkin
Given the results view contains terms such as equity, EV, frequency, or exploitability
When the user hovers or taps the term's help affordance
Then a plain-language explanation of that term is shown
```

---

## AC-015: Constrained postflop solve works within bound
Story: US-014 | Requirements: REQ-011 | Edge: EDGE-001, EDGE-007

```gherkin
Given a heads-up postflop spot configured within the documented tractability bound (streets, sizes, range size)
When the user starts the solve
Then the solve completes in a reasonable, best-effort time (no fixed SLA — NFR-001)
And a valid strategy, EV/equity, and exploitability estimate are displayed
And progress is shown throughout so the user can stop a slow solve (AC-004/AC-005)
```
```gherkin
Given a postflop configuration that exceeds the documented bound
When the user attempts to solve
Then the over-budget warning/block behavior (AC-006) applies
```

---

## AC-016: Spot and result persist locally
Story: US-015 | Requirements: REQ-009, NFR-006, NFR-007

```gherkin
Given a configured spot with a completed solve
When the user saves it
And later reloads the page or restarts the browser
Then the saved spot and its result are retrievable from local storage
And no data was sent to any server
```

---

## AC-017: Saved work can be loaded/renamed/deleted
Story: US-016 | Requirements: REQ-009

```gherkin
Given one or more saved items exist
When the user opens the Saved view
Then all saved items are listed
And the user can load an item (restoring its configuration and result)
And the user can rename an item
And the user can delete an item, after which it no longer appears
```

---

## AC-018: Storage usage and eviction communicated
Story: US-017 | Requirements: NFR-007 | Edge: EDGE-004

```gherkin
Given the user is managing saved work
When the user views storage information
Then current local storage usage is displayed
And the user is informed that the browser may evict local data and how to mitigate it (e.g. export)
```
```gherkin
Given local storage is full or a write is rejected
When the user attempts to save
Then a clear error is shown and no partial/corrupt record is left behind
```

---

## AC-019: App usable with no install/account
Story: US-018 | Requirements: REQ-001, NFR-006, CON-2

```gherkin
Given a supported browser and the app URL
When the user opens the URL for the first time
Then the app loads from static hosting (including the bundled predefined library)
And the user can look up a common spot or configure and run a solve without creating an account or installing anything
```

---

## AC-020: Unsupported browser handled
Story: US-019 | Requirements: NFR-009 | Edge: EDGE-002

```gherkin
Given a browser lacking a required capability (WASM, Web Workers, or IndexedDB)
When the user opens the app
Then a clear, non-broken "unsupported browser" message is shown
And the message states which capability is missing or which browsers are supported
```

---

## AC-021: App works offline after first load
Story: US-020 | Requirements: REQ-014, FEAT-011

```gherkin
Given the user has loaded the app once with network access
When the user later opens the app with no network connectivity
Then the app shell, solver, and bundled predefined library load and function
And the user can look up cached spots, run a live solve, and view local saved work offline
```

---

## AC-022: Spot export/import round-trips
Story: US-022 | Requirements: REQ-017

```gherkin
Given a saved spot (optionally with its result)
When the user exports it to a file and later imports that file
Then the imported spot matches the original configuration
And the user can solve or view it as before
```

---

## AC-023: Practice mode scores answer vs solution
Story: US-021 | Requirements: REQ-021

```gherkin
Given a spot with a known GTO solution (predefined or saved)
When the user enters practice mode and is asked to estimate the correct action/frequency for a hand
And the user submits an estimate
Then the app reveals the GTO solution
And the app scores the user's answer (e.g. the difference/accuracy vs the solution)
And the user can proceed to the next spot
```

---

## AC-024: Common spot served instantly from cache
Story: US-024 | Requirements: REQ-018, BR-008 | Edge: EDGE-011

```gherkin
Given a requested spot that matches an entry in the bundled predefined solution library
When the user requests the strategy
Then the predefined solution is returned without running a live solve
And it is returned effectively instantly (no solve progress/iteration loop is run)
And the displayed result includes the settings/abstraction used to generate the predefined entry
```
Testability: assert no solver worker computation is triggered on a cache hit; verify served strategy equals the bundled entry.

---

## AC-025: Cache miss falls back to live solve
Story: US-025 | Requirements: REQ-019, BR-008 | Edge: EDGE-009, EDGE-010

```gherkin
Given a requested spot with no matching predefined entry
When the user requests the strategy
Then the app does not return an unlabeled approximate predefined answer
And the app runs a live solve (subject to over-budget checks AC-006)
```
```gherkin
Given the bundled predefined library is missing, corrupt, or version-mismatched
When the app loads or attempts a lookup
Then the cache is disabled with a clear notice
And the app falls back to live solving
```
Testability: simulate no-match and corrupt-library conditions; verify fallback behavior and notice.

---

## AC-026: Result source (predefined vs live) is labeled
Story: US-026 | Requirements: REQ-020, BR-007, NFR-011

```gherkin
Given a displayed strategy result
When the user views it
Then the result is clearly labeled as either "Predefined" (from the bundled cache) or "Live solve"
And the settings/abstraction used to produce it are shown
```

---

## AC-027: Practice draws from predefined/saved spots
Story: US-027 | Requirements: REQ-021

```gherkin
Given the bundled predefined library and/or the user's saved solves contain spots
When the user starts practice mode
Then the app can present spots drawn from the predefined library and/or saved solves
And the user can drill them without first configuring or solving each spot
```

---

## AC-028: Spot configurable by stack/players/game-type/position
Story: US-028 | Requirements: REQ-022 | Edge: EDGE-014, EDGE-016

```gherkin
Given the user is configuring a preflop spot
When the user selects a stack size (sub-10bb up to 1000bb), a number of players (2–9), a game type (cash or tournament/ICM), and a hero position
Then the configuration is accepted and validated
And only positions valid for the selected number of players are offered (e.g. UTG+2 is not offered at a 3-handed table)
And the selected stack is mapped to a stack bucket, and the bucket in use is recorded for display with the result
```
```gherkin
Given the user selects game type = tournament/ICM
When the user proceeds
Then the app additionally requires the payout structure and all players' stacks before producing a result (see AC-036)
```
Testability: assert position options vary with player count; assert stack-to-bucket mapping recorded; assert ICM input gating.

---

## AC-029: Prior action (bet-context) configurable and drives action set
Story: US-029 | Requirements: REQ-022, REQ-023, BR-009 | Edge: EDGE-015

```gherkin
Given a configured spot
When the user specifies the prior action before hero (e.g. folds to hero / a single raise of size X / a raise then a 3-bet of size Y)
Then the decision is computed for hero's position given that prior action (bet-context aware)
And the set of hero actions offered matches the bet-context
And actions that are not applicable in that context are not offered (e.g. 4-BET SHOVE is absent when hero has not faced a 3-bet)
```
Testability: parametrized over bet-contexts; assert the applicable action set per context (BR-009).

---

## AC-030: Per-action frequency taxonomy output sums to 100% over applicable set
Story: US-030 | Requirements: REQ-023, REQ-024, BR-009

```gherkin
Given a resolved spot
When the user views the result
Then hero's decision is shown as percentage frequencies over the applicable action set
And the action vocabulary is drawn from: RAISE (small / big / all-in), CALL, FOLD, 3-BET, 3-BET SHOVE, 4-BET SHOVE, 5-BET SHOVE
And the displayed frequencies sum to 100% within tolerance over the applicable set
```
Testability: programmatic sum-to-100% check over the context-applicable action set; assert raise-size buckets map to the configured thresholds (Q-014).

---

## AC-031: HU spot delivered as Tier 1 live solve with exploitability
Story: US-031 | Requirements: REQ-025, NFR-005, BR-005 | Tier: 1

```gherkin
Given a heads-up (2-player) cash spot
When the user requests the decision
Then the result is delivered as a Tier 1 result (served from the HU cache if available, else a live solve)
And it is labeled "Live solve" (or "Predefined") — i.e. Tier 1
And an exploitability estimate is displayed (labeled as an estimate at the current iteration, not "exact GTO" unless converged within tolerance)
```
Testability: assert tier=1 labeling; assert exploitability present for HU; assert HU live output validated vs reference solver within tolerance (AC-002 trust gate).

---

## AC-032: Multiway cash served as Tier 2 chart, labeled (never "exact GTO")
Story: US-032 | Requirements: REQ-026, BR-010, NFR-012 | Tier: 2 | Edge: EDGE-012

```gherkin
Given a multiway (3–9 player) cash spot that matches a bundled precomputed chart
When the user requests the decision
Then the precomputed chart is served instantly (no live multiway solve is run)
And the result is clearly labeled as a "Predefined chart" / "Precomputed" (Tier 2)
And the result is NEVER labeled "exact GTO", "GTO solution", or "solved" without an explicit predefined/estimate qualifier
And no exploitability number is displayed (it is undefined for general-sum multiway)
And the chart's generation method/assumptions are shown
```
Testability: assert chart served byte-equal to bundled entry; assert label set excludes "exact GTO" wording (string assertions); assert no exploitability field for multiway.

---

## AC-033: Multiway/ICM estimate labeled Tier 3, no exploitability shown
Story: US-033 | Requirements: REQ-027, BR-011, NFR-012 | Tier: 3 | Edge: EDGE-012, EDGE-013

```gherkin
Given a multiway or ICM spot with no matching predefined chart
When the user requests the decision
Then the app produces a live approximate result labeled "Estimate (not exact GTO)" (Tier 3)
And no exploitability number is displayed
And the assumptions used are shown
And the labeling visibly differs from a Tier 1 HU live solve
```
```gherkin
Given a multiway/ICM spot that is not yet covered at all (e.g. tournament/ICM before its phase)
When the user requests the decision
Then the app shows a clear "not yet covered" notice
And it does not fabricate a result or present a HU/cash answer as if it applied
```
Testability: simulate no-chart and not-covered conditions; assert Tier 3 labeling, absence of exploitability, presence of assumptions, and not-covered notice.

---

## AC-034: Trust tier always labeled; multiway/ICM never "exact GTO"
Story: US-034 | Requirements: REQ-028, NFR-012, NFR-013, BR-010, BR-011 | Edge: EDGE-012

```gherkin
Given any displayed result
When the user views it
Then the result shows its trust tier and source (Tier 1 live solve / Tier 2 predefined chart / Tier 3 estimate)
And the tier and its assumptions are shown at the point of use (alongside the frequencies), not only on a separate screen
And for any multiway (3–9) or tournament/ICM result, the words "exact GTO", "GTO solution", or "solved" never appear without an explicit estimate/approximation/predefined-chart qualifier
And exploitability is shown only for Tier 1 (HU) results
```
Testability: cross-tier label assertions; negative string assertions on multiway/ICM views; assert exploitability appears only for tier=1. This is the core honesty-requirement gate (PRD Section 5A).

---

## AC-035: Deep-stack handled via buckets, bucket shown
Story: US-035 | Requirements: REQ-029, BR-013 | Edge: EDGE-016, EDGE-018

```gherkin
Given a deep-stack spot (e.g. 200–1000bb)
When the user requests the decision
Then the result is produced from the applicable stack bucket / abstraction (not full-resolution live solving)
And the result clearly shows which stack bucket and abstraction it represents
```
```gherkin
Given the user's exact stack falls between two buckets
When the result is shown
Then it is mapped to the applicable bucket and the bucket in use is displayed
```
Testability: assert bucket attribution shown; assert deep stacks do not trigger full-resolution solves.

---

## AC-036: Tournament/ICM requires payout + all stacks, shows assumptions
Story: US-036 | Requirements: REQ-030, BR-012 | Edge: EDGE-017 | Tier: 2/3 (later phase)

```gherkin
Given the user configures a tournament/ICM spot
When the user attempts to get a decision without providing the payout structure or all players' stacks
Then the app blocks/validates and prompts for the missing inputs
```
```gherkin
Given a tournament/ICM spot with payout structure and all players' stacks provided
When a result is produced
Then it is delivered as a Tier 2 chart or Tier 3 estimate (never "exact GTO")
And the ICM model, payout structure, and stack distribution assumed are shown with the result
```
Testability: assert ICM input completeness gating; assert assumptions display; assert tier labeling. (Later-phase criterion — after cash multiway.)
