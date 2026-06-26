# Data Model — Personal Browser-Native NLHE GTO Solver

> Owner: Software Architect Agent
> Last Updated: 2026-06-24
> Status: DRAFT for stakeholder review
> Cross-references: `PRD.md` (BR-*, REQ-*), `ARCHITECTURE.md` (Sec 4, 6, 7, 8, 18), `API_SPEC.md`, `TECH_DECISIONS.md` (ADR-006/007).
> Notation: TypeScript-like interfaces. These are the canonical domain types shared by UI, application, worker protocol, cache, and persistence (ARCHITECTURE Sec 1.2). Persistence/IDB+OPFS layout is in the final section.

This model is the lingua franca of the system. A **predefined** result and a **live** result use the *same* `SolveResult` shape, differing only by `source` and provenance fields (ARCHITECTURE Sec 7).

---

## 1. Cards & Board (BR-002)

```ts
type Rank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'T'|'J'|'Q'|'K'|'A'; // 2..A, index 0..12
type Suit = 'c'|'d'|'h'|'s';                                      // clubs/diamonds/hearts/spades

/** A single card. Also encodable as a 0..51 integer: rankIndex*4 + suitIndex (engine-internal). */
interface Card { rank: Rank; suit: Suit; }

/** Board cards by street. Validation: no duplicates; no conflict with locked range cards (BR-002, AC-010). */
interface Board {
  flop?: [Card, Card, Card];
  turn?: Card;
  river?: Card;
}
```

Validation rules (Domain Core): card-uniqueness invariant across board + any locked cards (BR-002); ranks/suits valid (AC-010). Engine uses the compact 0..51 integer form internally for speed.

---

## 2. Ranges (BR-001) — 13x13 + combos

```ts
/** 169 canonical starting-hand classes. Convention (BR-001):
 *  pairs on the diagonal, suited upper-right, offsuit lower-left/right.
 *  classIndex = row*13 + col over rank indices (A high). */
type HandClassIndex = number; // 0..168

interface HandClass {
  index: HandClassIndex;
  label: string;              // e.g. "AKs", "QJo", "TT"
  kind: 'pair' | 'suited' | 'offsuit';
  high: Rank; low: Rank;
  comboCount: number;         // pair=6, suited=4, offsuit=12 (pre-board removal)
}

/** A range as weights over the 169 classes (0..1). The primary editor representation (AC-008). */
interface Range {
  /** Sparse map classIndex -> weight in [0,1]; absent = 0. */
  weights: Record<HandClassIndex, number>;
  /** Optional human label / standard-range id for cache matching (ARCHITECTURE 7.1). */
  rangeId?: StandardRangeId | null;
}

type StandardRangeId = string; // canonical id of a named/standard range, e.g. "HU_BTN_OPEN_100bb"

/** Combo-level expansion (used by the engine; suit-specific, board-aware after card removal). */
interface Combo { a: Card; b: Card; weight: number; }       // 1326 possible combos pre-removal

/** Helper: content hash of a custom range for exact cache matching (ARCHITECTURE 7.2). */
type RangeHash = string; // stable hash of the weights map; used when rangeId is absent
```

Invariants: weights in [0,1]; an all-zero range is invalid for solving (AC-007). The engine expands `Range` -> `Combo[]` applying board/locked-card removal.

---

## 3. Bet-Sizing Tree (FEAT-009, REQ-012, AC-009)

```ts
/** A bet/raise size expressed as a fraction of pot (or "allin"). */
type SizeSpec =
  | { type: 'pot-fraction'; fraction: number }   // e.g. 0.33, 0.75, 1.0
  | { type: 'allin' };

/** Allowed sizes available at node categories. MVP = limited fixed set (tractability). */
interface BetSizingTree {
  id: BetTreeId;                       // canonical id for cache matching (ARCHITECTURE 7.1)
  label: string;
  betSizes: SizeSpec[];                // sizes when betting into a pot
  raiseSizes: SizeSpec[];              // sizes when facing a bet (often a single size in MVP)
  allowAllIn: boolean;
  donkBetsAllowed?: boolean;           // usually false in MVP for tractability
}

type BetTreeId = string;
```

More sizes -> larger tree -> higher estimated cost (AC-009 surfaces this). Bounded per Q-001 / ADR-010.

---

## 4. Game Tree / Action Sequences

```ts
type Action =
  | { kind: 'fold' }
  | { kind: 'check' }
  | { kind: 'call' }
  | { kind: 'bet';   size: SizeSpec }
  | { kind: 'raise'; size: SizeSpec };

type Position = 'BTN' | 'SB' | 'BB';  // HU MVP: effectively BTN(=SB) vs BB
type Street = 'preflop' | 'flop' | 'turn' | 'river';

/** Canonical action path identifying a decision node, used in lookup keys & results. */
interface NodePath {
  street: Street;
  /** Ordered actions from root to this node, e.g. preflop ["raise2.5","call"] then flop [...]. */
  actions: Action[];
  toAct: Position;
}

/** Engine-internal node (not persisted as-is). Reference only. */
interface GameNode {
  id: number;
  path: NodePath;
  infoSets: number;                    // count of info sets at/under this node (cost estimation)
  children: GameNode[];
}
```

The engine builds the tree from `(positions, effectiveStack, betSizingTree, board?, ranges)`. Tree shape is deterministic given inputs (NFR-004). `infoSets` aggregation feeds cost estimation (REQ-010, AC-006).

---

## 5. Spot Configuration / Solve Inputs (REQ-003, AC-007)

> **SCOPE-EXPANSION NOTE (2026-06-26).** The stakeholder approved a major scope
> expansion (multiway 3-9, tournament/ICM, deep stacks) with two binding
> decisions — **"Option 1"** (HU is a live, trustworthy solve; multiway and
> tournament/ICM ship as **precomputed charts** plus a clearly-labeled live
> **estimate**, never "exact GTO") and **"cash multiway first"** (prioritize cash
> 6-max/full-ring before tournament/ICM). The **generalized** `SpotConfig` /
> `SolveResult` that supersede the HU-only shapes below are specified in the new
> **Section 13 (Generalized Domain Model)**. The interfaces in *this* Section 5 and
> in Section 6 are retained as the **HU subset** they describe (and match the
> shipped HU slice in `src/engine/types.ts`); the generalized types are
> backward-compatible — the HU shapes are the `tableSize: 2`, `gameType: 'cash'`,
> two-effective-player projection of the general model.

