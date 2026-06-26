# Internal Interface Specification — Personal Browser-Native NLHE GTO Solver

> Owner: Software Architect Agent
> Last Updated: 2026-06-24
> Status: DRAFT for stakeholder review
> Cross-references: `ARCHITECTURE.md` (Sec 4, 6), `DATA_MODEL.md` (all types), `PRD.md` (REQ-*, BR-*, NFR-*), `RISKS.md`.

## 0. There is NO network / HTTP API — by design

This product is a **pure client-side SPA with no backend** (CON-2, NFR-006). There are **no HTTP endpoints, no REST/GraphQL API, no server**. The only network activity is fetching **bundled static assets** (app bundle, WASM binary, predefined-library index/shards) from the static host CDN — explicitly permitted by AC-001 and not an "API".

This document therefore specifies the project's **internal contracts** — the real API surface of the system:
1. The **Web Worker message protocol** between the main thread and the solver worker (Sec 3).
2. The public **`SolverEngine`** TypeScript interface (the worker-client port) (Sec 2).
3. The **`PredefinedCache`** loader/query interface (Sec 4).
4. The **`PersistenceStore`** interface (Sec 5).
5. The **Application use-case** surface that orchestrates them (Sec 6).

All types referenced (`SpotConfig`, `SolveSettings`, `SolveResult`, `LookupKey`, etc.) are defined in `DATA_MODEL.md`. These interfaces are the **ports** (ARCHITECTURE Sec 2) — each has exactly one production adapter and is mockable for tests (ARCHITECTURE Sec 15).

---

## 1. Conventions

- All async operations return `Promise`s; long-running solves stream progress via callbacks/events.
- Every interface is versioned implicitly by `engineVersion` / `formatVersion` fields in payloads (DATA_MODEL) for mismatch detection (EDGE-008, EDGE-010).
- Cancellation is **cooperative** (a token/flag), never a forced kill of in-flight domain logic (AC-005).
- No interface performs network compute; only the cache loader fetches static assets.

---

## 2. `SolverEngine` port (worker-client public interface)

The main-thread façade over the WASM solver worker (ARCHITECTURE Sec 4.5). Consumed by the application layer; backed by the Worker Client adapter.

```ts
interface SolverEngine {
  /** Lazy init: spin up the worker, load the appropriate WASM variant
   *  (single- vs multi-thread per crossOriginIsolated — ADR-003). */
  init(): Promise<EngineInfo>;

  /** Cheap pre-solve cost estimate WITHOUT allocating the full tree (REQ-010, AC-006). */
  estimateCost(spot: SpotConfig, settings: SolveSettings): Promise<CostEstimate>;

  /** Run a live solve. Streams progress; resolves with the final SolveResult.
   *  Honors cancellation via the handle. (REQ-001/002/007, AC-001/002/004/005) */
  solve(req: SolveRequest, onProgress: (p: SolveProgress) => void): SolveHandle;

  /** Current engine status/capabilities. */
  info(): EngineInfo;

  /** Tear down the worker (e.g. on unrecoverable error). */
  dispose(): Promise<void>;
}

interface EngineInfo {
  engineVersion: string;
  threading: 'single' | 'multi';      // selected variant (ADR-003)
  crossOriginIsolated: boolean;       // whether SAB threading is available
  simd: boolean;
  maxMemoryBytes: number;             // budget ceiling (ARCHITECTURE Sec 9)
}

interface SolveRequest {
  spot: SpotConfig;
  settings: SolveSettings;            // includes seed (NFR-004) and memoryBudgetBytes
}

interface CostEstimate {
  estimatedInfoSets: number;
  estimatedMemoryBytes: number;
  withinBudget: boolean;              // false -> over-budget gate (AC-006, EDGE-001)
  suggestions?: string[];            // e.g. "use fewer bet sizes", "tighten ranges"
}

interface SolveProgress {
  iterations: number;                 // current iteration count (AC-004)
  exploitability?: ExploitabilityEstimate; // throttled best-response estimate (AC-004/013)
  phase: 'building-tree' | 'solving' | 'computing-exploitability';
  fractionToTarget?: number;          // 0..1 if a target was set
}

/** Handle for an in-flight solve. */
interface SolveHandle {
  /** Cooperative stop; resolves with best-so-far result labeled converged=false (AC-005, EDGE-003/006). */
  cancel(): Promise<SolveResult>;
  /** Resolves with the final converged (or stopped) result. */
  done: Promise<SolveResult>;
}
```

