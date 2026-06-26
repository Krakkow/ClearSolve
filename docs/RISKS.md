# Product Risks — Personal Browser-Native NLHE Preflop Decision Tool & GTO Solver

> STATUS: APPROVED by stakeholder (2026-06-24); MAJOR SCOPE EXPANSION APPROVED (2026-06-25)
> Owner: Product Owner Agent
> Last Updated: 2026-06-26
> Cross-references: `PRD.md` (constraints CON-1/2/3, assumptions ASM-*, open questions Q-*, Section 5A trust tiering), `USER_STORIES.md`, `ACCEPTANCE_CRITERIA.md`.
> Scale: Likelihood and Impact each rated High / Medium / Low.
> Revision (2026-06-24): Reframed for personal-use. RISK-002 and RISK-008 downgraded/resolved; RISK-011 downgraded; RISK-012 reframed; added RISK-014. The predefined cache (FEAT-019) is a primary mitigation for RISK-001.
> Revision (2026-06-25 scope expansion): Added RISK-015 (combinatorial blow-up at deep stacks / high player counts), RISK-016 (multiway non-zero-sum correctness/trust), RISK-017 (ICM model validity), and RISK-018 (user-expectation gap re: full-fidelity multiway). The accuracy/trust tiering (PRD Section 5A) and "cash-first" sequencing are the principal mitigations for the new trust/scope risks. See PRD Section 22.

---

## Risk Summary Table

| ID | Category | Risk | Likelihood | Impact | Owner |
|----|----------|------|------------|--------|-------|
| RISK-001 | Technical feasibility | In-browser live postflop solving too slow / memory-heavy to be useful | High | High | Architect |
| RISK-016 | Trust / correctness | Multiway non-zero-sum (general-sum) correctness/trust — no unique equilibrium; exploitability undefined; "solve" could mislead | High | High | PO / Architect / SDET |
| RISK-015 | Technical feasibility | Combinatorial blow-up at deep stacks / high player counts (config space: stack x players x position x bet-context) | High | High | Architect |
| RISK-018 | UX / expectation | User-expectation gap: stakeholder may expect full-fidelity exact multiway GTO despite Option 1 | High | Medium | PO |
| RISK-017 | Trust / model | ICM model validity — chip-EV replaced by payout-dependent utility; wrong model/inputs => wrong advice | Medium | High | PO / Architect |
| RISK-014 | Trust / coverage | Predefined-cache quality, coverage, staleness, or mismatched lookups | Medium | Medium | Architect / SDET |
| RISK-003 | Technical / platform | Browser memory & storage limits cap solve size, saved data, and library bundle size | Medium | High | Architect |
| RISK-004 | Trust / correctness | Live-solve or predefined output is wrong or perceived as untrustworthy | Medium | High | Architect / SDET |
| RISK-005 | Technical feasibility | WASM CFR engine harder/slower to build than estimated | Medium | High | Architect |
| RISK-006 | Platform | Multi-thread WASM requires COOP/COEP & SharedArrayBuffer not always available | Medium | Medium | Architect / DevOps |
| RISK-010 | Reliability | Long/large live solves crash the browser tab (OOM) | Medium | High | Architect |
| RISK-007 | UX | Solver complexity overwhelms the user | Low–Medium | Medium | PO / Design |
| RISK-009 | UX / expectation | User expects desktop-solver precision; best-effort/bounded solves disappoint | Medium | Medium | PO |
| RISK-013 | Privacy/data loss | Browser eviction silently destroys the user's saved study work | Medium | Medium | Architect / PO |
| RISK-002 | Scope / strategy | (RESOLVED) Competitor-scope vs no-backend tension | Low | Low | PO |
| RISK-008 | Legal / ethical | (DEFERRED) Poker tooling ToS/legal concerns | Low | Low | User |
| RISK-011 | Business | (DOWNGRADED) No monetization/analytics path | Low | Low | User |
| RISK-012 | Scope creep | Pressure to add backend/competitor-scale features mid-build | Low–Medium | Medium | PO / Delivery |

---

## Detailed Risks