```ts
type GameType = 'NLHE';

interface SpotConfig {
  gameType: GameType;            // 'NLHE'
  players: 2;                    // HU MVP (NG4)
  effectiveStackBb: number;      // e.g. 100; bucketed for cache (ARCHITECTURE 7.1)
  positions: { ip: Position; oop: Position };  // HU: BTN(ip) vs BB(oop)
  ranges: { ip: Range; oop: Range };
  betSizingTree: BetSizingTree;
  board?: Board;                 // present for postflop spots (FEAT-008/010)
  potBb?: number;                // derived/explicit starting pot for postflop
}

/** Solver abstraction & run settings. Part of the cache key & result provenance (BR-007). */
interface SolveSettings {
  algorithm: 'cfr+' | 'dcfr';    // ADR-002
  abstractionId: AbstractionId;  // bucketing/sizing-simplification profile
  targetIterations?: number;     // optional cap; else run to exploitability target / stop
  targetExploitabilityMbb?: number; // optional convergence target
  seed: number;                  // determinism (NFR-004, AC-002)
  memoryBudgetBytes: number;     // per-solve cap (ARCHITECTURE Sec 9)
}

type AbstractionId = string;     // e.g. "none", "flop-bucket-200", documents card/sizing abstraction
```

`SpotConfig` is what the user edits and what gets saved; `(SpotConfig + SolveSettings)` is what the engine and the cache key consume.

---

## 6. Solve Results (REQ-005/006/008, BR-003/004/005/007)

```ts
type ResultSource = 'predefined' | 'live';

/** Per-hand strategy at a node: action -> frequency (sum to 1 within tolerance, BR-003). */
interface HandStrategy {
  handClass: HandClassIndex;      // (or combo-level when needed)
  frequencies: { action: Action; frequency: number }[]; // sum ~= 1 (BR-003, AC-011)
  evPerAction: { action: Action; ev: number }[];        // EV per action (REQ-006, AC-012)
}

/** Strategy at one decision node for the to-act player. */
interface NodeStrategy {
  nodePath: NodePath;
  toAct: Position;
  hands: HandStrategy[];          // covers each hand in that player's range
}

interface EquityInfo {
  ipEquityPct: number;            // range-vs-range equity, % (BR-004, AC-012)
  oopEquityPct: number;
}

/** Convergence/trust info — always an estimate, never "exact GTO" (BR-005, AC-013). */
interface ExploitabilityEstimate {
  valueMbbPer100: number;         // exploitability in mbb/100 (or % pot)
  unit: 'mbb/100' | '%pot';
  measuredAtIteration: number;
  withinAbstraction: true;        // honesty flag: BR over the abstracted game (ARCHITECTURE Sec 8)
  label: 'estimate';              // never "exact"
}

interface SolveResult {
  source: ResultSource;           // 'predefined' | 'live' (BR-007, AC-026)
  spot: SpotConfig;               // the spot this result is for
  settings: SolveSettings;        // abstraction/settings used (BR-007, AC-013/026)
  rootStrategy: NodeStrategy;     // strategy at the requested node (and/or subtree)
  subtree?: NodeStrategy[];       // optional deeper nodes (postflop)
  equity: EquityInfo;
  exploitability: ExploitabilityEstimate;
  iterations: number;             // 0 for predefined (no live loop) (AC-024)
  converged: boolean;             // false if stopped early (AC-005, EDGE-006)
  seed: number;                   // reproducibility (NFR-004)
  generatedAt: string;            // ISO timestamp
  engineVersion: string;          // for version-mismatch detection (EDGE-008)
}
```

Notes:
- `iterations === 0` and `source === 'predefined'` together assert "no live loop ran" (AC-024 testability).
- `exploitability.label === 'estimate'` and `withinAbstraction` enforce the honest-reporting rule (BR-005, ARCHITECTURE Sec 8).

---

## 7. Predefined Solution Entry & Lookup Key (FEAT-019, BR-007/008, NFR-011)

### 7.1 Lookup Key (ARCHITECTURE Sec 7.1)

```ts
/** Normalized, deterministic key. Identical spots (incl. board isomorphism) -> identical key. */
interface LookupKey {
  gameType: GameType;            // 'NLHE'
  players: 2;
  street: Street;
  nodePathCanonical: string;     // canonical-serialized NodePath (preflop open/3bet/4bet, etc.)
  effectiveStackBb: number;      // bucketed depth (20/40/60/100/200)
  positions: { ip: Position; oop: Position };
  rangeRef: { ip: RangeRef; oop: RangeRef };
  boardCanonical?: string;       // suit-isomorphic representative of the board (postflop)
  betTreeId: BetTreeId;
  abstractionId: AbstractionId;
  formatVersion: number;         // bundle format/version (NFR-011)
}

/** A range is referenced by standard id (preferred) or content hash (custom). */
type RangeRef =
  | { kind: 'standard'; id: StandardRangeId }
  | { kind: 'hash'; hash: RangeHash };

/** The serialized string form used as the actual index map key. */
type LookupKeyString = string; // stable canonical serialization of LookupKey
```

Matching is **exact** on `LookupKeyString` (BR-008). Board isomorphism is applied when computing `boardCanonical` (the only allowed normalization — exact by suit symmetry, ARCHITECTURE 7.2). On retrieval, the user's actual suits are mapped back from the canonical representative.

### 7.2 Library Index & Entry

