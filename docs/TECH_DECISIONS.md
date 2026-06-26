# Technical Decisions (ADRs) — Personal Browser-Native NLHE GTO Solver

> Owner: Software Architect Agent
> Last Updated: 2026-06-24
> Status: DRAFT for stakeholder review. Items marked **APPROVAL GATE** require explicit stakeholder sign-off (see final section).
> Cross-references: `PRD.md` (CON-*, REQ-*, NFR-*, DEP-*, Q-*), `ARCHITECTURE.md`, `RISKS.md`.

Each ADR follows: Decision / Context / Options Considered / Chosen Option / Pros / Cons / Risks / Follow-Up.

---

## ADR-001: WASM source language & toolchain for the solver engine

### Decision
Implement the solver engine in **Rust, compiled to WebAssembly via `wasm-bindgen` + `wasm-pack`**, with the engine kept as a pure Rust crate (no DOM coupling) behind a thin JS/TS binding.

### Context
The engine is the only genuinely hard component (RISK-005) and the stakeholder demands production-class solve **quality** (CON-1, NFR-005). The language choice drives performance, memory control, threading story, ecosystem (poker/CFR/equity libraries), and dev velocity (DEP-001).

### Options Considered

#### Option 1 — Rust + wasm-bindgen/wasm-pack
Pros:
- Excellent WASM story: first-class target, small/fast output, `wasm-bindgen` ergonomics, mature tooling.
- Manual memory control with safety -> critical for the f32 accumulator strategy and predictable memory budget (RISK-003/010, ARCHITECTURE Sec 9).
- **Threading** via `wasm-bindgen-rayon` / wasm threads + `SharedArrayBuffer` is well-trodden (ADR-003, RISK-006).
- **SIMD** via portable SIMD / target features for the inner CFR loops (future speed).
- Strong existing ecosystem for poker/equity and even open CFR references in Rust (can seed the offline pipeline and the in-browser engine from shared logic).
- Determinism is straightforward (NFR-004).
Cons:
- Steeper language ramp than TS if the team lacks Rust; CFR correctness work is still specialized.

#### Option 2 — C/C++ + Emscripten
Pros:
- The most battle-tested high-performance solvers are C/C++; could port/learn from existing engines; Emscripten threads/SIMD are mature.
Cons:
- Memory-safety burden and harder, more error-prone build/glue; Emscripten toolchain heavier and less ergonomic for JS interop than wasm-bindgen.
- Higher risk of subtle UB bugs undermining correctness/trust (RISK-004).

#### Option 3 — AssemblyScript
Pros:
- TS-like syntax; lowest ramp for a TS team; single-language repo.
Cons:
- Not a true high-performance systems language; GC and weaker optimization make it a poor fit for a quality-first CFR engine; thin ecosystem (no serious CFR/poker libs). Directly conflicts with the quality steer. Rejected.

### Chosen Option
**Option 1 — Rust + wasm-bindgen/wasm-pack.**

### Pros
Best balance of performance, memory control, threading/SIMD, determinism, and ecosystem for a quality-first engine; lets the **same Rust core** be reused (compiled natively) in the **offline generation pipeline** (ADR-009), so cache and live engine share validated logic.

### Cons
Rust ramp-up cost; CFR implementation remains the hardest task regardless of language.

### Risks
RISK-005 (build complexity) — mitigated by the M0 spike and a shared native/WASM core. RISK-006 (threading) handled in ADR-003.

### Follow-Up Actions
- M0 spike: Rust CFR prototype -> WASM; measure preflop solve quality/time/memory.
- Decide whether to seed from an existing open Rust CFR/poker crate (licensing review).
- **APPROVAL GATE:** adopting a specific third-party CFR/poker crate as a core dependency (see gates).

---

## ADR-002: CFR algorithm variant & abstraction strategy

### Decision
Use **CFR+ as the primary algorithm**, with **Discounted CFR (DCFR) parameters available as a tuning option**, and **vanilla CFR retained only as a reference/validation oracle**. Abstraction = **bounded bet-sizing trees** (always) plus **optional card/board bucketing** (postflop, only when needed to fit the budget). MCCFR is **not** used for the in-browser path in MVP.

### Context
Algorithm choice directly determines convergence speed and final exploitability for a given iteration/memory budget — i.e. **quality** (NFR-005, RISK-004, stakeholder steer). Abstraction is the lever that makes postflop fit in-browser (RISK-001/003).

### Options Considered

#### Vanilla CFR
Pros: simplest, well-understood, exact regret matching — ideal as a correctness oracle.
Cons: slowest convergence; needs many more iterations for a target exploitability -> worse quality per time/memory budget. Not the primary.