Contract guarantees:
- `solve` performs **zero network compute** (AC-001).
- The returned `SolveResult` always has `source: 'live'`, a recorded `seed`, and an `exploitability` labeled `'estimate'` (BR-005, NFR-004).
- `cancel()` returns best-so-far within a bounded time (AC-005).
- Determinism: same `SolveRequest` (incl. seed) -> identical `SolveResult` strategy (NFR-004, AC-002).

---

## 3. Web Worker Message Protocol (main thread <-> solver worker)

The wire protocol behind the `SolverEngine` adapter. Messages are `postMessage`-serializable (structured clone; large buffers transferred where possible). Every message carries a `type` and a correlation `id`. This protocol is **versioned** (`protocolVersion`) and contract-tested (ARCHITECTURE Sec 15).

### 3.1 Main -> Worker (requests)

```ts
type WorkerRequest =
  | { type: 'init';     id: string; protocolVersion: number; opts: { preferThreads: boolean } }
  | { type: 'estimate'; id: string; spot: SpotConfig; settings: SolveSettings }
  | { type: 'solve';    id: string; spot: SpotConfig; settings: SolveSettings }
  | { type: 'cancel';   id: string; targetId: string }   // targetId = id of the solve to stop
  | { type: 'dispose';  id: string };
```

### 3.2 Worker -> Main (responses & events)

```ts
type WorkerMessage =
  | { type: 'ready';     id: string; info: EngineInfo }
  | { type: 'estimated'; id: string; estimate: CostEstimate }
  | { type: 'progress';  id: string; progress: SolveProgress }   // throttled (~5-10 Hz, NFR-002)
  | { type: 'solved';    id: string; result: SolveResult }       // converged=true
  | { type: 'stopped';   id: string; result: SolveResult }       // converged=false (AC-005/EDGE-006)
  | { type: 'error';     id: string; error: WorkerError }
  | { type: 'disposed';  id: string };

interface WorkerError {
  code: 'oom' | 'invalid-input' | 'internal' | 'unsupported' | 'protocol-mismatch';
  message: string;
  recoverable: boolean;             // oom on a worker -> client may restart worker (NFR-003)
  partialResult?: SolveResult;      // best-so-far if available (EDGE-003)
}
```

### 3.3 Sequence — successful live solve

```
Main: { solve, id:S1 }
Wkr : { progress, id:S1, phase:'building-tree' }
Wkr : { progress, id:S1, phase:'solving', iterations:1000, exploitability:... }
Wkr : { progress, id:S1, phase:'solving', iterations:5000, exploitability:... }   // throttled
Wkr : { progress, id:S1, phase:'computing-exploitability' }
Wkr : { solved,   id:S1, result:{ source:'live', converged:true, ... } }
```

### 3.4 Sequence — cancellation (AC-005, EDGE-003/006)

```
Main: { solve,  id:S1 }
Wkr : { progress, id:S1, ... }
Main: { cancel, id:C1, targetId:S1 }
Wkr : { stopped, id:S1, result:{ converged:false, exploitability:<current>, ... } }
```

### 3.5 Sequence — OOM / error (NFR-003, RISK-010)

```
Main: { solve, id:S1 }
Wkr : { progress, id:S1, ... }
Wkr : { error, id:S1, code:'oom', recoverable:true, partialResult?:... }
Main: (surfaces clean error; preserves partialResult; may dispose+reinit worker)
```

Protocol rules:
- The worker MUST throttle `progress` to protect the main thread (NFR-002, AC-003).
- On `protocolVersion` mismatch the worker replies `error code:'protocol-mismatch'` (no silent misbehavior).
- A killed/terminated worker (hard OOM) is detected by the client via `worker.onerror`/termination; the client surfaces a clean error and preserves last-known progress (NFR-003).