```ts
/** Eagerly loaded small index (ADR-007). Maps key -> where to find the payload + provenance. */
interface PredefinedIndex {
  formatVersion: number;
  engineVersionClass: string;    // generation engine version (RISK-014, EDGE-010)
  integrity: string;             // hash/checksum for integrity check (NFR-011)
  entries: Record<LookupKeyString, PredefinedIndexEntry>;
}

interface PredefinedIndexEntry {
  shardId: string;               // which shard file holds the payload
  offset: number;                // byte offset within the (decompressed) shard
  length: number;
  generation: GenerationMeta;    // provenance shown in UI (BR-007, AC-026)
}

/** Provenance recorded at offline generation time (ADR-009). */
interface GenerationMeta {
  settings: SolveSettings;             // abstraction/algorithm/iterations used offline
  exploitability: ExploitabilityEstimate; // measured at generation (often near-production)
  referenceValidated: boolean;         // passed reference-solver benchmark (M2, RISK-004/014)
  generatedAt: string;
  generatorVersion: string;
}

/** The decoded payload of a predefined entry = a SolveResult with source='predefined'. */
type PredefinedEntryPayload = SolveResult; // decoded from the compressed binary shard
```

### 7.3 Shard (binary, lazy) — logical view

```ts
/** Physical shard is a compressed binary blob (ADR-007). Logical contents: */
interface ShardLogical {
  shardId: string;
  formatVersion: number;
  /** Concatenated, compactly-encoded strategy payloads addressed by index offset/length.
   *  Strategy frequencies quantized (e.g. 8-16 bit/action) then Brotli/gzip compressed. */
  payloadBytes: Uint8Array;
}
```

Integrity: on load, `formatVersion` + `integrity` checked; on mismatch/corruption -> cache disabled, live fallback, user notice (NFR-011, EDGE-010, AC-025).

---

## 8. Saved Sessions / Spots (FEAT-007, REQ-009, AC-016/017)

```ts
interface SavedSpot {
  id: string;                    // uuid
  name: string;                  // user-editable (rename, AC-017)
  spot: SpotConfig;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

interface SavedResult {
  id: string;                    // uuid
  spotId: string;                // FK -> SavedSpot.id (a saved result references its spot)
  result: SolveResult;           // full result (large payloads may live in OPFS, see Sec 10)
  resultBlobRef?: string;        // OPFS path if payload offloaded (ADR-006)
  createdAt: string;
  engineVersion: string;         // for version-mismatch warning on reopen (EDGE-008)
}
```

Relationship: `SavedResult.spotId -> SavedSpot.id` (one spot may have multiple saved results, e.g. different settings/seeds).

---

## 9. Practice / Drill Records (FEAT-012, REQ-021, AC-023/027)

```ts
interface DrillRecord {
  id: string;
  createdAt: string;
  sourceKind: 'predefined' | 'saved';     // where the spot came from (AC-027)
  spotRef: string;                        // LookupKeyString (predefined) or SavedResult.id (saved)
  prompt: {
    nodePath: NodePath;
    handClass: HandClassIndex;            // the hand the user is asked about
    askedAction?: Action;                 // which action's frequency to estimate (if specific)
  };
  userEstimate: { action: Action; frequency: number }[]; // user's guess
  solution: { action: Action; frequency: number }[];     // GTO frequencies revealed
  score: DrillScore;                      // accuracy metric (AC-023)
}

interface DrillScore {
  /** e.g. 1 - mean absolute frequency error, or L1 distance; defined by Domain scoring fn. */
  accuracy: number;                       // 0..1
  meanAbsError: number;                   // sum/avg |estimate-solution|
  passed: boolean;                        // within an accuracy threshold
}
```

Scoring is a pure Domain function over `userEstimate` vs `solution` (testable, AC-023, ARCHITECTURE Sec 15).

---

## 10. User Settings & Library Status

```ts
interface UserSettings {
  units: { ev: 'bb' | 'chips'; exploitability: 'mbb/100' | '%pot' };
  defaultStackBb: number;
  defaultBetTreeId: BetTreeId;
  threadingPreference: 'auto' | 'single';  // auto = use threads if crossOriginIsolated (ADR-003)
  requestPersistentStorage: boolean;       // navigator.storage.persist()
}

/** Runtime status of the predefined library (drives notices, EDGE-010, AC-025). */
interface LibraryStatus {
  state: 'loaded' | 'disabled-corrupt' | 'disabled-version' | 'absent';
  formatVersion?: number;
  entryCount?: number;
  message?: string;                        // user-facing notice on disable
}

/** Storage usage snapshot (AC-018, NFR-007). */
interface StorageStatus {
  usageBytes: number;
  quotaBytes: number;
  persistent: boolean;                     // result of navigator.storage.persist()
}
```

---

## 11. Persistence Layout — IndexedDB + OPFS (ADR-006)

### 11.1 IndexedDB object stores (structured records)

| Object store | Key | Indexes | Holds | Source AC/REQ |
|--------------|-----|---------|-------|---------------|
| `savedSpots` | `id` | `name`, `updatedAt` | `SavedSpot` | REQ-009, AC-016/017 |
| `savedResults` | `id` | `spotId`, `createdAt` | `SavedResult` (small payloads inline; large -> OPFS ref) | REQ-009, AC-016 |
| `drills` | `id` | `createdAt`, `sourceKind` | `DrillRecord` | REQ-021, AC-023 |
| `settings` | fixed key `"user"` | — | `UserSettings` | — |
| `libraryMeta` | fixed key `"library"` | — | `{ formatVersion, integrity, engineVersionClass, cachedShardIds[] }` | NFR-011 |
| `meta` | fixed key `"schema"` | — | `{ schemaVersion }` for migration (EDGE-008) | EDGE-008 |

- DB name: `clearsolve`. `schemaVersion` drives `onupgradeneeded` migrations; on app/engine version change, reopened results are flagged for possible re-solve (EDGE-008).
- Writes are transactional; on quota-exceeded, abort cleanly leaving **no partial/corrupt record** (AC-018, EDGE-004).

### 11.2 OPFS layout (large binary)

```
opfs:/clearsolve/
  library/shards/<shardId>.bin       # cached predefined shards (lazy, offline reuse) — FEAT-011
  results/<resultId>.bin             # offloaded large SolveResult payloads (ADR-006)
```

- Library shards fetched from static host on first use, then cached in OPFS for offline (FEAT-011, REQ-014, AC-021).
- OPFS-absent fallback: store these blobs in an IndexedDB `blobs` store instead (ADR-006).
- Both IDB and OPFS are subject to eviction (RISK-013); export/import (FEAT-014) is the durable backup.

### 11.3 Export/Import file format (FEAT-014, REQ-017, AC-022)