### RISK-001 — In-browser live postflop solving may be too slow / memory-heavy
- Category: Technical feasibility (still the biggest technical risk).
- Description: Postflop CFR solving is dramatically more expensive than preflop (large game trees, per-node strategy storage, many iterations). Doing this live in a single-tab browser on consumer hardware via WASM may yield unacceptable solve times or exhaust memory.
- Likelihood: High. Impact: High.
- Mitigation:
  - PRIMARY: ship a bundled predefined/precomputed solution cache (FEAT-019, REQ-018) for common preflop and selected postflop spots, so the most-studied situations return instantly and never require an in-browser live postflop solve. Precomputation is done offline/at build time, where a more capable solver and longer compute budgets are available (ASM-011).
  - Performance is best-effort with no hard SLA (NFR-001), reducing the pressure on live-solve speed; live solving handles novel spots within a tractability bound.
  - Run a feasibility spike (PRD milestone M0) covering both live solving and the cache approach.
  - Strictly bound the live postflop class (single board, few sizes, abstraction) — REQ-011, FEAT-008.
  - Enforce a tractability bound with pre-solve cost estimation and over-budget warnings (REQ-010, AC-006).
  - Be transparent in-app about postflop coverage/limits and result source (BR-005, BR-007, AC-013, AC-026).
- Linked: ASM-001, ASM-002, ASM-010, ASM-011, FEAT-019, Q-001, Q-010.

### RISK-014 — Predefined-cache quality, coverage, staleness, or mismatched lookups
- Category: Trust / coverage (NEW — introduced with the predefined cache).
- Description: The bundled cache is only as good as the spots it covers and the quality of the precomputation. Risks: insufficient coverage (too many misses), stale/low-quality entries, or returning a predefined answer for a spot that does not truly match the user's request.
- Likelihood: Medium. Impact: Medium.
- Mitigation:
  - Strict match rules: only serve a predefined entry on a genuine match; otherwise fall back to live solving (BR-008, AC-025) — never return an unlabeled approximate predefined answer.
  - Generate predefined entries to validated quality (reference-solver comparison, same as live — RISK-004) and record their generation settings (BR-007, AC-026).
  - Integrity/version checks on the bundled library; disable cache + fall back if invalid (NFR-011, EDGE-010, AC-025).
  - Define and curate the coverage list deliberately (Q-010); expand over time (Future).
- Linked: FEAT-019, REQ-018/019/020, BR-007/BR-008, NFR-011, EDGE-009/010/011, Q-010.

### RISK-015 — Combinatorial blow-up at deep stacks / high player counts
- Category: Technical feasibility (NEW — introduced by the 2026-06-25 config expansion).
- Description: The configurable spot model multiplies out across stack depth (sub-10bb–1000bb) x players (2–9) x hero position x prior-action/bet-context. The number of distinct spots — and the size/complexity of each multiway tree — explodes, especially at deep stacks (more bet/raise sequences) and high player counts (more positions, more action branches). This threatens both live-solve tractability and the bundled chart set's size.
- Likelihood: High. Impact: High.
- Mitigation:
  - Stack BUCKETS rather than continuous depth (Q-012); deep stacks (200–1000bb) via abstraction, not full-resolution (FEAT-023, REQ-029, BR-013).
  - Multiway delivered as PRECOMPUTED CHARTS (Tier 2), generated offline where compute budgets are larger — not live in-browser (FEAT-022).
  - Deliberately scope the initial chart coverage (player counts, stack buckets, positions, bet-context branches) — Q-011 — and expand incrementally; cash 6-max before full-ring before ICM.
  - Bound the bet-context/action-set model (BR-009); compress and lazy-load chart shards (RISK-003 mitigation).
- Linked: FEAT-020/021/022/023, REQ-022/026/029, BR-009/BR-013, RISK-003, Q-011/Q-012/Q-014.