#### CFR+ (regret-matching+ with non-negative regret flooring + linear averaging)
Pros: substantially faster, lower exploitability per iteration than vanilla; non-negative regret clamping also reduces memory pressure and is what production-class solvers use; deterministic. Best fit for quality-first in-browser solving.
Cons: a little more implementation nuance (weighted averaging, alternating updates).

#### Discounted/Linear CFR (DCFR)
Pros: strong convergence; tunable discounting of early regrets; competitive with/sometimes better than CFR+ on some trees.
Cons: extra hyperparameters to tune; benefits are spot-dependent.

#### Monte Carlo CFR (MCCFR)
Pros: per-iteration cost is far lower (samples the tree) -> attractive for very large trees / memory-limited settings.
Cons: introduces **variance/stochasticity**, complicating determinism (NFR-004) and the honest exploitability report; converges noisily; for the **bounded** trees we allow in-browser, deterministic CFR+ over the full (small) tree gives cleaner, more trustworthy results. Reserve MCCFR as a future option for larger trees.

### Chosen Option
**CFR+ primary, DCFR as a tunable variant, vanilla CFR as the validation oracle.** Abstraction: mandatory bounded bet-sizing trees; optional postflop card bucketing.

### Pros
Best exploitability-per-budget for a deterministic, trustworthy engine; matches the algorithm family used by production solvers (supports the quality steer); deterministic output (NFR-004); vanilla-as-oracle strengthens the correctness gate (RISK-004).

### Cons
CFR+ over a full bounded tree limits in-browser tree size more than sampling would — accepted, because the **cache** carries the large spots (RISK-001) and determinism/trust are prioritized.

### Risks
RISK-001/003 (tree size) — bounded by Q-001 bound + abstraction + cache offload. RISK-004 — mitigated by oracle + reference benchmark.

### Follow-Up Actions
- M0 spike to fix CFR+ vs DCFR default by measured exploitability/time on benchmark spots.
- Define the abstraction profiles (`abstractionId`) and the Q-001 tractability bound (ARCHITECTURE Sec 9).
- Offline pipeline (ADR-009) may run far more iterations / finer abstraction than the in-browser path for cache quality.

---

## ADR-003: Single- vs multi-threaded WASM (Web Workers, wasm threads, SharedArrayBuffer, COOP/COEP)

### Decision
**Ship a single-threaded WASM engine as the guaranteed baseline, plus an optional multi-threaded WASM engine variant** (`SharedArrayBuffer` + wasm thread pool). Select at runtime via feature detection (`crossOriginIsolated`). Both run identical CFR+ and converge identically given the same seed (NFR-004). The solver always runs in a dedicated **Web Worker** regardless of threading (REQ-002, NFR-002, AC-003).

### Context
Multithreading is the biggest in-browser speed lever but requires **cross-origin isolation** (COOP/COEP), which constrains hosting (RISK-006, NFR-010, ASM-005, DEP-003, Q-003). Performance is best-effort (NFR-001), so threading is an optimization, not a requirement.

### Options Considered

#### Single-thread only
Pros: works on every static host (incl. GitHub Pages) with zero header config; simplest; no SAB/Spectre concerns.
Cons: slower live solves on multicore machines.

#### Multi-thread only
Pros: best performance.
Cons: hard dependency on COOP/COEP isolation; breaks on hosts/contexts that cannot set headers; SAB availability varies; would block the app where isolation is unavailable. Too brittle as the sole path.

#### Both, runtime-selected (chosen)
Pros: universal baseline + opportunistic speedup; satisfies NFR-010 fallback exactly; decouples correctness from environment.
Cons: must build/ship two engine variants and feature-detect; slightly more build/test surface.

### Chosen Option
**Both, runtime-selected**, with the worker boundary constant.

### Pros
Robust everywhere; uses cores when isolated; honest fallback; threading never affects correctness/trust (NFR-004). Aligns with Q-003 ("single-thread MVP first, threading as enhancement").

### Cons
Two engine builds; threading testing on isolated vs non-isolated contexts.

### Risks
RISK-006 — fully mitigated by baseline fallback. Memory: a threaded engine's `SharedArrayBuffer` is fixed-size, which makes the memory budget a hard cap (good for RISK-010).

### Follow-Up Actions
- MVP: ship/validate single-thread first; add the threaded variant once hosting headers (ADR-008) are confirmed.
- Service Worker + COEP interaction must be designed together (offline + isolation).

---

## ADR-004: Frontend framework + build tool + language

### Decision
**React + TypeScript, built with Vite.** TypeScript everywhere (UI, domain, worker glue).

### Context
Need a productive SPA stack with strong typing (shared domain types across UI/worker/cache/persistence — ARCHITECTURE Sec 1.2), first-class WASM/Worker support, and good charting/grid ecosystem for the 13x13 grid and EV/equity views (DEP-004). Single user, single developer-friendly.