```ts
interface ExportFile {
  formatVersion: number;
  exportedAt: string;
  spot: SpotConfig;
  result?: SolveResult;            // optional; round-trips (AC-022)
}
```

Imported files are schema-validated before use (data-only, no code execution — ARCHITECTURE Sec 12).

---

## 12. Entity Relationship Summary

```
SavedSpot 1 ---- * SavedResult            (SavedResult.spotId -> SavedSpot.id)
SavedResult * ---- 0..1 OPFS result blob  (SavedResult.resultBlobRef)
PredefinedIndex 1 ---- * PredefinedIndexEntry ---- 1 Shard (by shardId/offset)
DrillRecord * ---- 1 spot source          (predefined LookupKeyString OR SavedResult.id)
SolveResult uses SpotConfig + SolveSettings; produced by Live engine OR decoded from a Predefined entry
LookupKey derives deterministically from SpotConfig + SolveSettings (with board isomorphism)
```

Key invariant (BR-008): a `LookupKey` resolves to a `PredefinedIndexEntry` **only on exact match**; otherwise the system produces a `SolveResult` with `source: 'live'`.

---

## 13. Generalized Domain Model (Scope Expansion: 2-9 players, cash + tournament/ICM, deep stacks)

> Owner: Software Architect Agent. Added 2026-06-26 for the approved scope expansion.
> Binding stakeholder decisions: **Option 1** (HU = live trustworthy; multiway/ICM = precomputed charts + labeled live estimate) and **cash-multiway-first**.
> Cross-references: ARCHITECTURE Sec 20 (scope-expansion architecture), TECH_DECISIONS ADR-011..015, API_SPEC Sec 7.
> These types **supersede** the HU `SpotConfig`/`SolveResult` of Sec 5/6 and the HU slice types in `src/engine/types.ts`. The HU shapes remain valid as the `tableSize:2` projection (Sec 13.9).

### 13.0 Milestone vocabulary (scope-expansion track)

These are the **scope-expansion milestones** referenced throughout (distinct from the existing IMPLEMENTATION_PLAN delivery tasks):

| Milestone | Scope | Fidelity / delivery | Trust label |
|-----------|-------|---------------------|-------------|
| **E1** | HU + multiway cash table config that **reduces to a 2-effective-player solve** (RFI, vs-single-raiser) at any tableSize 2-9, cash, chip-EV | **Live solve** (CFR+ over the bet tree); trustworthy | `live-solve` |
| **E2** | E1 + deep-stack abstraction caps (sub-10bb .. 1000bb via raise-round/size caps + stack buckets), more bet-context nodes (3-bet/4-bet/5-bet shove layers) | **Live solve** within abstraction caps | `live-solve` |
| **E3** | Tournament/ICM leaf-transform on the **existing** tree (cash multiway already shipped); chips→equity via ICM; **gated on the ICM correctness spike** | Precomputed charts primary; live estimate optional | `predefined` / `estimate-icm` |
| **E4** | True **multiway** (3+ players simultaneously in the pot): composite-field live **estimate** + precomputed multiway charts | `estimate` (live) / `predefined` (chart) — **never** `live-solve` | `estimate-composite` / `predefined` |
| **E5** | Coverage expansion: more chart families, depths, payout structures, postflop multiway | Precomputed charts | `predefined` |

The **near-term, code-now** target is **E1 (then E2)**. E3-E5 are designed here at architecture level; their interfaces are forward-declared so the engineer never has to reshape the core types later.

---

### 13.1 Table size, seats & positions

```ts
/** 2..9 players at the table (NG4 lifted). */
type TableSize = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** Canonical position labels. Which subset is valid depends on tableSize (13.1.1). */
type SeatPosition =
  | 'SB' | 'BB'                 // blinds (always present for tableSize>=2)
  | 'UTG' | 'UTG1'             // early
  | 'MP' | 'LJ'               // middle / lojack
  | 'HJ' | 'CO' | 'BTN';      // hijack / cutoff / button

/** A seat at the table. seatIndex is 0-based in POSTING order from SB. */
interface Seat {
  seatIndex: number;          // 0 = SB, 1 = BB, 2 = first to act preflop, ... , last = BTN
  position: SeatPosition;
  stackBb: number;            // this seat's stack in bb (per-seat; needed for ICM & uneven cash)
}
```

#### 13.1.1 Seat→position mapping per table size (CANONICAL, deterministic)

Positions are assigned by **distance from the button**, then the SB/BB are always the two seats left of the button. The button-relative naming is the poker-standard convention. For each `tableSize`, the ordered set of positions (preflop action order, i.e. **first-to-act → last-to-act**) is:

| tableSize | Preflop action order (first → last) | Notes |
|-----------|-------------------------------------|-------|
| 2 (HU) | `BTN(=SB)`, `BB` | HU special case: BTN posts SB and acts FIRST preflop. The two labels collapse: the button seat IS the small blind. |
| 3 | `BTN`, `SB`, `BB` | BTN acts first preflop (after BB), then SB, then BB. |
| 4 | `CO`, `BTN`, `SB`, `BB` | |
| 5 | `HJ`, `CO`, `BTN`, `SB`, `BB` | |
| 6 (6-max) | `UTG`, `HJ`, `CO`, `BTN`, `SB`, `BB` | **Primary cash target.** (Some rooms label the 6-max early seats UTG/MP/CO; we use UTG/HJ/CO for consistency.) |
| 7 | `UTG`, `LJ`, `HJ`, `CO`, `BTN`, `SB`, `BB` | |
| 8 | `UTG`, `UTG1`, `LJ`, `HJ`, `CO`, `BTN`, `SB`, `BB` | |
| 9 (full ring) | `UTG`, `UTG1`, `MP`, `LJ`, `HJ`, `CO`, `BTN`, `SB`, `BB` | **Secondary cash target.** |

