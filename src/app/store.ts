// Application state (Zustand). Single source of UI truth; integration point for
// async worker events (ARCHITECTURE Sec 4.2). The generalized 'preflop-spot' config
// (SpotConfigV2) drives a single solve path for HU + multiway cash. The user authors
// a FULL preflop scenario: each seat acting before the hero is assigned an action
// (fold / limp / call / raise-to-X / all-in), which defines hero's decision node and
// the (default) ranges the opponents arrive with.

import { create } from 'zustand';
import { SolverWorkerClient } from '../worker/workerClient';
import { defaultBetSizing } from '../domain/projectSpot';
import { lookupChart, chartToResult } from '../domain/charts';
import { validPositions, seatIndexOf, seatLayout, preflopActionOrder } from '../domain/seatLayout';
import type {
  AnySolveResult,
  SolveProgress,
  SolveResultV2,
  SolveSettings,
  SpotConfigV2,
} from '../engine/types';
import type {
  BetContext,
  GameMode,
  PriorAction,
  PriorActionKind,
  SeatPosition,
  TableSize,
} from '../domain/spotV2';

// One worker client for the app lifetime.
const engine = new SolverWorkerClient();

export const DEFAULT_SETTINGS: SolveSettings = {
  algorithm: 'cfr+',
  seed: 1337,
  iterations: 1500,
  equitySamples: 600,
};

/** A user-authored action for a single seat acting before the hero. */
export interface SeatActionInput {
  kind: PriorActionKind;
  /** raise-TO amount in bb (for kind 'raise'); ignored otherwise. */
  toBb?: number;
  /** optional 169-weight range override from the range editor (else the default is used). */
  range?: number[];
}

/** A seat as presented in the scenario editor (action order). */
export interface ScenarioSeat {
  seatIndex: number;
  position: SeatPosition;
  /** 'before' = acts before hero (authorable); 'hero'; 'behind' = yet to act. */
  role: 'before' | 'hero' | 'behind';
  action: SeatActionInput; // meaningful only for role 'before'
}

/** Suggested raise-TO size given the current outstanding bet (open ~2.5x, re-raise ~2.5x). */
function suggestRaiseTo(currentBet: number, sizes: { openTo: number; threeBetTo: number }): number {
  if (currentBet <= 1) return sizes.openTo; // opening over the blind
  if (currentBet <= sizes.openTo + 1e-9) return sizes.threeBetTo; // 3-bet over an open
  return Math.round(currentBet * 2.4 * 10) / 10; // 4-bet+ ~2.4x
}

/**
 * Build the ordered scenario seats for the current table/hero, merging any authored
 * actions. Seats before hero default to FOLD; seats after hero are 'behind'.
 */
export function scenarioSeats(
  tableSize: TableSize,
  heroPosition: SeatPosition,
  authored: Record<number, SeatActionInput>,
): ScenarioSeat[] {
  const order = preflopActionOrder(tableSize); // seatIndex[] first->last
  const layout = seatLayout(tableSize);
  const posOf = (si: number) => layout.find((s) => s.seatIndex === si)!.position;
  const heroSeat = seatIndexOf(tableSize, heroPosition);
  const heroOrderIdx = order.indexOf(heroSeat);
  return order.map((seatIndex, idx) => {
    let role: ScenarioSeat['role'] = 'behind';
    if (seatIndex === heroSeat) role = 'hero';
    else if (idx < heroOrderIdx) role = 'before';
    return {
      seatIndex,
      position: posOf(seatIndex),
      role,
      action: authored[seatIndex] ?? { kind: 'fold' },
    };
  });
}

/** Convert authored actions into the SpotConfigV2 betContext (prior actions + raiseDepth). */
function buildBetContext(
  tableSize: TableSize,
  heroPosition: SeatPosition,
  authored: Record<number, SeatActionInput>,
): BetContext {
  const seats = scenarioSeats(tableSize, heroPosition, authored);
  const priorActions: PriorAction[] = [];
  let raiseDepth = 0;
  for (const s of seats) {
    if (s.role !== 'before') continue;
    const a = s.action;
    priorActions.push({ seatIndex: s.seatIndex, kind: a.kind, toBb: a.toBb, range: a.range });
    if (a.kind === 'raise' || a.kind === 'allin') raiseDepth++;
  }
  return { priorActions, raiseDepth };
}

export function buildSpot(
  gameMode: GameMode,
  tableSize: TableSize,
  heroPosition: SeatPosition,
  stackBb: number,
  authored: Record<number, SeatActionInput>,
): SpotConfigV2 {
  const sizes = defaultBetSizing();
  return {
    schemaVersion: 2,
    gameType: 'NLHE',
    gameMode,
    tableSize,
    heroPosition,
    stakes: { smallBlindBb: 0.5, bigBlindBb: 1.0 },
    effectiveStackBb: stackBb,
    betContext: buildBetContext(tableSize, heroPosition, authored),
    betSizing: sizes,
  };
}

interface AppState {
  gameMode: GameMode;
  tableSize: TableSize;
  heroPosition: SeatPosition;
  stackBb: number;
  /** authored actions keyed by seatIndex (only seats before hero are meaningful). */
  seatActions: Record<number, SeatActionInput>;