### Options Considered

#### React + TS + Vite (chosen)
Pros: largest ecosystem (grids, charts, tooltips), strongest hiring/AI-assist familiarity, excellent Vite WASM/worker support (`?worker`, top-level await, COOP/COEP dev headers), mature TS integration. Lowest delivery risk.
Cons: slightly heavier runtime than Svelte/Solid (irrelevant here — the bottleneck is the WASM worker, not the view layer).

#### Svelte / SvelteKit
Pros: minimal runtime, ergonomic.
Cons: smaller ecosystem for dense data-grid/charting; SvelteKit's SSR features are unused (we're static-only).

#### Vue
Pros: solid, good DX.
Cons: no decisive advantage over React here; smaller solver-relevant ecosystem.

#### Solid
Pros: very fast, fine-grained reactivity.
Cons: smaller ecosystem/community; higher risk for a niche-but-UI-heavy app.

### Chosen Option
**React + TypeScript + Vite.**

### Pros
Lowest-risk, best-supported path; TS gives end-to-end type safety for the domain model and the worker message protocol (API_SPEC); Vite handles WASM/worker bundling and dev-time COOP/COEP headers cleanly.

### Cons
Marginally larger view runtime (immaterial vs the WASM engine).

### Risks
None material. View perf is a non-issue (compute is off-thread, NFR-002).

### Follow-Up Actions
- Pick a 13x13 grid approach (custom CSS grid recommended over a heavy data-grid lib) and a lightweight charts lib for EV/equity.

---

## ADR-005: State management

### Decision
**Zustand** (lightweight store) for global app state, with **TanStack Query** used only for async-resource lifecycle around cache/persistence reads where its caching/状态 helps; local component state for ephemeral UI.

### Context
State needs (ARCHITECTURE Sec 4.2): spot draft, solve session (streaming progress from worker), displayed result, library status, saved-items list, settings, storage snapshot. Must integrate streaming worker events cleanly and stay simple for a single-user app.

### Options Considered

#### Zustand (chosen for global state)
Pros: minimal boilerplate, no context-provider ceremony, easy to push streaming worker progress into the store, trivially testable (plain functions), works great with React + TS.
Cons: less opinionated structure (acceptable at this scale).

#### Redux Toolkit
Pros: structured, devtools, time-travel.
Cons: more ceremony than warranted for a single-user app; overkill.

#### Plain React Context + reducers
Pros: zero deps.
Cons: re-render/perf footguns with frequent solve-progress updates; more wiring.

### Chosen Option
**Zustand for global state; TanStack Query for async cache/persistence resource management; local state for ephemeral UI.**

### Pros
Right-sized; clean handling of high-frequency solve-progress updates (throttled into the store); highly testable; minimal deps.

### Cons
Two state tools (Zustand + Query) — kept to clearly separated concerns.

### Risks
Low. Progress-update churn mitigated by throttling worker progress events (AC-004) before they hit the store.

### Follow-Up Actions
- Define store slices; throttle worker progress to ~5-10 Hz to protect render (NFR-002).

---

## ADR-006: Client-side persistence (IndexedDB vs OPFS) & predefined-solution storage format

### Decision
**Hybrid storage:** **IndexedDB** (via the `idb` wrapper) for structured records (saved spots, results metadata, drill records, settings, library meta); **OPFS (Origin Private File System)** for large binary blobs (oversized result payloads, cached library shards). Predefined solutions are shipped as **compressed binary shards + a small JSON/binary index** (ADR-007). **APPROVAL GATE** (persistence strategy).

### Context
Need durable local storage (CON-2, REQ-009, NFR-006/007) for structured data AND efficient handling of large binary library/result data without bloating IndexedDB (RISK-003/013). Storage choice affects quota, performance, and eviction behavior (ASM-004).

### Options Considered

#### IndexedDB only
Pros: ubiquitous, structured queries, transactions, well-understood.
Cons: storing many large binary blobs in IndexedDB is heavier and slower than file I/O; less ideal for big shards.

#### OPFS only
Pros: fast file-like binary I/O, great for large shards/blobs.
Cons: no structured query/index; awkward for many small structured records (saved spots, drills).

#### Hybrid IndexedDB + OPFS (chosen)
Pros: each store used for its strength — structured records in IDB, big binaries in OPFS; keeps IDB lean (better for quota/eviction); fast shard caching.
Cons: two stores to manage/migrate; OPFS support is slightly less universal (graceful fallback: keep blobs in IDB where OPFS absent).

### Chosen Option
**Hybrid IndexedDB + OPFS**, with an OPFS-absent fallback to IDB blobs.

### Pros
Best fit for mixed structured/binary data; keeps the small-record store lean for reliability and quota headroom; efficient library-shard caching for offline (FEAT-011).