Rules:
- **Preflop action order** starts at the seat **left of the BB** (UTG / the earliest listed non-blind position) and proceeds clockwise, with **SB and BB acting last** preflop (they have already posted). The table column above lists positions in *non-blind-first* speaking order for clarity; the actual first-to-act preflop is the leftmost **non-blind** position (UTG-equivalent), and SB/BB close the action. HU is the documented exception (BTN/SB acts first).
- **Postflop action order** (for E5 multiway postflop) always starts at the SB (or first remaining player left of the button) — standard rules. Not needed for E1/E2 (preflop only).
- `seatIndex` is canonical posting order from SB=0; `position` is the derived label. A pure domain function `seatLayout(tableSize): Seat[]` produces this mapping deterministically (NFR-004) and is the single source of truth (unit-tested).
- **Hero** is identified by `heroPosition: SeatPosition` (must be a member of the mapping for `tableSize`). The engine resolves hero's `seatIndex` via `seatLayout`.

---

### 13.2 Bet context / decision node (the spot the hero faces)

A spot is hero's decision point, defined by the **sequence of prior actions** (with sizes) that lead to hero acting.

```ts
/** A prior action by a specific seat, with its sizing, that precedes hero's decision. */
interface PriorAction {
  seatIndex: number;                 // who acted
  kind: 'fold' | 'call' | 'limp' | 'raise' | 'allin';
  /** raiser's TOTAL contribution after the action, in bb ("raise-TO"). Omit for fold. */
  toBb?: number;
}

/**
 * The bet context = the ordered prior actions that define hero's node.
 * Empty `priorActions` + hero = first non-blind seat  => RFI (Raise First In).
 * `depth` (derived) = number of raises/all-ins already made, and drives the
 * action-label mapping (13.4).
 */
interface BetContext {
  priorActions: PriorAction[];       // chronological, from first to act up to (not incl.) hero
  /** convenience: how many raise/allin actions occurred before hero acts. */
  raiseDepth: number;                // 0 = unopened (hero RFI), 1 = facing a raise, 2 = facing a 3-bet, ...
}
```

`raiseDepth` is the canonical driver of which labels hero's actions get (Sec 13.4). It is recomputable from `priorActions` (a domain helper), but stored for clarity and cache-key stability.

---

### 13.3 Generalized `SpotConfig`

```ts
type GameMode = 'cash' | 'tournament';

/** Blind/ante structure (bb-denominated; bb is the unit). */
interface Stakes {
  smallBlindBb: number;              // typically 0.5
  bigBlindBb: number;                // 1.0 (the unit)
  anteBb?: number;                   // per-player ante (0 if absent)
  bbAnteBb?: number;                 // big-blind ante (single ante posted by BB), if used
  straddleBb?: number;               // optional straddle (rare; cash)
}

/** Tournament-only payout + stacks context (required iff gameMode==='tournament'). */
interface IcmContext {
  /** Remaining payouts as fractions of the prize pool, descending (length = paid places). */
  payouts: number[];                 // e.g. [0.5, 0.3, 0.2]
  /** ALL live players' stacks in bb, by seatIndex — ICM needs the whole table. */
  stacksBb: number[];                // length === tableSize; mirrors Seat.stackBb
  model: 'malmuth-harville';         // ICM model (ADR-013); future: 'malmuth-weitzman'
}

/**
 * The GENERALIZED spot. Backward-compatible with the HU shape:
 *  tableSize:2 + gameMode:'cash' + the BTN/SB-vs-BB layout == the old HU SpotConfig.
 */
interface SpotConfigV2 {
  schemaVersion: 2;                  // bump from the implicit v1 HU shape
  gameType: 'NLHE';
  gameMode: GameMode;                // 'cash' | 'tournament'   (cash first)
  tableSize: TableSize;              // 2..9
  heroPosition: SeatPosition;        // must be valid for tableSize (13.1.1)
  stakes: Stakes;

  /** Effective stack depth for the live solve, in bb. sub-10 .. 1000 (deep handled by 13.6 caps). */
  effectiveStackBb: number;          // for cash & the 2-eff-player reduction; bucketed for cache

  /** Per-seat stacks. Required for ICM; for E1/E2 cash the engine may treat all = effectiveStackBb. */
  seats?: Seat[];                    // if absent, derived from seatLayout(tableSize) @ effectiveStackBb

  /** Tournament/ICM inputs — REQUIRED iff gameMode==='tournament' (E3). */
  icm?: IcmContext;

  /** The decision point hero faces (prior actions + sizes). Empty => RFI. */
  betContext: BetContext;

  /** Bet-sizing scheme available at hero's node and downstream (Sec 13.5 / betTree). */
  betSizing: BetSizingScheme;

  /** Hero (and, where modeled, the single opponent) ranges. See 13.9 for the
   *  2-effective-player reduction used by E1/E2. */
  ranges?: { hero?: Range; opponent?: Range };

  board?: Board;                     // postflop (E5); absent for preflop E1-E4
}
```

`schemaVersion: 2` lets persistence/migration (Sec 11) distinguish the generalized records from the HU-era ones (EDGE-008).

---

### 13.4 Action taxonomy & label mapping (REQUIRED, unambiguous)

The engine's tree uses a small **canonical action set**; the UI/result then **label** each action by the node's `raiseDepth`. This separates the *mechanical* action from its *poker name*.

```ts
/** Canonical (mechanical) actions the engine emits at any node. */
type CanonicalAction =
  | 'fold'
  | 'call'              // includes "check" when amount-to-call is 0 (UI may relabel)
  | 'raise-small'       // the smaller of the available raise sizes at this node
  | 'raise-big'         // the larger non-all-in raise size at this node
  | 'allin';            // jam / shove (clamped raise-to-stack)

/** The poker-facing label shown to the user, derived from CanonicalAction + raiseDepth. */
type ActionLabel =
  | 'fold' | 'check' | 'call'
  | 'raise' | 'raise-big'                 // raiseDepth 0 (open)  — "raise" = open-raise
  | '3bet' | '3bet-big'                   // raiseDepth 1 (facing an open)
  | '4bet' | '4bet-big'                   // raiseDepth 2 (facing a 3-bet)
  | '5bet'                                // raiseDepth 3 (facing a 4-bet)
  | '3bet-shove' | '4bet-shove' | '5bet-shove' | 'shove'; // all-in variants by depth
```

**Mapping rule (`labelFor(action, raiseDepth)` — a pure domain function):**