---

## 4. `PredefinedCache` port (loader / query interface)

The cache loader/matcher (ARCHITECTURE Sec 4.7, Sec 7). Fetches static assets only.

```ts
interface PredefinedCache {
  /** Load + integrity/version-check the index; report status. On failure -> disabled (EDGE-010, NFR-011). */
  init(): Promise<LibraryStatus>;

  /** Current library status (drives notices, AC-025). */
  status(): LibraryStatus;

  /** Derive the normalized key (incl. board isomorphism) and look up an exact match (BR-008). */
  lookup(spot: SpotConfig, settings: SolveSettings): Promise<CacheLookupResult>;

  /** Fetch + decode the payload for a matched entry (lazy shard load, OPFS-cached). */
  getEntry(ref: PredefinedIndexEntry, spot: SpotConfig): Promise<SolveResult>; // source:'predefined'
}

type CacheLookupResult =
  | { hit: true;  key: LookupKeyString; ref: PredefinedIndexEntry }
  | { hit: false; key: LookupKeyString; reason: 'no-match' | 'cache-disabled' };
```

Contract guarantees:
- `lookup` returns `hit:true` **only on an exact normalized-key match** (BR-008, RISK-014); never approximate.
- `getEntry` returns a `SolveResult` with `source:'predefined'`, `iterations:0` (AC-024), and the entry's `GenerationMeta` surfaced in `settings`/`exploitability` (BR-007, AC-026).
- On corrupt/missing/version-mismatched library, `status()` is non-`loaded` and `lookup` returns `hit:false, reason:'cache-disabled'` so callers live-solve with a notice (EDGE-010, AC-025, NFR-011).
- Shard fetches are static-asset GETs (permitted by AC-001), cached in OPFS for offline (FEAT-011, AC-021).

---

## 5. `PersistenceStore` port (IndexedDB + OPFS)

Local persistence (ARCHITECTURE Sec 4.8, DATA_MODEL Sec 11). No network (NFR-006).

```ts
interface PersistenceStore {
  init(): Promise<void>;                       // open DB, run migrations (EDGE-008)

  // Saved spots
  saveSpot(spot: SavedSpot): Promise<void>;
  getSpot(id: string): Promise<SavedSpot | null>;
  listSpots(): Promise<SavedSpot[]>;
  renameSpot(id: string, name: string): Promise<void>;     // AC-017
  deleteSpot(id: string): Promise<void>;                   // AC-017

  // Saved results (large payloads offloaded to OPFS transparently — ADR-006)
  saveResult(result: SavedResult): Promise<void>;          // AC-016
  getResult(id: string): Promise<SavedResult | null>;
  listResults(spotId?: string): Promise<SavedResult[]>;
  deleteResult(id: string): Promise<void>;

  // Drills (AC-023)
  saveDrill(d: DrillRecord): Promise<void>;
  listDrills(): Promise<DrillRecord[]>;

  // Settings & library meta
  getSettings(): Promise<UserSettings>;
  setSettings(s: UserSettings): Promise<void>;
  getLibraryMeta(): Promise<unknown>;
  setLibraryMeta(m: unknown): Promise<void>;

  // Storage management (AC-018, NFR-007, RISK-013)
  storageStatus(): Promise<StorageStatus>;
  requestPersistent(): Promise<boolean>;       // navigator.storage.persist()

  // Export / import (FEAT-014, AC-022)
  exportSpot(spotId: string, includeResult: boolean): Promise<ExportFile>;
  importSpot(file: ExportFile): Promise<SavedSpot>;        // schema-validated (security)
}
```

Contract guarantees:
- All writes are transactional; on quota-exceeded, the call **rejects with a clear error and leaves no partial/corrupt record** (AC-018, EDGE-004).
- `importSpot` validates against the schema before persisting (data-only, ARCHITECTURE Sec 12, AC-022).
- Reopened results carry `engineVersion`; the application warns on mismatch and offers re-solve (EDGE-008).
- Nothing is transmitted off-device (NFR-006, AC-016).

---

## 6. Application use-case surface (orchestration API)