### Cons
More moving parts; requires a clean `PersistenceStore` port to hide the split (it does — API_SPEC Sec 5).

### Risks
RISK-003/013 (quota/eviction) — mitigated by `navigator.storage.persist()`, quota surfacing (AC-018), export/import (FEAT-014). RISK-013 — OPFS is also subject to eviction; export remains the durable backup.

### Follow-Up Actions
- Define IDB object stores + indexes and OPFS directory layout (DATA_MODEL "Persistence Layout").
- Implement schema-version migration + version-mismatch warnings (EDGE-008).

---

## ADR-007: Predefined-solution bundle format

### Decision
**Two-tier static assets:** a small **eager index** (lookup-key -> shard/offset + generation metadata) and multiple **lazily-loaded, compressed binary shards** holding strategy payloads. Strategy payloads use a **compact columnar binary encoding** (quantized frequencies, e.g. 8-16 bit per action), gzip/Brotli-compressed at rest, decoded on demand. Versioned with an integrity/format header.

### Context
The library can be large (RISK-003); it must load fast, cache offline (FEAT-011), match exactly (BR-008), and pass integrity checks (NFR-011, EDGE-010). Bundle-size discipline is explicit (RISK-003 mitigation).

### Options Considered
- **One big JSON file:** simple but huge, slow to parse, no lazy loading, poor for bundle size. Rejected.
- **Per-spot JSON files:** lazy but huge file-count overhead and weak compression. Rejected.
- **Two-tier index + compressed binary shards (chosen):** small eager index for instant lookup; shards fetched/cached only when needed; tight compression; fast typed-array decode.

### Chosen Option
**Two-tier index + compressed binary shards** with quantized strategy encoding.

### Pros
Small initial load, lazy on-demand shards (RISK-003), fast decode, integrity-versioned (NFR-011), OPFS-cacheable for offline (FEAT-011).

### Cons
Requires a defined binary schema + decoder + offline encoder; quantization introduces tiny rounding (kept well within display/trust tolerance and validated, RISK-004/014).

### Risks
RISK-014 (staleness/mismatch) — version + integrity header, exact-key match, recorded generation settings.

### Follow-Up Actions
- Specify the binary schema + quantization bits (DATA_MODEL).
- Decide gzip vs Brotli per host capability.

---

## ADR-008: Hosting / deployment target & cross-origin isolation

### Decision
**Deploy to Cloudflare Pages (preferred) or Netlify** — static hosts that support custom response headers, so COOP/COEP cross-origin isolation can be enabled to unlock multi-threaded WASM (ADR-003). Keep single-thread as the universal fallback. **APPROVAL GATE** (deployment strategy).

### Context
CON-2 requires static hosting. Threading requires COOP/COEP headers (NFR-010, RISK-006, ASM-005, DEP-003, Q-003). **GitHub Pages cannot set custom headers** (no native cross-origin isolation; only a fragile Service-Worker COEP shim). Netlify/Vercel/Cloudflare Pages can set headers.

### Options Considered

#### GitHub Pages
Pros: free, dead-simple, git-native.
Cons: cannot set COOP/COEP headers natively -> no reliable cross-origin isolation -> single-thread only (or a brittle SW shim). Acceptable only if threading is dropped.

#### Netlify
Pros: free tier, easy `_headers`/`netlify.toml` for COOP/COEP, good DX.
Cons: vendor; build-minute limits (immaterial at this scale).

#### Vercel
Pros: easy headers config, strong DX.
Cons: vendor; positioning toward serverless we don't need.

#### Cloudflare Pages (preferred)
Pros: free tier, `_headers` file for COOP/COEP, excellent CDN/edge caching for shards, generous limits, good static-asset story.
Cons: vendor.

### Chosen Option
**Cloudflare Pages (preferred), Netlify acceptable alternative.** Single-thread fallback means even GitHub Pages would *function* (degraded) if required.

### Pros
Enables cross-origin isolation -> threading speedup; great CDN for lazy shard delivery; free for personal use; supports the Service-Worker offline strategy.

### Cons
Vendor choice; header config must be paired with the Service Worker (COEP) design.

### Risks
RISK-006 — chosen host explicitly supports the required headers; baseline single-thread removes hard dependency.

### Follow-Up Actions
- **APPROVAL GATE:** confirm host + whether threading (and thus COOP/COEP) is in MVP or deferred (Q-003).
- Define `_headers` (COOP/COEP) + Service Worker caching together.

---

## ADR-009: Offline predefined-solution generation pipeline (build-time tooling)

### Decision
A **build-time/offline generation pipeline** (Node-orchestrated, invoking the **same Rust solver core compiled natively**, ADR-001) that solves the Q-010 coverage spots at **high iteration counts / finer abstraction** than the in-browser engine, measures each entry's exploitability (best-response), **validates against a reference solver** on a benchmark subset (M2), encodes entries to the ADR-007 binary shards + index, and stamps generation settings/version. Runs offline only; never ships in the app.