| `raiseDepth` at hero's node | `raise-small` → | `raise-big` → | `allin` → | `call`/`fold` |
|----------------------------|------------------|----------------|------------|---------------|
| 0 (unopened — hero RFI) | `raise` (open) | `raise-big` | `shove` (open-jam) | `call`(=limp/complete)/`fold` |
| 1 (facing a single raise) | `3bet` | `3bet-big` | `3bet-shove` | `call`/`fold` |
| 2 (facing a 3-bet) | `4bet` | `4bet-big` | `4bet-shove` | `call`/`fold` |
| 3 (facing a 4-bet) | `5bet` | — | `5bet-shove` | `call`/`fold` |
| 4+ (facing a 5-bet, ≥) | — | — | `shove` | `call`/`fold` |

Rules:
- A **`raise` facing a single raise IS a 3-bet**; an **`allin` facing a 3-bet IS a 4-bet shove**; etc. The label is *always* derived from `raiseDepth`, never hard-coded per node.
- `call` is shown as **`check`** when the amount-to-call is 0 (e.g. BB facing limps), else `call`.
- When only one non-all-in raise size is configured at a node, only the `raise-small`→(open/3bet/4bet/5bet) label is produced; `raise-big` is omitted (no zero-frequency phantom action).
- The number of available raise sizes per node is set by `BetSizingScheme` (13.5) and clamped by the deep-stack caps (13.6).

This mapping is implemented once in the domain core and unit-tested against every `raiseDepth` (NFR-004, BR-003).

---

### 13.5 Generalized bet-sizing scheme

```ts
/** A raise/bet size, expressed as raise-TO in bb OR as a derived rule. */
type SizeSpecV2 =
  | { type: 'to-bb'; toBb: number }            // absolute raise-TO (preflop-friendly)
  | { type: 'pot-fraction'; fraction: number } // postflop / pot-relative (E5)
  | { type: 'bb-multiple'; x: number }         // e.g. 2.5x the current bet
  | { type: 'allin' };

/**
 * Per-raise-depth available sizes. Each node offers up to {small,big}+allin.
 * Sizes are clamped to all-in when they meet/exceed the effective stack (betTree clamp rule).
 */
interface BetSizingScheme {
  id: BetTreeId;                          // canonical id for cache key
  label: string;
  /** sizes available at each raiseDepth; index = raiseDepth. Missing depth => {allin only}. */
  perDepth: Array<{ small?: SizeSpecV2; big?: SizeSpecV2; allowAllIn: boolean }>;
  /** deep-stack abstraction caps (13.6). */
  caps: AbstractionCaps;
}
```

The existing `betTree.ts` "raise-TO + clamp-to-all-in" model generalizes directly: each decision node draws its `small`/`big`/`allin` actions from `perDepth[raiseDepth]`, building children until a player is all-in or `caps.maxRaiseRounds` is hit.

---

### 13.6 Deep-stack abstraction caps (ADR-014)

Deep stacks (200-1000bb) blow up the bet tree (many raise rounds before all-in). We bound it:

```ts
interface AbstractionCaps {
  /** Max number of raise rounds (open=1, 3bet=2, 4bet=3, 5bet=4...) before forcing fold/call/all-in only. */
  maxRaiseRounds: number;                 // e.g. 4 (open..5bet) ; deeper folded into all-in/call
  /** Max distinct non-all-in raise sizes offered at any single node. */
  maxSizesPerNode: 1 | 2;                 // {small} or {small,big}
  /** Stack-depth buckets for cache keying & chart selection (bb). */
  stackBuckets: number[];                 // e.g. [8,12,15,20,25,40,60,75,100,150,200,300,500,1000]
}
```

- Beyond `maxRaiseRounds`, the only further actions are `fold` / `call` / `allin` (terminal-ward), keeping the tree finite regardless of depth.
- `stackBuckets` is the canonical depth quantization for both the cache lookup key (13.8) and chart selection; a spot's `effectiveStackBb` snaps to the nearest bucket for predefined matching (live solves use the exact depth).

---

### 13.7 Generalized `SolveResult` & trust labeling

```ts
/** FIRST-CLASS trust label — every result declares its fidelity (BR-005 generalized). */
type TrustLabel =
  | 'live-solve'        // HU / 2-effective-player live CFR+; carries an exploitability ESTIMATE
  | 'estimate-composite'// live multiway hero-vs-composite-field ESTIMATE (E4) — NOT exact GTO
  | 'estimate-icm'      // live chip-EV solve with an ICM leaf transform, off-grid (E3) — estimate
  | 'predefined';       // served from a precomputed, convention-selected chart

interface TrustInfo {
  label: TrustLabel;
  /** Honest one-liner shown in the transparency banner; never the words "exact GTO". */
  caption: string;                  // e.g. "Live solve (exploitability estimate 3.1 mbb/g)"
  /** present for live-solve; the best-response exploitability estimate. */
  exploitability?: ExploitabilityEstimate;
  /** present for multiway: how the field was collapsed (E4). */
  fieldModel?: 'collapsed-2p' | 'composite-field';
  /** present for predefined: which equilibrium-selection convention produced the chart (E4). */
  equilibriumConvention?: string;   // e.g. "uniform-tiebreak-v1" (ADR-012)
  /** true only when both players are modeled and the game is genuinely zero-sum (HU / 2-eff-player). */
  zeroSumValid: boolean;
}

/** Per-hand strategy entry: distribution over the CANONICAL action set + labels. */
interface HandStrategyV2 {
  handClass: HandClassIndex;        // 0..168
  /** frequency per canonical action present at this node; sums to ~1 (BR-003). */
  freqs: Partial<Record<CanonicalAction, number>>;
  /** the poker labels for those same actions at this node (derived, 13.4). */
  labels: Partial<Record<CanonicalAction, ActionLabel>>;
  /** EV per canonical action, in bb (chip-EV) or ICM-equity (tournament). */
  ev?: Partial<Record<CanonicalAction, number>>;
}

interface NodeStrategyV2 {
  nodeId: number;
  label: string;                    // human node label, e.g. "CO RFI", "BB vs CO open"
  heroSeatIndex: number;
  raiseDepth: number;               // drives the action labels (13.4)
  /** which canonical actions exist at this node (order = display order). */
  actions: CanonicalAction[];
  /** per-169-class strategy. */
  hands: HandStrategyV2[];          // length up to 169
  /** reach-weighted overall action frequency at this node. */
  nodeActionFreq: Partial<Record<CanonicalAction, number>>;
}

interface SolveResultV2 {
  schemaVersion: 2;
  source: ResultSource;             // 'predefined' | 'live'
  trust: TrustInfo;                 // FIRST-CLASS (replaces the bare exploitability for fidelity)
  spot: SpotConfigV2;
  settings: SolveSettings;          // unchanged shape (Sec 5)
  /** hero's decision node (the primary output) + optional downstream nodes. */
  heroNode: NodeStrategyV2;
  subtree?: NodeStrategyV2[];       // deeper nodes (3bet/4bet... continuations)
  /** EV summary in the result's value unit. */
  ev?: { heroBb?: number; unit: 'bb' | 'icm-equity' };
  iterations: number;               // 0 for predefined
  converged: boolean;
  seed: number;
  generatedAt: string;
  engineVersion: string;
  solveTimeMs: number;
}
```

