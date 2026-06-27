// Generalized domain model (DATA_MODEL Sec 13) — the scope-expansion types for
// 2-9 players, cash (+ tournament/ICM forward-declared but disabled in E1).
//
// These SUPERSEDE the HU-only SpotConfig/SolveResult shapes; the HU slice remains
// valid as the tableSize:2 projection. For E1 we implement: seatLayout, labelFor,
// projectToBetTreeConfig, the 'preflop-spot' engine mode, and the trust labeling.

export type TableSize = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type SeatPosition =
  | 'SB'
  | 'BB'
  | 'UTG'
  | 'UTG1'
  | 'MP'
  | 'LJ'
  | 'HJ'
  | 'CO'
  | 'BTN';

export interface Seat {
  seatIndex: number; // 0 = SB, 1 = BB, 2 = first to act preflop, ... last = BTN
  position: SeatPosition;
  stackBb: number;
}

export type GameMode = 'cash' | 'tournament';

export interface Stakes {
  smallBlindBb: number; // typically 0.5
  bigBlindBb: number; // 1.0 (the unit)
  anteBb?: number; // per-player ante
  bbAnteBb?: number; // big-blind ante (single ante posted by BB)
  straddleBb?: number;
}

export type PriorActionKind = 'fold' | 'call' | 'limp' | 'raise' | 'allin';

export interface PriorAction {
  seatIndex: number;
  kind: PriorActionKind;
  /** raiser's TOTAL contribution after the action ("raise-TO"), in bb. */
  toBb?: number;
  /** optional per-actor range override (169 weights, each 0..1). Omit => default range. */
  range?: number[];
}

export interface BetContext {
  priorActions: PriorAction[]; // chronological, up to (not incl.) hero
  raiseDepth: number; // 0 = hero RFI, 1 = facing a raise, 2 = facing a 3-bet, ...
}

// --- Canonical (mechanical) action set the engine emits at any node. ---
export type CanonicalAction = 'fold' | 'call' | 'raise-small' | 'raise-big' | 'allin';

// --- Poker-facing label derived from CanonicalAction + raiseDepth (13.4). ---
export type ActionLabel =
  | 'fold'
  | 'check'
  | 'call'
  | 'raise'
  | 'raise-big'
  | '3bet'
  | '3bet-big'
  | '4bet'
  | '4bet-big'
  | '5bet'
  | '3bet-shove'
  | '4bet-shove'
  | '5bet-shove'
  | 'shove';

// --- Bet-sizing scheme (subset of 13.5/13.6 needed for E1). ---
export interface BetSizingScheme {
  id: string;
  label: string;
  /** Raise-TO sizes per raise depth, in bb (E1 uses absolute raise-TO). */
  openTo: number; // depth 0 open
  threeBetTo: number; // depth 1
  fourBetTo: number; // depth 2
}

export interface SpotConfigV2 {
  schemaVersion: 2;
  gameType: 'NLHE';
  gameMode: GameMode;
  tableSize: TableSize;
  heroPosition: SeatPosition;
  stakes: Stakes;
  effectiveStackBb: number;
  seats?: Seat[];
  betContext: BetContext;
  betSizing: BetSizingScheme;
}

// --- Trust labeling (13.7). FIRST-CLASS fidelity declaration. ---
export type TrustLabel =
  | 'live-solve'
  | 'estimate-composite'
  | 'estimate-icm'
  | 'predefined';

export interface ExploitabilityEstimateV2 {
  valueBbPerGame: number;
  valueMbbPer100: number;
  unit: 'bb/g';
  measuredAtIteration: number;
  label: 'estimate';
}

export interface TrustInfo {
  label: TrustLabel;
  /** Honest one-liner; never the words "exact GTO". */
  caption: string;
  exploitability?: ExploitabilityEstimateV2;
  fieldModel?: 'collapsed-2p' | 'composite-field';
  equilibriumConvention?: string;
  zeroSumValid: boolean;
}

export interface HandStrategyV2 {
  handClass: number; // 0..168
  freqs: Partial<Record<CanonicalAction, number>>;
  labels: Partial<Record<CanonicalAction, ActionLabel>>;
  ev?: Partial<Record<CanonicalAction, number>>;
}

export interface NodeStrategyV2 {
  nodeId: number;
  label: string;
  heroSeatIndex: number;
  raiseDepth: number;
  actions: CanonicalAction[];
  /** poker labels for those actions at this node (parallel to `actions`). */
  actionLabels: ActionLabel[];
  hands: HandStrategyV2[];
  nodeActionFreq: Partial<Record<CanonicalAction, number>>;
  /** contributions [SB-seat, BB-seat] or [hero-side, opp-side] for pot context. */
  contrib: [number, number];
}

export interface SolveResultV2 {
  schemaVersion: 2;
  mode: 'preflop-spot';
  source: 'live' | 'predefined';
  trust: TrustInfo;
  spot: SpotConfigV2;
  settings: unknown; // SolveSettings (engine/types); kept loose to avoid a cycle
  heroNode: NodeStrategyV2;
  subtree?: NodeStrategyV2[];
  ev?: { heroBb?: number; unit: 'bb' | 'icm-equity' };
  iterations: number;
  converged: boolean;
  seed: number;
  generatedAt: string;
  engineVersion: string;
  solveTimeMs: number;
}