### Context
ASM-010/011: cache quality depends on an offline process that can use more compute than the browser (the core quality lever per the stakeholder steer). RISK-014/RISK-004 require validated, provenance-stamped entries.

### Options Considered
- **Reuse the Rust core natively (chosen):** identical solving logic to the live engine, no second implementation to keep correct; native build removes browser limits so cache quality can approach production. 
- **Use an external desktop solver (e.g. an open solver) to generate entries:** higher absolute quality and serves as the reference oracle, but a second toolchain/format and integration cost. **Use it as the validation reference** (M2) rather than the primary generator, while keeping the option open if the Rust core's quality is insufficient.
- **Hand-curated entries:** not scalable, error-prone. Rejected.

### Chosen Option
**Rust-core native generation as primary; external reference solver as the validation oracle** (and a fallback generator if needed — flag as a potential approval-gate dependency if an external solver becomes a core dependency).

### Pros
Single source of solving truth (shared core), high-quality offline output, built-in validation, reproducible/versioned shards.

### Cons
Generation compute time offline (acceptable, not user-facing); pipeline is its own deliverable to build/test.

### Risks
RISK-014 (quality/staleness) — validation gate + version stamping. If Rust-core quality lags production solvers, escalate to external-solver generation (approval gate).

### Follow-Up Actions
- Build the pipeline + benchmark harness early (supports M0/M2).
- Decide the reference solver for validation (SDET co-owns).

---

## ADR-010: Live tractability bound (Q-001) — proposed default

### Decision
Adopt a **starter tractability bound** (to be tuned by the M0 spike): HU only; single board; live postflop limited to **<= 2 solved streets, <= 2-3 bet sizes/node, single raise size, standard-width ranges**; worst-in-bound info-set count sized to fit the memory budget at f32 with margin (ARCHITECTURE Sec 9). Heavier spots are **cache-only**.

### Context
Q-001 is open; a concrete starting bound is needed to design the budget gate (REQ-010, AC-006) and to define what is live vs cache-only (RISK-001/003/010).

### Options Considered
- No bound (let users crash tabs): violates REQ-010/BR-006. Rejected.
- Very tight bound (preflop-only live): safest but reduces the "real solver" value for novel postflop. 
- Moderate bound (chosen): meaningful novel postflop within a safe memory envelope, with the cache covering the big spots.

### Chosen Option
**Moderate, spike-tuned bound** as above.

### Pros
Delivers genuine novel-spot solving while protecting the device; complements the cache.

### Cons
Some desirable spots will be cache-only or blocked (RISK-009) — mitigated by transparency + cache coverage.

### Risks
RISK-001/003/010 — directly bounded by this decision; numbers validated in M0.

### Follow-Up Actions
- M0 spike sets final numbers; document the bound in-app (AC-013/006).

---

## ADR-011: The E1/E2 two-effective-player model (the trustworthy multiway-config solve)

### Decision
For the near-term scope-expansion milestones (**E1/E2**), model any table configuration (tableSize 2-9, cash) as a genuinely **2-player zero-sum game** by **reducing the table to hero vs a single relevant opponent**: RFI = hero vs the collapsed remaining field as one opponent; facing a raise/3-bet/4-bet = hero vs the last aggressor. The existing 2-player CFR+ engine (`betTree.ts` + `preflopCfr.ts`) is reused unchanged; the generalization lives in a pure-domain **projection** `projectToBetTreeConfig(SpotConfigV2)`. Label these results **`live-solve`** with `fieldModel='collapsed-2p'`, honestly captioned as a labeled approximation (not multiway GTO).

### Context
Multiway (3+) is general-sum: no unique equilibrium, exploitability-as-trust breaks (RISK-multiway). To ship a **trustworthy live** deliverable near-term without lying about fidelity, we keep the *solved game* zero-sum. Preflop chart trainers universally use this "hero vs field / vs raiser" reduction; it is well-understood and honest when labeled.

### Options Considered
- **(chosen) 2-effective-player reduction** — zero-sum, trustworthy, reuses the entire existing engine; the multiway aspect is a documented, labeled approximation.
- **Full multiway live solve now** — general-sum, no unique equilibrium, no valid exploitability metric; would force us to either mislabel it "GTO" (forbidden) or ship an unlabeled estimate. Rejected for the trustworthy core; deferred to E4 as a labeled estimate.
- **Preflop charts only (no live)** — safe but loses the "real solver" value for off-grid table configs. Rejected.

### Chosen Option
**2-effective-player reduction for E1/E2**, full multiway composite-field as a separate **estimate** at E4.