**Honesty invariants (generalize BR-005):**
- `trust.label === 'predefined'` ⇒ `iterations === 0`.
- `trust.label === 'estimate-composite' | 'estimate-icm'` ⇒ `trust.zeroSumValid === false` and the caption MUST say "estimate" (never "exact GTO", never bare "GTO").
- `trust.label === 'live-solve'` ⇒ `trust.exploitability` present and `trust.zeroSumValid === true` (HU or 2-eff-player reduction).

---

### 13.8 Predefined chart entry + lookup-key extension

The existing predefined-cache (Sec 7) is reused unchanged in structure; the **lookup key gains the new dimensions** so multiway/tournament/deep charts can be addressed:

```ts
interface LookupKeyV2 {
  schemaVersion: 2;
  gameType: 'NLHE';
  gameMode: GameMode;                 // NEW: 'cash' | 'tournament'
  tableSize: TableSize;               // NEW: 2..9 (was fixed 2)
  heroPosition: SeatPosition;         // NEW (replaces the HU ip/oop pair)
  betContextCanonical: string;        // NEW: canonical-serialized BetContext (prior actions+sizes)
  stackBucketBb: number;              // depth snapped to AbstractionCaps.stackBuckets
  /** tournament only: payout-structure id + stack-distribution bucket. */
  icmKey?: { payoutId: string; stackDistBucket: string; model: 'malmuth-harville' };
  betTreeId: BetTreeId;
  rangeRef?: { hero: RangeRef; opponent?: RangeRef }; // standard-range id or hash
  boardCanonical?: string;            // postflop (E5), suit-isomorphic
  abstractionId: AbstractionId;
  formatVersion: number;
}
```

```ts
/** A predefined chart entry carries the SAME payload (a SolveResultV2) PLUS chart provenance. */
interface PredefinedChartMeta extends GenerationMeta {
  /** which equilibrium the chart baked (general-sum has many — ADR-012). */
  equilibriumConvention: string;      // e.g. "uniform-tiebreak-v1"
  trustLabel: Extract<TrustLabel, 'predefined'>;
  /** for multiway charts: the composite-field assumptions used to generate it. */
  fieldAssumptions?: string;
}
```

The cache matcher (ARCHITECTURE Sec 7.2) rules are unchanged: **exact normalized-key match only**; on miss → live (`estimate-composite` for multiway, `live-solve` for HU/2-eff-player). `stackBucketBb` and `betContextCanonical` are the new normalization axes; depth snaps to a bucket, the bet context serializes deterministically.

---

### 13.9 The E1/E2 two-effective-player reduction (the trustworthy core)

**This is what the engineer implements now.** A multiway *table configuration* (any `tableSize`) is reduced to a genuinely **zero-sum 2-player** solve so the live solve stays trustworthy:

- **RFI (hero unopened, `raiseDepth === 0`):** hero vs **the collapsed remaining field treated as one opponent**. The field is the union of the still-to-act players plus the blinds; in E1 it is modeled as a single opponent holding a "calls/3-bets vs an open" continuation range. The pot includes posted blinds/antes. This is the standard "open-raise vs the field" simplification used by preflop chart trainers.
- **Facing a single raise (`raiseDepth === 1`):** hero vs **the raiser only** (other unacted players are folded out of the modeled subgame — a documented simplification). Zero-sum and trustworthy between the two modeled players.
- **Facing 3-bet/4-bet/5-bet (`raiseDepth ≥ 2`):** hero vs the **last aggressor**; the contested pot and contributions come from `betContext`.

Mechanically, the existing `solvePreflopTree` engine (a 2-player CFR+ over `betTree`) is **unchanged**; the generalization is entirely in **how `SpotConfigV2` projects to the 2-player `BetTreeConfig`** (positions → who-acts/contributions, blinds/antes → starting pot, `betContext` → which subtree/root node, `betSizing` → raise sizes). The `equity` matrix (169×169) is reused as-is for the heads-up showdown between the two modeled players.

**Fidelity labeling for E1/E2:** `trust.label = 'live-solve'`, `trust.zeroSumValid = true`, `trust.fieldModel = 'collapsed-2p'`, and the caption is explicit, e.g. *"Live solve — hero vs single opponent (remaining field collapsed); exploitability estimate X mbb/g."* This is honest: it is an exact equilibrium **of the 2-player model**, which is a deliberate, labeled approximation of the multiway table — **not** a multiway GTO solve. The full multiway composite-field model is **E4** (`estimate-composite`).

---

### 13.9.1 Scenario builder — full authored action timeline (IMPLEMENTED)

The user authors the **complete preflop action before the hero** rather than assuming everyone folds. Each seat acting before the hero is assigned an action (`fold` / `limp` / `call` / `raise`-to-X / `allin`), captured in `BetContext.priorActions` (each carries `seatIndex`, `kind`, and `toBb` for raises). `raiseDepth` = count of raises/all-ins before hero.

**Default opponent ranges (`defaultRanges.ts`).** Each non-fold opponent action implies a *range*. The solver auto-assigns a sensible default range keyed by (position-tier, action-type, stack-bucket) — standard approximate charts (open / call / 3-bet / 4-bet / jam / call-jam). These are the **assumed entering ranges**, explicitly labeled and editable later (per-actor range overrides are a pure-UI follow-up; the data model carries them). Provenance is documented in-module; they are a starting assumption, never ground truth.