The application layer (ARCHITECTURE Sec 4.3) is what the UI calls. It composes the three ports above.

```ts
interface AppApi {
  /** THE hybrid entry point: try cache, else live-solve (Flow 1; AC-024/025/026, BR-008). */
  lookupOrSolve(
    spot: SpotConfig,
    settings: SolveSettings,
    onProgress?: (p: SolveProgress) => void
  ): Promise<SolveResult>;     // source:'predefined' on hit, 'live' on miss

  /** Pre-solve gate; returns estimate so UI can warn/block (AC-006). */
  estimateCost(spot: SpotConfig, settings: SolveSettings): Promise<CostEstimate>;

  /** Live solve with cancel handle (when caller wants explicit live, e.g. re-solve). */
  startLiveSolve(spot: SpotConfig, settings: SolveSettings, onProgress: (p: SolveProgress)=>void): SolveHandle;

  // Persistence pass-throughs (typed)
  saveSpot(spot: SavedSpot): Promise<void>;
  saveResult(result: SavedResult): Promise<void>;
  listSaved(): Promise<{ spots: SavedSpot[]; results: SavedResult[] }>;
  loadResult(id: string): Promise<SavedResult | null>;
  deleteSaved(kind: 'spot'|'result', id: string): Promise<void>;
  renameSpot(id: string, name: string): Promise<void>;

  // Practice (AC-023/027)
  startDrill(source: 'predefined'|'saved'): Promise<DrillPrompt>;
  scoreDrill(promptId: string, estimate: { action: Action; frequency: number }[]): Promise<DrillRecord>;

  // Export/import (AC-022)
  exportSpot(spotId: string, includeResult: boolean): Promise<ExportFile>;
  importSpot(file: ExportFile): Promise<SavedSpot>;

  // Platform/status
  engineInfo(): EngineInfo;
  libraryStatus(): LibraryStatus;
  storageStatus(): Promise<StorageStatus>;
}

interface DrillPrompt {
  promptId: string;
  spotSummary: string;
  nodePath: NodePath;
  handClass: HandClassIndex;
  // solution withheld until scoreDrill is called (AC-023)
}
```

### 6.1 `lookupOrSolve` algorithm (normative — AC-024/025/026, BR-008)

```
1. key = deriveLookupKey(spot, settings)            // domain, with board isomorphism
2. if cache.status().state === 'loaded':
     r = cache.lookup(spot, settings)
     if r.hit:
        return cache.getEntry(r.ref, spot)          // source:'predefined', iterations:0  (AC-024)
3. // miss OR cache disabled -> never return unlabeled approximate predefined (BR-008)
   validate(spot)                                    // BR-001/002/003; throw -> UI blocks (AC-007/010)
   est = engine.estimateCost(spot, settings)
   if !est.withinBudget:
        throw OverBudgetError(est.suggestions)       // UI warns/blocks (AC-006, EDGE-001)
   handle = engine.solve({spot, settings}, onProgress)
   return await handle.done                          // source:'live'  (AC-025)
```

This single function is the contract that ties cache, budget gate, and live engine together, and is the primary integration-test target (ARCHITECTURE Sec 15).

---

## 7. Scope-Expansion Contracts (generalized SpotConfig / SolveResult / protocol)

> Added 2026-06-26 for the approved scope expansion (2-9 players, cash + tournament/ICM, deep stacks). Binding decisions: **Option 1** + **cash-multiway-first**. Types defined in DATA_MODEL Sec 13. Architecture in ARCHITECTURE Sec 20.

### 7.0 Design intent — the port stays stable

The `SolverEngine` port (Sec 2) is **not reshaped**. The swap-in contract for the future Rust→WASM engine is preserved: `solve(req, onProgress) → Promise<SolveResult>`. Only the **payload types widen** (`SpotConfigV2` / `SolveResultV2`, DATA_MODEL Sec 13) and the protocol version bumps. Everything new (multiway reduction, ICM leaf transform, deep-stack caps) is **engine-internal** behind this same method, so the worker/UI wiring is untouched.

### 7.1 Generalized `SolveRequest`