  status: 'idle' | 'solving' | 'done' | 'error';
  progress: SolveProgress | null;
  result: SolveResultV2 | null;
  error: string | null;
  selectedNodeId: number | null;

  setGameMode: (m: GameMode) => void;
  setTableSize: (n: TableSize) => void;
  setHeroPosition: (p: SeatPosition) => void;
  setStackBb: (bb: number) => void;
  setSeatAction: (seatIndex: number, kind: PriorActionKind) => void;
  setSeatRaiseTo: (seatIndex: number, toBb: number) => void;
  setSeatRange: (seatIndex: number, range: number[] | undefined) => void;
  resetScenario: () => void;
  selectNode: (id: number) => void;
  solve: () => Promise<void>;
}

/** Keep hero position valid when table size changes. */
function clampHero(tableSize: TableSize, hero: SeatPosition): SeatPosition {
  const valid = validPositions(tableSize);
  return valid.includes(hero) ? hero : valid[0];
}

/** Drop authored actions for seats that are no longer "before hero". */
function pruneActions(
  tableSize: TableSize,
  heroPosition: SeatPosition,
  authored: Record<number, SeatActionInput>,
): Record<number, SeatActionInput> {
  const next: Record<number, SeatActionInput> = {};
  for (const s of scenarioSeats(tableSize, heroPosition, authored)) {
    if (s.role === 'before' && authored[s.seatIndex]) next[s.seatIndex] = authored[s.seatIndex];
  }
  return next;
}

/** Current outstanding bet (bb) faced by the seat at `seatIndex`, from earlier actions. */
function outstandingBetBefore(
  tableSize: TableSize,
  heroPosition: SeatPosition,
  authored: Record<number, SeatActionInput>,
  seatIndex: number,
): number {
  const seats = scenarioSeats(tableSize, heroPosition, authored);
  let bet = 1; // big blind
  for (const s of seats) {
    if (s.seatIndex === seatIndex) break;
    if (s.role === 'before' && (s.action.kind === 'raise' || s.action.kind === 'allin')) {
      bet = Math.max(bet, s.action.toBb ?? bet);
    }
  }
  return bet;
}

export const useStore = create<AppState>((set, get) => ({
  gameMode: 'cash',
  tableSize: 6,
  heroPosition: 'BTN',
  stackBb: 100,
  seatActions: {},

  status: 'idle',
  progress: null,
  result: null,
  error: null,
  selectedNodeId: null,

  setGameMode: (m) => set({ gameMode: m }),
  setTableSize: (n) =>
    set((s) => {
      const hero = clampHero(n, s.heroPosition);
      return { tableSize: n, heroPosition: hero, seatActions: pruneActions(n, hero, s.seatActions) };
    }),
  setHeroPosition: (p) =>
    set((s) => ({ heroPosition: p, seatActions: pruneActions(s.tableSize, p, s.seatActions) })),
  setStackBb: (bb) => set({ stackBb: bb }),
  setSeatAction: (seatIndex, kind) =>
    set((s) => {
      const action: SeatActionInput = { kind };
      if (kind === 'raise') {
        const bet = outstandingBetBefore(s.tableSize, s.heroPosition, s.seatActions, seatIndex);
        action.toBb = suggestRaiseTo(bet, { openTo: 2.5, threeBetTo: 11 });
      } else if (kind === 'allin') {
        action.toBb = s.stackBb;
      }
      return { seatActions: { ...s.seatActions, [seatIndex]: action } };
    }),
  setSeatRaiseTo: (seatIndex, toBb) =>
    set((s) => {
      const prev = s.seatActions[seatIndex];
      if (!prev || prev.kind !== 'raise') return {};
      return { seatActions: { ...s.seatActions, [seatIndex]: { ...prev, toBb } } };
    }),
  setSeatRange: (seatIndex, range) =>
    set((s) => {
      const prev = s.seatActions[seatIndex] ?? { kind: 'fold' as PriorActionKind };
      return { seatActions: { ...s.seatActions, [seatIndex]: { ...prev, range } } };
    }),
  resetScenario: () => set({ seatActions: {} }),
  selectNode: (id) => set({ selectedNodeId: id }),

  solve: async () => {
    const { gameMode, tableSize, heroPosition, stackBb, seatActions } = get();
    try {
      seatIndexOf(tableSize, heroPosition);
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
      return;
    }
    set({ status: 'solving', progress: null, error: null });
    try {
      const spot = buildSpot(gameMode, tableSize, heroPosition, stackBb, seatActions);

      // Cache-first: serve a predefined chart instantly when one matches (E4).
      const chart = lookupChart(spot);
      if (chart) {
        const result = chartToResult(spot, chart);
        set({ status: 'done', result, progress: null, selectedNodeId: result.heroNode.nodeId });
        return;
      }

      const result: AnySolveResult = await engine.solve(
        { mode: 'preflop-spot', spot, settings: DEFAULT_SETTINGS },
        (p) => set({ progress: p }),
      );
      if (result.mode !== 'preflop-spot') throw new Error('unexpected result mode');
      set({ status: 'done', result, progress: null, selectedNodeId: result.heroNode.nodeId });
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  },
}));
