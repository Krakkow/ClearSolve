// Engine port types — aligned with API_SPEC Sec 2 and DATA_MODEL Sec 5/6.
//
// This is the SWAP-IN CONTRACT. The current implementation is pure TypeScript
// (PushFoldTsEngine), but a future Rust->WASM engine must implement this same
// `SolverEngine` interface so the UI/worker wiring never changes.
//
// For this first vertical slice we model the HU PREFLOP PUSH/FOLD spot. The
// SpotConfig is intentionally a trimmed, slice-specific subset of the full
// DATA_MODEL SpotConfig (effectiveStackBb, positions). It can be widened later
// without breaking the port shape.
//
// E1 widens the request/result with the GENERALIZED config (SpotConfigV2 /
// SolveResultV2, DATA_MODEL Sec 13) for 2-9 players cash; the port method is
// unchanged (API_SPEC Sec 7.0).

import type { SpotConfigV2, SolveResultV2 } from '../domain/spotV2';
export type { SpotConfigV2, SolveResultV2 } from '../domain/spotV2';

export type Position = 'BTN' | 'SB' | 'BB';

/** Trimmed spot for the push/fold slice (subset of DATA_MODEL SpotConfig). */
export interface PushFoldSpot {
  gameType: 'NLHE';
  players: 2;
  variant: 'preflop-push-fold';
  effectiveStackBb: number; // e.g. 10
  smallBlindBb: number; // 0.5
  bigBlindBb: number; // 1.0
  positions: { sb: Position; bb: Position }; // HU: SB(button) vs BB
}

/** Spot for the HU preflop BET-TREE slice (raise/3bet/4bet/jam over a tree). */
export interface PreflopTreeSpot {
  gameType: 'NLHE';
  players: 2;
  variant: 'preflop-bet-tree';
  effectiveStackBb: number; // 10..200
  smallBlindBb: number; // 0.5
  bigBlindBb: number; // 1.0
  positions: { sb: Position; bb: Position };
  /** raise-TO sizes (total contribution by the raiser), in bb. */
  sizes: { openTo: number; threeBetTo: number; fourBetTo: number };
}

/** Run settings (subset of DATA_MODEL SolveSettings). */
export interface SolveSettings {
  algorithm: 'fictitious-play' | 'cfr+';
  seed: number; // determinism (NFR-004)
  /** solver iterations for the equilibrium (fictitious play OR CFR+). */
  iterations: number;
  /** Monte Carlo samples per class-vs-class equity pairing. */
  equitySamples: number;
}

export interface EngineInfo {
  engineVersion: string;
  engineKind: 'ts' | 'wasm';
  threading: 'single' | 'multi';
  crossOriginIsolated: boolean;
  deterministic: true;
}

/**
 * SolveRequest is a discriminated union over `mode`. All modes flow through the SAME
 * SolverEngine.solve() and the SAME worker protocol; the engine dispatches on mode.
 *  - 'push-fold' / 'bet-tree' : the v1 HU slices (retained).
 *  - 'preflop-spot'           : the E1 generalized config (SpotConfigV2), which the
 *    engine PROJECTS to a 2-player BetTreeConfig (DATA_MODEL 13.9) and solves with the
 *    same CFR+ core. (API_SPEC Sec 7.1.)
 */
export type SolveRequest =
  | { mode: 'push-fold'; spot: PushFoldSpot; settings: SolveSettings }
  | { mode: 'bet-tree'; spot: PreflopTreeSpot; settings: SolveSettings }
  | { mode: 'preflop-spot'; spot: SpotConfigV2; settings: SolveSettings };

export interface SolveProgress {
  phase:
    | 'building-equity'
    | 'building-tree'
    | 'solving'
    | 'computing-exploitability';
  fraction: number; // 0..1
  iterations?: number;
}

/** Per-class strategy frequencies for the push/fold result. */
export interface PushFoldStrategyGrid {
  /** length 169; sbJam[i] = frequency SB jams class i. */
  sbJam: number[];
  /** length 169; bbCall[i] = frequency BB calls class i facing a jam. */
  bbCall: number[];
}

/** Exploitability — always an ESTIMATE, never "exact GTO" (BR-005). */
export interface ExploitabilityEstimate {
  valueBbPerGame: number;
  valueMbbPer100: number;
  unit: 'bb/g';
  measuredAtIteration: number;
  label: 'estimate';
}

/** SolveResult, shaped after DATA_MODEL Sec 6 (slice subset). */
export interface PushFoldSolveResult {
  mode: 'push-fold';
  source: 'live';
  spot: PushFoldSpot;
  settings: SolveSettings;
  strategy: PushFoldStrategyGrid;
  /** combo-weighted fractions for headline display. */
  sbJamFraction: number;
  bbCallFraction: number;
  exploitability: ExploitabilityEstimate;
  iterations: number;
  converged: boolean;
  seed: number;
  generatedAt: string; // ISO timestamp
  engineVersion: string;
  solveTimeMs: number;
}

/** Strategy at one decision node of the bet tree (per-class mixed strategy). */
export interface TreeNodeStrategy {
  nodeId: number;
  label: string; // e.g. "SB Open", "BB vs Open"
  toAct: 0 | 1; // 0 = SB, 1 = BB
  actionLabels: string[]; // e.g. ["Fold","Open 2.5","All-in"]
  /** strategy[classIndex] = per-action frequencies (sums to 1). length 169. */
  strategy: number[][];
  /** reach-weighted overall action frequencies at this node. */
  nodeActionFreq: number[];
  /** contributions [SB, BB] when arriving at this node (pot/stack context). */
  contrib: [number, number];
}

/** Bet-tree solve result. */
export interface PreflopTreeSolveResult {
  mode: 'bet-tree';
  source: 'live';
  spot: PreflopTreeSpot;
  settings: SolveSettings;
  nodes: TreeNodeStrategy[];
  exploitability: ExploitabilityEstimate;
  /** root EV (SB net) and BB net, in bb — should be ~zero-sum. */
  evSb: number;
  evBb: number;
  iterations: number;
  converged: boolean;
  seed: number;
  generatedAt: string;
  engineVersion: string;
  solveTimeMs: number;
}

export type AnySolveResult =
  | PushFoldSolveResult
  | PreflopTreeSolveResult
  | SolveResultV2;

// Re-export the V2 spot type name so engine consumers can import it from here too.
export type { SpotConfigV2 as PreflopSpotConfig };

/**
 * The SolverEngine port — the swap-in contract (API_SPEC Sec 2).
 * A Rust->WASM engine implements this same interface inside the worker. All solve
 * modes (push-fold, bet-tree, preflop-spot) flow through this one method.
 */
export interface SolverEngine {
  info(): EngineInfo;
  /** Run a live solve; streams progress; resolves with the final result. */
  solve(
    req: SolveRequest,
    onProgress: (p: SolveProgress) => void,
  ): Promise<AnySolveResult>;
}