The request widens to carry the generalized spot and a discriminating `mode`. The HU `push-fold`/`bet-tree` modes remain (the v1 slice); a new `preflop-spot` mode carries the generalized config:

```ts
type SolveRequestV2 =
  | { mode: 'push-fold';   spot: PushFoldSpot;     settings: SolveSettings }  // v1 (retained)
  | { mode: 'bet-tree';    spot: PreflopTreeSpot;  settings: SolveSettings }  // v1 (retained)
  | { mode: 'preflop-spot'; spot: SpotConfigV2;    settings: SolveSettings }; // NEW — E1+
```

For **E1/E2** the engine handles `preflop-spot` by **projecting `SpotConfigV2` to a 2-player `BetTreeConfig`** (DATA_MODEL 13.9) and running the existing CFR+ solver. For **E3** it additionally applies the ICM leaf transform; for **E4** it dispatches to the composite-field estimator or returns a predefined chart via the cache.

### 7.2 `SolveProgress` (extended, additive)

```ts
interface SolveProgressV2 {
  phase: 'building-equity' | 'building-tree' | 'solving' | 'computing-exploitability'
       | 'icm-transform'    // NEW (E3)
       | 'composite-field'; // NEW (E4)
  fraction: number;          // 0..1
  iterations?: number;
}
```

### 7.3 Result is `SolveResultV2`

`solve()` resolves with `SolveResultV2` (DATA_MODEL 13.7) for `preflop-spot` requests, carrying the first-class `trust: TrustInfo`. Contract additions to Sec 2's guarantees:

- A `preflop-spot` E1/E2 result MUST have `trust.label === 'live-solve'`, `trust.zeroSumValid === true`, `trust.exploitability` present.
- A multiway live estimate (E4) MUST have `trust.label === 'estimate-composite'`, `zeroSumValid === false`, and a caption containing "estimate".
- A predefined chart MUST have `source === 'predefined'`, `trust.label === 'predefined'`, `iterations === 0`, and `trust.equilibriumConvention` set.
- The caption MUST NEVER contain the string "exact GTO" (test-asserted, generalizes BR-005).

### 7.4 Worker protocol version bump

```ts
// protocol.ts
export const PROTOCOL_VERSION = 3; // was 2: SolveRequest gains 'preflop-spot'; result widens to SolveResultV2
```

```ts
// Main -> Worker (request payload widened; envelope unchanged)
type WorkerRequest =
  | { type: 'init';  id: string; protocolVersion: number }
  | { type: 'solve'; id: string; protocolVersion: number; req: SolveRequestV2 };

// Worker -> Main (result widened)
type WorkerMessage =
  | { type: 'ready';    id: string; info: EngineInfo }
  | { type: 'progress'; id: string; progress: SolveProgressV2 }
  | { type: 'solved';   id: string; result: SolveResultV2 | AnySolveResult }
  | { type: 'error';    id: string; error: WorkerError };
```

The `protocolVersion` mismatch handling (Sec 3) is unchanged; bumping to 3 forces clean rejection if a stale worker/client pair is loaded.

### 7.5 `PredefinedCache` lookup — extended key

`PredefinedCache.lookup(spot, settings)` (Sec 4) accepts `SpotConfigV2` and derives a `LookupKeyV2` (DATA_MODEL 13.8) with the new axes (`gameMode`, `tableSize`, `heroPosition`, `betContextCanonical`, `stackBucketBb`, optional `icmKey`). Matching remains **exact normalized-key only** (BR-008). The port signature is unchanged; only the key derivation widens.

### 7.6 What the engineer wires for E1 (request side)

- Add `mode: 'preflop-spot'` to the request union; bump `PROTOCOL_VERSION` to 3.
- The engine adapter (`preflopEngine.ts`) gains a `solvePreflopSpotMode` that calls `projectToBetTreeConfig(spot)` (new domain helper, DATA_MODEL 13.9) and reuses `solvePreflopTree` + the equity matrix, then builds a `SolveResultV2` with `trust.label='live-solve'`.
- No change to `workerClient.ts` / `solver.worker.ts` envelopes beyond the version constant and the widened result type.
