# Implementation Plan — Personal Browser-Native NLHE GTO Solver ("ClearSolve")

> Owner: Delivery Manager Agent
> Last Updated: 2026-06-24
> Status: READY FOR IMPLEMENTATION (pending implementation approval)
> Source of truth: `PRD.md`, `ARCHITECTURE.md`, `TECH_DECISIONS.md` (all approval gates A/B/C APPROVED), `DATA_MODEL.md`, `API_SPEC.md`, `TEST_STRATEGY.md`, `QUALITY_GATES.md`, `DEVOPS.md`, `RISKS.md`
> Companion: `TASKS.md` (the T-NNN backlog this plan sequences)

This is the sequencing and delivery plan. It is framed around **critical path and risk**, not calendar dates — this is a solo/personal project with agent assistance, so relative ordering and dependencies are what matter. The plan front-loads the two highest-feasibility-risk things: **solver correctness** and **in-browser performance/memory feasibility**, both of which are decided at the M0 go/no-go gate.

---

## 1. Sequencing philosophy (decisive)

1. **M0 first, as a formal go/no-go gate.** Nothing about postflop/live-solving scope is committed until M0 proves (a) in-browser CFR+ quality/time/memory is viable (ASM-001/002) and (b) the offline-generate -> bundle -> match pipeline is viable (ASM-010/011). M0 may produce throwaway code, but it stands up the trust harness and ratifies the tolerances/bound that everything downstream depends on. (PRD Sec 18, QUALITY_GATES Sec 7, TEST_STRATEGY Sec 11.)
2. **Single-thread CFR+ baseline before multi-thread, always.** Threading is an optimization on a correct base and must preserve correctness (a tested invariant: single == multi, NFR-004, ADR-003). The single-thread engine is built, tested, and trusted (Rings 1/2) before the threaded variant is added. GATE-B approved multi-thread in MVP but explicitly with single-thread as the mandatory fallback sequenced first.
3. **Risk-based front-loading.** The genuinely hard/risky work (Rust CFR+ engine, exploitability/best-response, the trust harness, the cache match logic, the memory budget) is pulled as early as possible. UI, persistence-CRUD, and Could-features are low-risk and sequenced behind the engine spine.
4. **Correctness over speed everywhere.** Performance is best-effort (NFR-001); latency is tracked/alerted, never a blocker. Correctness, cache-integrity, privacy, persistence, and resource-safety are hard gates.
5. **A thin vertical slice de-risks integration early.** After M0, the very first M1 work is one end-to-end path (configure -> cache-miss -> live solve -> grid -> save) so the worker boundary, ports, state, and rendering are integrated before breadth is added.

---

## 2. Milestone definitions, goals & EXIT CRITERIA

### M0 — Feasibility Spike (FORMAL GO/NO-GO) — FIRST, BLOCKS EVERYTHING

- **Goal:** prove the two existential bets before committing to the build: in-browser CFR+ viability, and the predefined-cache pipeline (generate -> bundle -> match -> fallback). Ratify the tractability bound (Q-001) and trust tolerances.
- **Tasks:** T-001..T-012.
- **Risk targeted:** RISK-001 (postflop infeasible), RISK-005 (engine complexity), RISK-004/014 (correctness/cache trust), RISK-003/010 (memory/OOM).
- **EXIT CRITERIA (GO requires ALL — QUALITY_GATES Sec 7):**
  - Ring 1 toy-game oracles (Kuhn, push/fold, zero-sum matrix) operational and passing on the prototype engine (T-006).
  - Engine produces a valid strategy (frequency sums == 1) on a real HU preflop spot through the WASM-in-worker path (T-007).
  - Determinism holds (same seed -> identical output); if a threaded prototype exists, a first parity check passes (T-007).
  - At least one Ring 3 reference benchmark spot (>=1 preflop, ideally +1 flop) measured and within tolerance or with a documented credible path (T-010).
  - Cache prototype demonstrates exact-key hit served (iterations:0), deliberate miss -> live fallback, corrupt-library -> disabled+fallback (T-009).
  - Tractability bound (Q-001/ADR-010) and tolerances ratified with measured backing (T-011).
  - In-browser CFR perf/memory + offline-gen+bundle+match feasibility demonstrated (validates ASM-001/002/010/011) (T-012).
- **NO-GO / RE-SCOPE if:** engine cannot reach acceptable exploitability in any in-browser-feasible budget; OR determinism/parity unachievable; OR cache cannot match/serve correctly; OR memory/bundle envelope infeasible. Escalate to Architect + Delivery + stakeholder; log in decision log.