### Pros
Reuses the validated CFR core verbatim; every E1/E2 result is an exact equilibrium of its (zero-sum) model with a real exploitability estimate; smallest possible new surface (one projection fn + one engine mode).

### Cons
The reduction is an approximation of the true multiway table (field collapsed); must be clearly labeled to stay honest.

### Risks
Mislabeling risk — mitigated by the mandatory `TrustInfo` caption and a test asserting "exact GTO" never appears. Fidelity-gap risk — mitigated by explicit captioning and the E4 composite-field/chart path for higher-fidelity needs.

### Follow-Up Actions
- Implement `seatLayout`, `projectToBetTreeConfig`, and the action-label mapping (DATA_MODEL 13.1.1/13.4/13.9) as unit-tested pure functions.
- Wire the `preflop-spot` engine mode and bump protocol to v3.

---

## ADR-012: Multiway model & equilibrium-selection convention (general-sum caveat)

### Decision
Deliver multiway (3+) via **precomputed, convention-selected charts** (primary) plus an optional **live hero-vs-composite-field estimate** (off-grid). Because multiway is **general-sum with no unique equilibrium**, each chart bakes **one** answer chosen by a fixed, documented **equilibrium-selection convention** (e.g. deterministic tie-breaking / a fixed solver configuration + seed), recorded per entry as `equilibriumConvention`. Live multiway output is always labeled **`estimate-composite`**, never GTO.

### Context
Multiway equilibria are non-unique and exploitability is not a valid trust metric (the core honesty problem of the scope expansion). We cannot present a single "the GTO answer"; we can present *one validated, reproducible, convention-pinned* answer and say exactly how it was selected.

### Options Considered
- **(chosen) Convention-selected charts + labeled live estimate** — honest, reproducible, validated offline; cache carries the trustworthy version, live covers off-grid as an explicit estimate.
- **Live multiway "GTO" solve** — forbidden by the honesty policy (general-sum; would mislabel). Rejected.
- **No multiway** — contradicts the approved scope expansion. Rejected.

### Chosen Option
Convention-selected precomputed charts (primary) + composite-field live estimate (off-grid), both gated by **SPK-MW**.

### Pros
Honest about general-sum non-uniqueness; reproducible (convention + seed recorded); reuses the cache and the 2-player CFR core (composite field is a 2-player computation); coverage grows offline.

### Cons
Charts represent a *choice* among equilibria, not "the" equilibrium — must be surfaced. Composite-field estimate quality is uncertain until SPK-MW passes.

### Risks
Estimate-quality / instability risk — gated by SPK-MW (go/no-go). Convention-opacity risk — mitigated by recording `equilibriumConvention` and surfacing it in the UI.

### Follow-Up Actions
- Define the concrete equilibrium-selection convention (e.g. `uniform-tiebreak-v1`) in the offline pipeline.
- Run SPK-MW before shipping any multiway live estimate.

---

## ADR-013: ICM model choice (tournament leaf transform)

### Decision
Implement tournament/ICM as a **leaf-valuation transform** on the **unchanged** bet tree: terminal post-hand stacks for all seats → prize-equity via **Malmuth-Harville ICM** (`IcmContext.model='malmuth-harville'`). Cash = identity transform (chip-EV). Tournament delivery prefers **precomputed charts**; live use is an off-grid **`estimate-icm`**. **Gated on SPK-ICM** and sequenced **after** cash multiway (cash-multiway-first).

### Context
ICM is a non-linear payoff transform requiring the full payout structure and all players' stacks. It changes the *objective* (maximize prize-equity, not chips) but not the *tree*. Malmuth-Harville is the de-facto standard ICM model with abundant reference implementations to validate against.

### Options Considered
- **(chosen) Malmuth-Harville leaf transform** — standard, validatable against reference ICM calculators, plugs into the existing tree with no solver rewrite.
- **Malmuth-Weitzman / future-game ICM** — more accurate in some spots but heavier and less universally referenced. Kept as a future `model` option.
- **No ICM** — contradicts approved scope. Rejected.

### Chosen Option
Malmuth-Harville as a pluggable `IcmTransform`; future models behind the same `model` discriminator.

### Pros
Minimal solver change (leaf swap only); standard model; directly validatable (SPK-ICM); reuses the entire tree/CFR machinery.

### Cons
ICM correctness is subtle (numeric edge cases, ties, short stacks) — must be spike-validated. Large payout/stack space favors precomputed charts over live.

### Risks
Correctness risk — **SPK-ICM** validates per-seat equity ≤0.1% prize-pool vs a reference calculator before E3 ships. Scope-creep risk — ICM strictly sequenced after cash multiway.

### Follow-Up Actions
- Build `IcmTransform` as a pure, unit-tested domain fn; run SPK-ICM.
- Define payout-structure ids + stack-distribution buckets for the chart key (`icmKey`).