### RISK-016 — Multiway non-zero-sum (general-sum) correctness / trust
- Category: Trust / correctness (NEW — the central honesty risk of the expansion).
- Description: Multiway (3–9 player) poker is a GENERAL-SUM game: a Nash equilibrium need not be unique, equilibria need not be interchangeable, and EXPLOITABILITY IS UNDEFINED in the heads-up sense. Any in-browser "live multiway solve" cannot honestly be presented as exact GTO. If the tool labels multiway output as "GTO" or shows an exploitability number, it would mislead the user and undermine trust in the whole tool.
- Likelihood: High (the failure mode is easy to fall into). Impact: High (trust-destroying; an ethics/honesty failure).
- Mitigation:
  - HONESTY TIERING (PRD Section 5A, stakeholder Option 1): HU = Tier 1 live solve (exploitability defined); multiway = Tier 2 precomputed chart or Tier 3 labeled estimate. Never "exact GTO" (NFR-012, BR-010).
  - Hard labeling rules enforced and TESTED: multiway/ICM never labeled "exact GTO"/"GTO solution"/"solved" without a qualifier; no exploitability number for multiway (BR-011, AC-032/AC-033/AC-034).
  - Show the generation method/assumptions for charts and estimates so the user understands what they are getting.
  - Validate labeling in CI as a non-negotiable gate (AC-034).
- Linked: Section 5A, FEAT-022/024/025, REQ-026/027/028, NFR-012/013, BR-010/BR-011, EDGE-012, AC-031/032/033/034, RISK-018.