### M1 — Preflop Live Solving, End-to-End

- **Goal:** a real, production-shaped preflop HU live solve, off-thread, with strategy grid + EV/equity + exploitability + result-source labeling + local persistence + preflop cache. Single-thread baseline hardened, then multi-thread parity proven.
- **Tasks:** T-100..T-172.
- **Risk targeted:** RISK-005, RISK-004, RISK-006 (threading), RISK-003/013 (storage), RISK-010 (OOM).
- **EXIT CRITERIA:**
  - `lookupOrSolve` hybrid flow correct: cache-hit instant (no solve loop, iterations:0) AND cache-miss live solve, both correctly source-labeled (AC-024/025/026, G4.*).
  - Preflop live solve produces a valid strategy (Ring 1/2 green) with EV/equity + honest exploitability estimate + abstraction/settings shown (AC-002/011/012/013).
  - Over-budget gating + OOM resilience + cooperative cancel + responsiveness (no long task > ~100ms) all green (AC-003/005/006, G5.*).
  - Persistence round-trip (save/reload/restart), quota/eviction comms, no partial/corrupt records (AC-016/017/018, G-PERS).
  - Privacy: zero compute/data egress; only static-asset GETs; `connect-src 'self'` (AC-001, G-PRIV).
  - Single-thread baseline fully tested; multi-thread variant builds and **passes parity** (single == multi, bit-exact target) with cross-origin-isolation matrix green (NFR-004/010, G3.3).
  - Tranche 1 preflop cache (100bb full tree + flop sample) shipped, reference-validated, stamped (G4.8).

### M2 — Predefined Cache Breadth + Trust Harness (Ring 3) + Reference Validation