---

## ADR-014: Deep-stack abstraction (200-1000bb)

### Decision
Bound deep-stack bet trees with **`AbstractionCaps`**: `maxRaiseRounds` (beyond which only fold/call/all-in), `maxSizesPerNode` (1-2 non-all-in sizes), and `stackBuckets` for cache keying/chart selection. Oversized raises clamp to all-in (existing `betTree` rule). **Gated on SPK-DEEP.**

### Context
Stack depth multiplies the number of raise rounds before all-in; a full-resolution deep tree blows up memory/time (RISK-003/010). We need finite, budget-fitting trees at any depth.

### Options Considered
- **(chosen) Caps + stack buckets** — finite tree at any depth, predictable memory, reuses the clamp rule.
- **Full-resolution deep live solve** — intractable in-browser. Rejected (heavy depths are chart-only if needed).
- **Single all-in/fold model for deep** — too coarse, loses the value of deep play. Rejected.

### Chosen Option
Moderate caps (M0/SPK-DEEP-tuned), with stack-bucket quantization for cache/charts.

### Pros
Tractable at 200-1000bb; predictable memory (Sec 9); reuses existing clamp/tree logic; bucketization improves cache coverage.

### Cons
Abstraction error grows with depth — surfaced via the in-abstraction exploitability caveat (ARCHITECTURE Sec 8).

### Risks
Tractability/quality risk — **SPK-DEEP** validates worst-in-bound tree fits the budget and in-abstraction exploitability stays low before deep depths ship.

### Follow-Up Actions
- Set concrete `maxRaiseRounds` / `stackBuckets` from SPK-DEEP.

---

## ADR-015: Activating the offline generation pipeline for charts (multiway/ICM/deep)

### Decision
**Activate the ADR-009 offline pipeline** as the primary delivery mechanism for multiway, tournament/ICM, and deep-stack solutions: generate convention-selected (ADR-012) / ICM-transformed (ADR-013) / depth-bucketed (ADR-014) charts offline, validate them (reference solver / reference ICM calculator), stamp provenance (`PredefinedChartMeta`), encode to the existing shard format (ADR-007), and serve via the existing cache with the extended lookup key (DATA_MODEL 13.8).

### Context
Per Option 1, multiway/ICM are delivered primarily as **precomputed charts** (the only honest way to ship a single, validated, reproducible answer for general-sum / expensive-transform regimes). This makes the offline pipeline a first-class, near-term deliverable rather than a future nicety.

### Options Considered
- **(chosen) Offline-generated charts via the existing pipeline + cache** — reuses ADR-007/009 infrastructure; no new runtime machinery; coverage grows by shipping shards.
- **Live-only multiway/ICM** — forbidden (Option 1) / intractable. Rejected.
- **A second, separate chart system** — duplicative; rejected in favor of extending the one cache.

### Chosen Option
Extend and activate the existing offline pipeline + two-tier cache for charts; key extension only.

### Pros
Single source of solving/serving truth; validated, provenance-stamped, reproducible charts; coverage scales offline with zero app changes beyond shipped shards.

### Cons
Offline generation compute (acceptable, not user-facing); pipeline must implement the equilibrium convention and the ICM transform.

### Risks
Quality/staleness — version + integrity + validation gates (RISK-014); convention/transform correctness gated by SPK-MW / SPK-ICM.

### Follow-Up Actions
- Extend the generator to emit multiway/ICM/deep charts and the extended index key.
- Wire `PredefinedChartMeta` (equilibriumConvention, fieldAssumptions, trustLabel).

---

## Summary of Key Decisions

| ADR | Area | Decision |
|-----|------|----------|
| 001 | WASM language/toolchain | **Rust + wasm-bindgen/wasm-pack** |
| 002 | CFR variant & abstraction | **CFR+ primary** (DCFR optional, vanilla = oracle); bounded bet trees + optional bucketing; no in-browser MCCFR (MVP) |
| 003 | Threading | **Single-thread baseline + optional runtime-detected multi-thread**; always in a Web Worker |
| 004 | Frontend | **React + TypeScript + Vite** |
| 005 | State | **Zustand** (+ TanStack Query for async resources) |
| 006 | Persistence | **Hybrid IndexedDB + OPFS** (approval gate) |
| 007 | Cache bundle format | **Two-tier index + compressed binary shards**, quantized strategies |
| 008 | Hosting | **Cloudflare Pages / Netlify** with COOP/COEP (approval gate) |
| 009 | Offline generation | **Shared Rust core native pipeline**; external solver = validation oracle |
| 010 | Tractability bound | **Moderate, M0-tuned**; heavy spots cache-only |
| 011 | E1/E2 2-effective-player model | **Reduce any table config to hero-vs-single-opponent**; reuse 2p CFR+ verbatim; `live-solve` |
| 012 | Multiway model & equilibrium selection | **Convention-selected precomputed charts + labeled composite-field live estimate**; general-sum, never "GTO"; gated SPK-MW |
| 013 | ICM model | **Malmuth-Harville leaf transform** on the unchanged tree; charts-first; gated SPK-ICM; after cash multiway |
| 014 | Deep-stack abstraction | **`AbstractionCaps`** (max raise rounds / sizes) + **stack buckets**; clamp to all-in; gated SPK-DEEP |
| 015 | Offline pipeline activation | **Activate ADR-009 pipeline** to generate multiway/ICM/deep charts into the existing cache (extended key) |