**Composite collapse (`range169.combineComposite`).** All live (non-folded) opponents are collapsed into ONE composite opponent range (per class: probability that *at least one* live opponent holds it), passed into `solvePreflopTree` as the opponent side's **entering-range weights** (`sbRangeWeights`/`bbRangeWeights`). Card removal between the composite and hero is preserved via `PAIR_WEIGHTS`.

**Correct cold-call pot odds without a dead-pot (`projectSpot.ts`).** The zero-sum `betTree` has no dead-money slot, and naively modeling a non-blind cold-caller as "the big blind" overstates calling (it credits ~1bb never posted). For a **responder** facing a raise `R`, hero's modeled posted chips are set to
`bTree = R·(D + 2·hb) / (2R + D)`, where `hb` = hero's real posted blind and `D` = other dead money (folded/behind blinds not hero's or the aggressor's, + antes + extra callers' committed chips). This makes the tree's call/fold **break-even equity equal the true one including dead money**. It reduces to the real blind for HU/blind-defense (D→0 ⇒ bTree = hb) and to a small dead-money-adjusted post for a non-blind cold-caller (hb = 0 ⇒ bTree = R·D/(2R+D)). The folded chips are not injected into the pot directly (so the deeper 3-bet/4-bet sub-nodes are slightly approximate), which is acceptable under the estimate tier.

**Trust labeling keyed on live-opponent count** (`resultV2.buildTrustInfo`): the number of live opponents hero contends with = in-pot opponents + seats still to act behind hero.
- **1 live opponent** → `live-solve` (a trustworthy 2-player subgame). If that opponent's range was an assumed default, the caption appends *"vs assumed opponent range"* (best play vs those ranges, not co-solved from scratch).
- **≥2 live opponents** → `estimate-composite` / `fieldModel: 'composite-field'`: the field is collapsed to one composite opponent — an **estimate**, never "exact multiway GTO".

**Position-calibrated multiway opens (`openRealizationEdge`).** An open is hero vs one collapsed defender, which alone can't see the players still to act. We make opens **position-aware** by scaling the see-flop **positional realization edge** down as the number of players behind grows (more players ⇒ more resistance + OOP multiway postflop ⇒ tighter open). Calibrated values land close to known GTO widths: HU ≈ 92%, BTN(6) ≈ 50%, CO ≈ 32%, HJ ≈ 22%, UTG(6) ≈ 17%, UTG(9) ≈ 15%, monotonically tightening with position. It is a **heuristic for the live estimate** (labeled `estimate-composite`); reference-grade opens still belong to the E4 precomputed-chart path.

**Range editing (IMPLEMENTED).** Any live opponent's assumed range is overridable via an inline 13×13 editor. The override is stored on `PriorAction.range` (169 weights) and takes precedence over the default in `buildComposite`; `defaultRangeForSeat()` seeds the editor from the default. Clearing the override restores the default. This is the "editable later" capability promised when the default-range library shipped.

---

### 13.10 ICM leaf transform (E3) — tree unchanged, leaf valuation swapped

ICM does **not** change the bet tree. It changes only how a **terminal leaf's chip stacks** are valued:

```ts
/** Pure domain function: post-hand chip stacks → each player's tournament EQUITY (prize fraction). */
type IcmTransform = (postHandStacksBb: number[], icm: IcmContext) => number[]; // length = tableSize
```

- For cash (`gameMode==='cash'`): leaf value = chip-EV delta (current model, identity transform). This is E1/E2.
- For tournament (`gameMode==='tournament'`): the terminal `contrib`/stack outcome is converted to **post-hand stacks for all seats**, then `IcmTransform` (Malmuth-Harville, ADR-013) maps stacks → prize-equity; the CFR objective maximizes **equity delta** instead of chip delta. The result's `ev.unit` becomes `'icm-equity'` and `trust.label` is `estimate-icm` (live, off-grid) or `predefined` (chart).
- **Gated on the ICM correctness spike** (Sec 13.11 / ADR-013): the transform is validated numerically against a reference ICM calculator before E3 ships.

---

### 13.11 Feasibility spikes (go/no-go gates)

Three spikes gate the risky scope-expansion pieces (owned jointly with SDET):

| Spike | Question | Pass criterion | Gates |
|-------|----------|----------------|-------|
| **SPK-MW (multiway quality)** | Does the composite-field live estimate produce *useful*, *stable* strategies vs a multiway reference? | Estimates within an agreed qualitative tolerance of a reference multiway solver on a fixed spot suite; no pathological/unstable outputs. | E4 live estimate |
| **SPK-ICM (ICM correctness)** | Does our Malmuth-Harville transform match a trusted ICM calculator? | Per-seat equity within a tight numeric tolerance (e.g. ≤0.1% prize-pool) across a payout/stack-distribution suite. | E3 |
| **SPK-DEEP (deep-stack abstraction)** | Do the abstraction caps keep 200-1000bb solves tractable AND low-exploitability within the abstracted game? | Worst-in-bound tree fits the memory budget; exploitability within abstraction stays low; strategies sane vs known deep references. | E2 deep depths |

Each spike is a **build-time experiment**, not shipped code; a fail blocks (or rescopes) the dependent milestone.

---

### 13.12 Backward-compat / migration

- The shipped HU slice (`src/engine/types.ts`: `PushFoldSpot`, `PreflopTreeSpot`) is the **`schemaVersion:1`** world. `SpotConfigV2`/`SolveResultV2` are `schemaVersion:2`.
- A pure domain adapter `upgradeHuSpot(v1): SpotConfigV2` maps the HU `PreflopTreeSpot` to `tableSize:2, gameMode:'cash', heroPosition:'BTN'(=SB), betContext:{raiseDepth:0}, betSizing` from the three legacy raise sizes. The HU solve is then the `tableSize:2` instance of the general path — **no separate code path**.
- Persistence (Sec 11): `meta.schemaVersion` distinguishes records; `onupgradeneeded` leaves v1 records readable and tags them for optional re-solve (EDGE-008). No destructive migration.