### RISK-017 — ICM model validity
- Category: Trust / model (NEW — tournament/ICM, later phase).
- Description: Tournament play replaces chip-EV with a payout-structure-dependent utility (ICM or similar). The model is itself an approximation and is sensitive to inputs (payout structure, all players' stacks). A wrong model, wrong inputs, or hidden assumptions produce confidently-wrong ICM advice; and ICM strategies are not exact GTO either.
- Likelihood: Medium. Impact: High.
- Mitigation:
  - Require the payout structure and ALL players' stacks as inputs; block/validate otherwise (BR-012, REQ-030, EDGE-017, AC-036).
  - Display the ICM model and assumptions used with every ICM result (BR-012).
  - Deliver ICM as Tier 2 chart / Tier 3 estimate — never "exact GTO" (RISK-016 mitigations apply).
  - Sequence ICM AFTER cash multiway (stakeholder "cash-first"), reducing early exposure; choose/validate the model deliberately (Q-013/Q-015).
- Linked: FEAT-026, REQ-030, BR-012, EDGE-017, ASM-015, AC-036, Q-015, RISK-016.

### RISK-018 — User-expectation gap (full-fidelity multiway expected despite Option 1)
- Category: UX / expectation (NEW).
- Description: Even with Option 1 approved, the stakeholder/user may, in practice, expect the multiway and ICM output to be full-fidelity exact GTO (as in some marketed tools) and be disappointed or distrustful when it is presented as a chart/estimate. The gap is between the (honest) product and the (possibly higher) expectation.
- Likelihood: Medium. Impact: High (could be read as the product "not working" when it is in fact being honest).
- Mitigation:
  - Option 1 and the tiering are RECORDED AS APPROVED (PRD Section 22, GATE-EXP-2) so expectations are set at decision time.
  - Make the tiering and its rationale (zero-sum vs general-sum; ICM) visible in UX and docs (NFR-013, Section 5A; Documentation Engineer handoff).
  - Use high-quality offline-generated charts for common multiway cash spots so Tier 2 is genuinely useful, not a token estimate (FEAT-022).
  - Reconfirm with the stakeholder the initial multiway coverage (Q-011) so the first thing they see is well-covered.
- Linked: Section 5A, ASM-014, FEAT-022/024, NFR-013, Q-011, RISK-016.

### RISK-002 — (RESOLVED) Competitor-scope vs no-backend tension
- Category: Scope / strategy.
- Description: Earlier framing risked a conflict between a "production-grade GTO Wizard competitor" and the no-backend constraint. The stakeholder resolved this by positioning the product as a single-user, personal-use tool: accounts/billing/sync/server-library are out of scope by intent, not by compromise. There is no remaining tension to manage.
- Likelihood: Low. Impact: Low. (Retained for traceability.)
- Mitigation:
  - CON-3 revised to personal-use, high-quality (PRD Section 4); competitor scope is future-only (Section 6.3, FEAT-016).
  - Residual watch item handled by RISK-012 (scope creep).
- Linked: CON-2, CON-3 (revised), ASM-007, Q-005 (resolved), PRD Section 21.

### RISK-003 — Browser memory & storage limits
- Category: Technical / platform.
- Description: Tabs have practical memory ceilings; IndexedDB quotas vary by browser/device and can be evicted under storage pressure. This caps live solve size (compute), saved study work (persistence), AND the size of the bundled predefined library that can ship/cache without bloating load time.
- Likelihood: Medium. Impact: High.
- Mitigation:
  - Pre-solve cost estimation and hard tractability bounds (REQ-010).
  - Compact persistence schema; let the user prune/export saved work (FEAT-014, AC-022).
  - Bundle-size discipline for the predefined library: compress, scope coverage to genuinely common spots (Q-010), and consider lazy/on-demand loading of library segments.
  - Surface storage usage and eviction risk to the user (AC-018, NFR-007).
  - Request persistent storage where the API allows.
- Linked: ASM-004, ASM-010, EDGE-001, EDGE-004, RISK-010, RISK-013, RISK-014.

### RISK-004 — Solver correctness / trust
- Category: Trust / correctness.
- Description: If output (live OR predefined) is incorrect — or appears incorrect or non-reproducible — the personal user loses trust in the tool. Risk increases with aggressive abstraction and with non-converged solves presented as answers; the predefined cache adds a second source that must be equally validated.
- Likelihood: Medium. Impact: High.
- Mitigation:
  - Validate both live and predefined output against an established reference solver on a benchmark suite within agreed tolerance (AC-002, M2).
  - Make solves deterministic/reproducible or record the seed (NFR-004); record generation settings for predefined entries (BR-007).
  - Always show exploitability estimate, abstraction settings, and result source; never label as "exact GTO" (BR-005, BR-007, AC-013, AC-026).
  - Frequency-sum invariants enforced and tested (BR-003, AC-002/AC-011).
- Linked: NFR-004, NFR-005, NFR-011, US-012, US-026, RISK-014.

### RISK-005 — WASM CFR engine build complexity
- Category: Technical feasibility / delivery.
- Description: Implementing (or porting) a performant, correct CFR engine and compiling it to efficient WASM is substantial, specialized work; underestimation threatens timeline and quality.
- Likelihood: Medium. Impact: High.
- Mitigation:
  - Feasibility spike (M0) to de-risk language/toolchain and perf early.
  - Consider proven open foundations where licensing permits (Architect decision, DEP-001).
  - Phase delivery: preflop first, postflop gated.
- Linked: DEP-001, Q-003.

### RISK-006 — Multi-thread WASM / cross-origin isolation availability
- Category: Platform.
- Description: SharedArrayBuffer-based multithreading needs COOP/COEP cross-origin isolation, which constrains hosting and can break embedding/third-party resources; SIMD/threads support varies by browser.
- Likelihood: Medium. Impact: Medium.
- Mitigation:
  - Single-thread WASM as a baseline fallback (NFR-010).
  - Verify static host can set COOP/COEP (ASM-005, DEP-003).
  - Define a clear browser support matrix (Q-007).
- Linked: NFR-010, Q-003, Q-007.

### RISK-007 — UX complexity overwhelms the user
- Category: UX.
- Description: Solver concepts (ranges, sizing trees, abstraction, exploitability) are dense; a poorly-guided UI makes the tool tedious to use. Lower stakes now (a single, motivated owner who can learn the tool), but still a usability risk.
- Likelihood: Low–Medium. Impact: Medium.
- Mitigation:
  - In-context explanations/tooltips for GTO terms (NFR-008, AC-014).
  - Sensible defaults and instant predefined answers so common study needs require minimal configuration (FEAT-019).
  - Progressive disclosure of advanced settings.
- Linked: US-013, FEAT-019.

### RISK-008 — (DEFERRED) Legal / ethical / ToS concerns around poker tooling
- Category: Legal / ethical.
- Description: Real-time in-game assistance is banned by major poker sites; study tools are generally fine. For a personal-use study tool that is not distributed and offers no in-game assistance, the stakeholder has determined legal/ToS review is not needed now.
- Likelihood: Low. Impact: Low.
- Status: RESOLVED/DEFERRED (ASM-009, Q-008). Revisit ONLY if the tool is ever publicly distributed.
- Mitigation (retained as design posture):
  - Strictly a study tool, not in-game assistance (NG7); no live table integration.
- Linked: NG7, ASM-009 (resolved), Q-008 (resolved).

### RISK-009 — Expectation gap vs desktop-solver precision
- Category: UX / expectation.
- Description: The user, familiar with high-iteration desktop solvers, may expect equivalent precision/coverage; best-effort, abstraction-bounded live solves will be less precise. (The predefined cache can mitigate by shipping high-quality precomputed answers for common spots.)
- Likelihood: Medium. Impact: Medium.
- Mitigation:
  - Set expectations explicitly in UX and docs; show exploitability, limits, and result source (AC-013, AC-026).
  - Use the offline-generated predefined cache (often higher quality than a live in-browser solve) for common spots (FEAT-019).
- Linked: ASM-003, RISK-004, RISK-014, NFR-005, FEAT-019.

### RISK-010 — Long/large solves crash the tab (OOM)
- Category: Reliability.
- Description: A solve that exceeds memory can crash the worker/tab, losing in-progress work and damaging trust.
- Likelihood: Medium. Impact: High.
- Mitigation:
  - Tractability bounds + pre-solve estimation + warnings (REQ-010, AC-006).
  - Graceful handling and clear errors on OOM; preserve best-so-far where possible (NFR-003, EDGE-003).
  - Stop control to abort runaway solves (US-004, AC-005).
- Linked: EDGE-001, EDGE-003, EDGE-007, RISK-003.

### RISK-011 — (DOWNGRADED) No native monetization / analytics path
- Category: Business.
- Description: With no backend, billing/subscriptions/server analytics are unavailable. For a personal-use, no-monetization tool this is not a real concern — it is the intended design.
- Likelihood: Low. Impact: Low.
- Status: RESOLVED — no monetization by decision (ASM-008, Q-004). Success is measured qualitatively (PRD Section 17).
- Linked: ASM-008 (resolved), Q-004 (resolved), Section 17 KPIs.

### RISK-012 — Scope creep toward backend / competitor-scale features
- Category: Scope.
- Description: Even for a personal tool, there may be pull toward backend-dependent or competitor-scale features (sync, server library, accounts, multi-user), which would violate CON-2 and balloon effort.
- Likelihood: Low–Medium. Impact: Medium.
- Mitigation:
  - Explicit Out-of-Scope / Won't (MVP) lists and future-only framing (PRD Section 6.2/6.3, FEAT-016/017/018).
  - Any move toward a backend or multi-user product is a deliberate re-scoping decision, logged, not an in-flight expansion.
- Linked: CON-2, CON-3 (revised), FEAT-016, RISK-002.

### RISK-013 — Browser eviction silently destroys saved study work
- Category: Privacy / data loss.
- Description: Because all persistence is client-side (CON-2), browsers may evict IndexedDB data (storage pressure, "clear site data", private mode), losing the user's saved spots/results with no server backup.
- Likelihood: Medium. Impact: Medium.
- Mitigation:
  - Communicate eviction risk and storage usage clearly (AC-018, NFR-007).
  - Provide file export/import as a manual backup path (FEAT-014, AC-022).
  - Request persistent storage where supported.
- Linked: RISK-003, AC-018, FEAT-014.

---

## Top Risks to Resolve First (recommended order)
1. RISK-016 / RISK-018 — Lock and enforce the accuracy/trust TIERING and labeling (multiway/ICM never "exact GTO"; exploitability HU-only). This is the central honesty risk of the expansion; make the labeling a tested CI gate (AC-034) and keep stakeholder expectations aligned to Option 1.
2. RISK-001 / RISK-005 / RISK-015 — Prove in-browser CFR feasibility, the chart/cache pipeline (offline generation + bundle + match), the stack-bucket scheme, and the multiway config-space scoping via the M0/M0b spikes (go/no-go gates).
3. RISK-004 / RISK-014 — Establish correctness/trust validation: reference-solver benchmark for HU (Tier 1); for charts, a deliberate quality method given exploitability is undefined (Q-013); strict match + fallback rules.
4. RISK-017 — Choose/validate the ICM model and required inputs BEFORE the tournament/ICM phase (it is sequenced after cash multiway).
5. RISK-003 / RISK-010 — Confirm memory/storage/bundle-size envelope (now larger with multiway charts) and OOM/over-budget handling.
6. RISK-012 — Hold the line on scope (no backend / no exact-GTO live multiway / no multiway postflop) absent a deliberate re-scope.

> Note: RISK-002, RISK-008, and RISK-011 are resolved/deferred by the personal-use decisions and are no longer top concerns.