---

## APPROVAL GATES — ✅ ALL APPROVED BY STAKEHOLDER (2026-06-24)

Per the Architect operating rules, the following are major-dependency / deployment / persistence-strategy decisions that needed stakeholder approval before commitment. All three were approved on 2026-06-24.

1. **GATE-A — Solver toolchain & a core CFR/poker dependency (ADR-001/ADR-009).** ✅ **APPROVED AS PROPOSED.**
   - Decision: Rust + wasm-bindgen, and (if adopted) a specific open-source CFR/poker/equity crate as a *core* dependency, plus the choice of an external reference solver for validation.
   - Reason: a core engine dependency and its license are foundational and hard to reverse.
   - Approved: Rust core; adopt an open crate only after a licensing/quality review; use an established open desktop solver as the validation oracle.

2. **GATE-B — Deployment target & cross-origin isolation / threading scope (ADR-003/ADR-008, Q-003).** ✅ **APPROVED: Cloudflare Pages/Netlify + multi-threaded WASM in MVP.**
   - Decision: Cloudflare Pages (primary; Netlify acceptable alternative) with COOP/COEP enabled. **Multi-threaded WASM is IN SCOPE for the MVP** (stakeholder chose the higher solve-quality path), with the single-threaded build retained as a mandatory always-present fallback (ADR-003) and sequenced first in delivery.
   - Reason: deployment strategy + a platform commitment that affects performance ceiling and the offline/Service-Worker design.
   - Q-003 RESOLVED: multi-thread is in MVP.
   - Note: GitHub Pages is excluded because it cannot set COOP/COEP (single-thread only).

3. **GATE-C — Persistence strategy (ADR-006/ADR-007).** ✅ **APPROVED AS PROPOSED.**
   - Decision: Hybrid IndexedDB + OPFS, with the predefined library as compressed binary shards + index.
   - Reason: persistence strategy is explicitly an approval-gate area; affects durability, quota, eviction, and offline behavior (RISK-003/013).
   - Approved: Hybrid as specified, with export/import as the durable backup and `navigator.storage.persist()` requested.

4. **GATE-D — Scope expansion: fidelity policy & prioritization (ADR-011..015, ARCHITECTURE Sec 20).** ✅ **APPROVED 2026-06-26.**
   - Decision: a major scope expansion of the (HU) NLHE GTO solver SPA — multiway (2-9 players), tournament/ICM, and deep stacks (sub-10bb..1000bb). This lifts NG4/FEAT-017 (HU-only).
   - **"Option 1" (fidelity policy) — APPROVED:** Heads-up remains a **live, trustworthy** zero-sum solve (exploitability estimate). Multiway (3+) and tournament/ICM ship as **offline-generated PRECOMPUTED CHARTS** (one validated, convention-selected answer) served through the existing predefined cache, **plus** a clearly-labeled live **estimate** (hero-vs-composite-field for multiway; chip-EV + ICM leaf transform for tournament) for off-grid spots — **NOT** as exact-GTO live solves. The words "exact GTO" are forbidden on any multiway/ICM output (honesty rule, generalizes BR-005).
   - **"Cash multiway first" (prioritization) — APPROVED:** prioritize **cash 6-max / full-ring** over tournament/ICM. Tournament/ICM (E3) is sequenced **after** cash multiway and is **gated on the ICM correctness spike (SPK-ICM)**.
   - Reason: this is a foundational product-scope + fidelity-policy + technology-approach decision (new domain model, new solving regimes, offline-pipeline activation) that is hard to reverse and sets the honesty contract for the whole product.
   - Encoded in: ADR-011 (2-effective-player E1/E2 model), ADR-012 (multiway model & equilibrium selection), ADR-013 (ICM model), ADR-014 (deep-stack abstraction), ADR-015 (offline pipeline activation); DATA_MODEL Sec 13; API_SPEC Sec 7; ARCHITECTURE Sec 20.
   - Go/no-go gates recorded: **SPK-MW** (multiway quality), **SPK-ICM** (ICM correctness), **SPK-DEEP** (deep-stack abstraction).