- **Goal:** the full trust harness operational AND gating; cache broadened to all preflop depths; cache/live cross-source consistency proven; practice mode on cached/saved spots; perf/bundle harness live. This is the "approaching production-grade fidelity" milestone for preflop.
- **Tasks:** T-200..T-230.
- **Risk targeted:** RISK-004/014 (correctness/cache trust — the project's central risk).
- **EXIT CRITERIA:**
  - Ring 3 reference benchmark (all preflop depths) hard-green at ratified tolerances (G3.4).
  - Cache/live cross-source consistency hard-green (G3.5).
  - Every shipped predefined entry `referenceValidated === true` (G4.8).
  - Practice/drill mode: scoring correct, draws from predefined + saved, solution withheld until score, record persisted (AC-023/027, QO-6).
  - Perf/memory/bundle tracking + regression alerts live; bundle-size ceiling enforced (G5.4, G5a).

### M3 — Constrained Postflop (CONDITIONAL ON M0 = GO)

- **Goal:** bounded HU postflop live solving within the ratified tractability bound, plus the postflop cache tranche (the primary RISK-001 mitigation).
- **Tasks:** T-300..T-321.
- **Conditionality:** proceeds ONLY if M0 proved bounded in-browser postflop is viable. If M0 surfaced postflop as marginal, M3 is reduced to **cache-only postflop** (ship T-320/321, defer/limit live T-310/311) — a documented re-scope, not a failure.
- **EXIT CRITERIA:**
  - Bounded postflop live solve: valid strategy/EV/equity/exploitability within the bound; over-budget warns/blocks with suggestions (AC-015/006, G5.1/G5.3).
  - Board/runout + bet-sizing-tree config validated (AC-009/010).
  - Postflop cache tranche (SRP BTN vs BB 100bb canonical flops) shipped, reference-validated, board-isomorphism mapback correct (G4.2/G4.8).
  - Postflop Ring 3 + cache/live consistency green (G3.4/G3.5 postflop).

### M4 — Practice/UX Polish, PWA/Offline, Optional Extras, Release Readiness

- **Goal:** harden for personal use and ship: offline/PWA (with isolation preserved), unsupported-browser gate, GTO tooltips, a11y, Could-priority export/import, production deploy with approval + smoke + rollback.
- **Tasks:** T-400..T-432.
- **EXIT CRITERIA:**
  - Offline-after-first-load works incl. cross-origin-isolated context; unsupported-browser gate clear (AC-020/021).
  - GTO term tooltips present (AC-014); a11y scan triaged.
  - Export/import round-trips with import schema validation (AC-022) — or formally deferred as Could.
  - Production deploy to Cloudflare Pages with `production` approval gate + post-deploy COOP/COEP smoke + trivial re-promote rollback (DEVOPS Sec 8).
  - Full release gate green; SDET risk-based release recommendation (QUALITY_GATES Sec 8).

---

## 3. Quality-gate & approval-gate mapping onto milestones

| Milestone | Hard gates that must be green | Approval / formal gate |
|-----------|------------------------------|------------------------|
| M0 | G3.1 (toy oracles), G3.2 (self-consistency), cache hit/miss/fallback demo | **M0 go/no-go (human-confirmed)**; GATE-A reference-solver choice confirmed |
| M1 | G2.* (lint/type/build/unit/cov), G3.1/G3.2, **G3.3 (thread parity)**, G4.1-G4.7 (cache integrity), G5.1-G5.3/G5.5 (resource+responsiveness), G-PRIV, G-PERS, G4.8 (Tranche 1) | GATE-B (Cloudflare + multi-thread) already approved; confirmed live |
| M2 | **G3.4 (reference benchmark, now hard)**, **G3.5 (cache/live consistency)**, G4.8 (all entries), G5.4 (bundle ceiling), G5a (alerts) | Tolerances ratified (from M0) become hard |
| M3 | G3.4/G3.5 (postflop), G4.2 (board isomorphism), G5.1 (postflop memory budget), G4.8 (postflop tranche) | Conditional on M0 = GO |
| M4 | Cross-browser/isolation matrix, a11y triage, G-PRIV smoke (post-deploy), full Release gate (QUALITY_GATES Sec 8) | Production-deploy approval (`production` env reviewer) |

GATE-A/B/C (ADRs 001/009, 003/008, 006/007) are all APPROVED upstream; no further approval is required to start, except the per-release **production-deploy** human approval and the **M0 go/no-go** decision.

---

## 4. Critical path (dependency-ordered)

The critical path runs through the engine and the trust harness — the irreducible risk spine:

```
T-001 scaffold
  -> T-002 Rust crate (wasm + native)
    -> T-005 spike single-thread CFR+ core            [highest risk]
      -> T-006 Ring 1 toy oracles (engine gate)
        -> T-007 real preflop solve in worker (perf/mem measured)
          -> T-010 Ring 3 minimal reference benchmark
            -> T-011 ratify tractability bound + tolerances
              -> T-012 M0 GO/NO-GO  *** GATE ***
                -> T-100 domain core
                  -> T-110 production single-thread CFR+ engine
                    -> T-113/T-114 worker protocol + SolverEngine port
                      -> T-150/T-151 cache + lookupOrSolve
                        -> T-160/T-161 first-load shell + E2E (M1 vertical)
                          -> T-170/T-171 multi-thread variant + parity  *** correctness-preserving ***
                            -> T-200 full Ring 3 trust harness (M2)
                              -> T-310 postflop engine (M3, conditional on M0)
                                -> T-320 postflop cache tranche
                                  -> T-432 release gate (M4)
```

Everything not on this line (UI grids, persistence CRUD, practice mode, tooltips, export/import, PWA) is **off the critical path** and can be developed in parallel against the stable Domain types (DATA_MODEL) and the port interfaces (API_SPEC) using fakes.

---

## 5. Milestone / dependency map (ASCII)

```
            +----------------------------------------------------+
            |  M0 FEASIBILITY SPIKE (GO/NO-GO)  T-001..T-012      |
            |  engine spike + toy oracles + cache pipeline +     |
            |  ref benchmark + ratify bound/tolerances           |
            +-------------------------+--------------------------+
                                      | GO required
            +-------------------------v--------------------------+
            |  M1 PREFLOP END-TO-END  T-100..T-172               |
            |  domain core -> single-thread engine -> worker/    |
            |  ports -> cache+lookupOrSolve -> UI grids/EV/      |
            |  results -> persistence -> [then] multi-thread     |
            |  parity                                            |
            +------+--------------------------------+------------+
                   |                                |
   (parallel, ref-validated cache)        (trust harness hardened)
                   |                                |
            +------v-----------+            +-------v------------+
            | M2 CACHE BREADTH |            | M2 TRUST HARNESS   |
            | all preflop      |            | Ring3 + cross-     |
            | depths + PRACTICE|            | source + perf      |
            | T-200..T-230     |            | T-200/201/202/230  |
            +------+-----------+            +-------+------------+
                   |                                |
                   +---------------+----------------+
                                   | (M0=GO only)
            +----------------------v---------------------+
            |  M3 CONSTRAINED POSTFLOP  T-300..T-321      |
            |  postflop engine (bounded) + board/bet-tree |
            |  config + postflop cache tranche            |
            +----------------------+---------------------+
                                   |
            +----------------------v---------------------+
            |  M4 POLISH/PWA/EXTRAS/RELEASE T-400..T-432  |
            |  unsupported-gate, offline, tooltips, a11y, |
            |  export/import, deploy+approval+smoke+rollbk|
            +--------------------------------------------+
```

---

## 6. Risk-based sequencing (front-load highest feasibility risk)

| Pulled EARLY (high feasibility risk) | Why | Milestone |
|--------------------------------------|-----|-----------|
| Single-thread CFR+ core + best-response/exploitability (T-005, T-110) | The only genuinely hard component (RISK-005); correctness is the reason to exist (RISK-004) | M0/M1 |
| Ring 1 toy oracles (T-006) | Exact ground truth — proves the CFR+ machinery with certainty before anything builds on it | M0 |
| In-browser perf/memory measurement (T-007) | Validates ASM-001/002; sets the tractability bound; gates the whole postflop scope (RISK-001/003) | M0 |
| Cache generate->bundle->match->fallback (T-008/009) | Validates ASM-010/011; the primary RISK-001 mitigation | M0 |
| Ratify bound + tolerances (T-011) | Single-sources every correctness gate; placeholders are a hidden risk until measured | M0 |
| `lookupOrSolve` + budget gate (T-151, T-111) | The integration knot tying cache + engine + safety together | M1 |

| Deliberately DEFERRED (lower risk) | Why safe to defer |
|------------------------------------|-------------------|
| Multi-thread variant (T-170) | Speed-only optimization; single-thread is the mandatory baseline; correctness must precede it |
| Postflop (M3) | Conditional on M0; cache offloads the worst cases; bounded-live is additive |
| Practice/drill (T-220+) | Consumes already-known solutions; no new engine risk |
| Tooltips, export/import, a11y (M4) | Could/Should polish; do not affect the trust spine |

---

## 7. Parallelizable vs strictly serial

**Strictly serial (the spine):**
- T-002 -> T-005 -> T-006 -> T-007 -> T-010 -> T-011 -> T-012 (M0 gate).
- T-100 -> T-110 -> T-113/114 -> T-151 (engine/cache integration knot).
- Single-thread baseline (T-110..T-115) -> multi-thread (T-170) -> parity (T-171). **Never parallelize threading with baseline correctness.**

**Parallelizable once their deps land:**
- After T-100 (domain core): T-101 (validation), T-102 (lookup-key/isomorphism), T-103 (formatting), T-104 (equity/EV oracle), T-120/121 (range editor/spot config), T-140 (persistence) can all proceed in parallel — they only need the stable domain types.
- UI tracks (E2/E3 grids) parallel with the engine track (E1) because UI binds to State + Domain types, not to the engine directly (ARCHITECTURE Sec 4.1 — UI never calls the worker).
- Application-layer integration tests (T-152) use **port fakes**, so they can be written against API_SPEC before the real WASM engine is finished.
- Persistence (T-140..T-143) is fully independent of the engine and can be built any time after the domain core.
- M2 cache-breadth generation (T-210) and the trust-harness build (T-200) run in parallel.

---

## 8. Recommended FIRST vertical slice (thin end-to-end, to de-risk integration)

After M0 = GO, implement this **single thin path before adding breadth** — it exercises every architectural seam once:

> **"Configure a 100bb HU preflop spot -> cache MISS -> live solve in the worker -> render the strategy grid + exploitability + 'Live solve' label -> save to IndexedDB -> reload and retrieve."**

Concretely, the minimal task set for the first slice:
1. T-100 domain core types + T-101 validation (enough to build/validate one spot).
2. T-110 single-thread engine for one preflop tree + T-113/T-114 worker protocol + SolverEngine port.
3. T-111 estimateCost/budget gate (so the over-budget path exists from day one).
4. T-150 cache loader (returns a deliberate MISS for this slice) + T-151 `lookupOrSolve`.
5. T-121 spot config panel + T-120 range editor (minimal) + T-130 strategy grid + T-132 transparency banner.
6. T-140/T-141 persistence save/load for this one spot.
7. T-161 E2E proving the slice + no-network + responsiveness.

This slice proves the worker boundary, the ports, the hybrid flow's live branch, state streaming of progress, grid rendering, and persistence — i.e. it retires the integration risk before US-breadth (more positions, depths, cache hits, postflop) is layered on.

Why a cache-MISS slice first: it forces the **live engine + worker + budget gate + rendering** path (the hard integration) to work end-to-end. The cache-HIT path (T-153 tranche + T-152) is added immediately after, on the same proven rendering/labeling surface.

---

## 9. Phase view (condensed)

### Phase 1 — Prove it (M0)
- Goals: validate ASM-001/002/010/011; ratify bound + tolerances; stand up Ring 1.
- Tasks: T-001..T-012.
- Risks: RISK-001/004/005/014.
- Exit: M0 = GO (human-confirmed).

### Phase 2 — Build the preflop spine (M1)
- Goals: domain core, production single-thread engine, worker/ports, hybrid flow, UI, persistence, then multi-thread parity.
- Tasks: T-100..T-172 (first slice = Sec 8).
- Risks: RISK-005/006/004/013.
- Exit: M1 exit criteria (Sec 2).

### Phase 3 — Trust + breadth + practice (M2)
- Goals: full Ring 3 gating, cache/live consistency, all preflop depths, practice mode, perf harness.
- Tasks: T-200..T-230.
- Risks: RISK-004/014.
- Exit: M2 exit criteria.

### Phase 4 — Postflop (M3, conditional on M0)
- Goals: bounded postflop engine + config + postflop cache tranche.
- Tasks: T-300..T-321.
- Risks: RISK-001/003/010.
- Exit: M3 exit criteria (or documented cache-only re-scope).

### Phase 5 — Polish + ship (M4)
- Goals: offline/PWA, unsupported gate, tooltips, a11y, export/import, deploy + release gate.
- Tasks: T-400..T-432.
- Risks: RISK-013, RISK-006 (SW/COEP interaction).
- Exit: M4 exit criteria + release recommendation.

---

## 10. Delivery risks & mitigations (delivery-manager view)

| Risk | Type | Impact | Mitigation (sequencing lever) |
|------|------|--------|-------------------------------|
| M0 returns NO-GO on postflop | Scope | High | M3 designed as conditional; fallback = cache-only postflop; preflop MVP (M1/M2) still ships independent of postflop |
| CFR+ correctness slips (RISK-004/005) | Feasibility | High | Ring 1 oracles gate the engine before anything builds on it; engine is the serial critical-path head |
| Thread parity fails bit-exact (RISK-006) | Trust | Medium | Single-thread is the mandatory baseline; if parity needs a documented epsilon, single-source it; threading is speed-only and can ship later without blocking MVP |
| Tolerances unratified -> gates can't be hard | Quality | Medium | T-011 ratifies in M0; G3.4/G3.5 run WARN until ratified, then hard in M2 |
| Cache bundle size / memory envelope (RISK-003) | Resource | Medium | Bundle-size ceiling gate (G5.4) from M2; lazy shards + OPFS; heavy tranches generated locally (DEVOPS Sec 6.2) |
| Library generation time on CI runners | Delivery | Medium | Heavy tranches run locally on the Windows dev box and are committed; CI only does small/standard tranches (DEVOPS Sec 6.2) |
| Integration knot (`lookupOrSolve` + worker + budget) | Technical | Medium | Retired early by the thin first vertical slice (Sec 8) before breadth |
| SW/COEP interaction breaks isolation (RISK-006) | Reliability | Medium | PWA (T-401) designed with COEP together; E2E tests offline+isolated combination |

---

## 11. Open items folded into sequencing (non-blocking)

- **Q-001 (tractability bound)** — ratified in M0 (T-011); ADR-010 starter bound used until then.
- **Q-003 (multi-thread scope)** — RESOLVED: in MVP, single-thread first (GATE-B). Sequenced T-110 before T-170.
- **Q-007 (browser matrix)** — default Chromium+Firefox desktop assumption; broadened in M4 (T-402); low stakes for single user.
- **Q-009 (product name)** — placeholder "ClearSolve"; no delivery impact.
- **Q-010 (cache coverage list)** — Architect's proposed coverage (ARCHITECTURE Sec 18) drives Tranche 1/2/3; refined as fixtures are generated.
- **GATE-A reference solver** — confirmed in M0 (T-010, SDET co-owns) so Ring 3 fixtures have a definitive source.

---

## 12. First implementation tasks (once implementation is approved)

In strict order:
1. **T-001** — repo scaffold (engine/, frontend/, tools/, `_headers`, `.env.example`).
2. **T-002** — Rust crate compiling to BOTH wasm + native (the shared-core foundation).
3. **T-004** — minimal CI (build WASM once, cargo/tsc/vite, aggregated gate).
4. **T-003** — Vite+React+TS shell instantiating WASM in a Web Worker with COOP/COEP dev headers.
5. **T-005** — spike single-thread CFR+ core (the critical-path head; highest risk).
6. **T-006** — Ring 1 toy oracles (the engine gate).

These six get M0 to the point where the feasibility data (T-007), reference benchmark (T-010), and tolerance ratification (T-011) can produce the **M0 go/no-go decision (T-012)** — the gate that authorizes the full build.
