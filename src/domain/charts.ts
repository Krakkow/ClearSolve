// Predefined CHART LIBRARY (FEAT-019, E4) — curated reference preflop charts served
// INSTANTLY (no live solve) for common spots, with a live-solve/estimate fallback for
// anything off-grid. These are CURATED REFERENCE ranges (standard ~100bb charts), NOT
// solved by this engine — results are labeled "Predefined chart (reference)".
//
// v1 coverage: cash, ~100bb effective, RFI (raise-first-in / fold-to-hero) for every
// opening position, 6-max AND 9-max. Off-grid (other depths, facing action, custom
// ranges/overrides) falls through to the live path.

import { parseRange } from './range169';
import { seatLayout } from './seatLayout';
import { labelFor } from './actionLabels';
import type {
  CanonicalAction,
  HandStrategyV2,
  NodeStrategyV2,
  SeatPosition,
  SolveResultV2,
  SpotConfigV2,
  TableSize,
} from './spotV2';

// --- Curated RFI (open) ranges, ~100bb. Approximate standard charts; widen with
//     position and (for the same seat) with fewer players behind (6-max vs 9-max). ---
const RFI_9MAX: Partial<Record<SeatPosition, string>> = {
  UTG: '55+, ATs+, KTs+, QTs+, JTs, T9s, 98s, AJo+, KQo',
  UTG1: '44+, A9s+, KTs+, QTs+, JTs, T9s, 98s, AJo+, KQo',
  MP: '33+, A8s+, K9s+, QTs+, JTs, T9s, 98s, ATo+, KJo+, QJo',
  LJ: '22+, A7s+, K9s+, Q9s+, J9s+, T9s, 98s, 87s, ATo+, KJo+, QJo',
  HJ: '22+, A5s+, K8s+, Q9s+, J9s+, T8s+, 98s, 87s, 76s, A9o+, KTo+, QTo+, JTo',
  CO: '22+, A2s+, K6s+, Q8s+, J8s+, T8s+, 97s+, 87s, 76s, 65s, A8o+, KTo+, QTo+, JTo',
  BTN: '22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 96s+, 86s+, 75s+, 65s, 54s, A2o+, K9o+, Q9o+, J9o+, T9o, 98o',
  SB: '22+, A2s+, K5s+, Q7s+, J8s+, T8s+, 97s+, 86s+, 76s, 65s, 54s, A2o+, K9o+, Q9o+, JTo',
};

const RFI_6MAX: Partial<Record<SeatPosition, string>> = {
  UTG: '22+, A8s+, KTs+, QTs+, JTs, T9s, 98s, ATo+, KJo+, QJo',
  HJ: '22+, A7s+, K9s+, Q9s+, J9s+, T9s, 98s, 87s, ATo+, KJo+, QJo',
  CO: '22+, A2s+, K7s+, Q9s+, J9s+, T8s+, 97s+, 87s, 76s, A9o+, KTo+, QTo+, JTo',
  BTN: '22+, A2s+, K4s+, Q7s+, J8s+, T7s+, 96s+, 86s+, 75s+, 65s, 54s, A2o+, K9o+, Q9o+, J9o+, T9o',
  SB: '22+, A2s+, K5s+, Q7s+, J8s+, T8s+, 97s+, 86s+, 76s, 65s, A2o+, K9o+, Q9o+, JTo',
};

function rfiTable(tableSize: TableSize): Partial<Record<SeatPosition, string>> | null {
  if (tableSize <= 6) return RFI_6MAX;
  if (tableSize >= 7) return RFI_9MAX;
  return null;
}

/** A served chart: the hero's decision node + a provenance caption. */
export interface ChartResult {
  heroNode: NodeStrategyV2;
  caption: string;
  key: string;
}

/** ~100bb chart bucket — only serve a 100bb chart when the stack is close to it. */
function is100bbBucket(stackBb: number): boolean {
  return stackBb >= 75 && stackBb <= 150;
}

/** True if the scenario is "folds to hero" (pure RFI): no live action before hero. */
function isFoldToHero(spot: SpotConfigV2): boolean {
  if (spot.betContext.raiseDepth !== 0) return false;
  return spot.betContext.priorActions.every((a) => a.kind === 'fold' && !a.range);
}

/** Build an RFI chart node (actions: fold / open-raise) from a curated range string. */
function buildRfiNode(rangeStr: string, heroSeatIndex: number): NodeStrategyV2 {
  const inRange = parseRange(rangeStr); // 169 weights (1 = open, 0 = fold)
  const actions: CanonicalAction[] = ['fold', 'raise-small'];
  const actionLabels = actions.map((a) => labelFor(a, 0, { amountToCallBb: 0 }));

  const hands: HandStrategyV2[] = [];
  let openSum = 0;
  let count = 0;
  for (let k = 0; k < 169; k++) {
    const open = inRange[k] > 0 ? 1 : 0;
    hands.push({
      handClass: k,
      freqs: { fold: 1 - open, 'raise-small': open },
      labels: { fold: actionLabels[0], 'raise-small': actionLabels[1] },
    });
    openSum += open;
    count++;
  }
  // node-level frequency is combo-agnostic here (class-uniform) — a reasonable summary
  // for a pure reference chart; per-hand detail is exact.
  const openFreq = count > 0 ? openSum / count : 0;

  return {
    nodeId: 0,
    label: 'RFI',
    heroSeatIndex,
    raiseDepth: 0,
    actions,
    actionLabels,
    hands,
    nodeActionFreq: { fold: 1 - openFreq, 'raise-small': openFreq },
    contrib: [0, 0],
  };
}

// --- Blind-DEFENSE charts (~100bb): hero in the BB or SB facing a single open. ---
// Keyed by the OPENER's tier (you defend wider vs late opens, tighter vs early). Each
// entry is a curated { call, threeBet } pair; everything else folds. Approximate
// standard ranges — a reference, not a solve.
type OpenerTier = 'early' | 'mid' | 'late' | 'btn' | 'sb';

function openerTier(pos: SeatPosition): OpenerTier {
  if (pos === 'SB') return 'sb';
  if (pos === 'BTN') return 'btn'; // the widest non-blind opener — defend wider vs it
  if (pos === 'CO') return 'late';
  if (pos === 'HJ' || pos === 'LJ') return 'mid';
  return 'early'; // UTG, UTG1, MP
}

const BB_VS_OPEN: Record<OpenerTier, { call: string; threeBet: string }> = {
  early: {
    call: '22-TT, A8s-AJs, A5s-A2s, KTs+, QTs+, J9s+, T9s, 98s, 87s, 76s, 65s, KJo+, QJo, AJo',
    threeBet: 'JJ+, AQs+, AKo, A5s, A4s, KQs',
  },
  mid: {
    call: '22-JJ, A7s+, A5s-A2s, K9s+, Q9s+, J9s+, T8s+, 97s+, 87s, 76s, 65s, 54s, ATo+, KJo+, QJo, JTo',
    threeBet: 'TT+, AJs+, A5s-A2s, KQs, KJs, AQo+',
  },
  late: {
    call: '22-JJ, A2s+, K5s+, Q7s+, J8s+, T8s+, 96s+, 86s+, 75s+, 65s, 54s, A2o+, K8o+, Q9o+, J9o+, T9o, 98o',
    threeBet: 'TT+, AJs+, A5s-A2s, KJs+, QJs, JTs, AQo+, A5o',
  },
  btn: {
    call: '22-JJ, A2s+, K3s+, Q6s+, J7s+, T7s+, 96s+, 85s+, 75s+, 64s+, 54s, A2o+, K7o+, Q8o+, J8o+, T8o+, 98o, 87o',
    threeBet: 'TT+, A9s+, A5s-A2s, KTs+, QTs+, JTs, T9s, AJo+, KQo, A5o',
  },
  sb: {
    call: '22-QQ, A2s+, K2s+, Q4s+, J6s+, T6s+, 95s+, 85s+, 74s+, 64s+, 53s+, 43s, A2o+, K5o+, Q8o+, J8o+, T8o+, 97o+, 87o',
    threeBet: 'JJ+, A9s+, A5s-A2s, KTs+, QTs+, JTs, AJo+, KQo, A5o',
  },
};

const SB_VS_OPEN: Partial<Record<OpenerTier, { call: string; threeBet: string }>> = {
  early: {
    call: '22-99, ATs-AJs, KQs, QJs, JTs',
    threeBet: 'TT+, AQs+, AKo, A5s, A4s',
  },
  mid: {
    call: '22-TT, ATs+, KJs+, QJs, JTs, T9s',
    threeBet: 'TT+, AJs+, A5s-A4s, KQs, AQo+',
  },
  late: {
    call: '22-JJ, A9s+, KTs+, QTs+, JTs, T9s, 98s, AQo+',
    threeBet: 'TT+, AJs+, A5s-A2s, KJs+, QJs, AQo+, A5o',
  },
  btn: {
    call: '22-JJ, A8s+, KTs+, QTs+, J9s+, T9s, 98s, AJo+, KQo',
    threeBet: 'TT+, A9s+, A5s-A2s, KJs+, QJs, JTs, AJo+, A5o',
  },
};

// In-position (non-blind hero) facing a single earlier open. Tighter flatting than the
// BB, more 3-bet-or-fold, but wider vs late opens. By opener tier.
const IP_VS_OPEN: Partial<Record<OpenerTier, { call: string; threeBet: string }>> = {
  early: {
    call: '99-22, AJs-ATs, KQs, KJs, QJs, JTs, T9s',
    threeBet: 'TT+, AQs+, AKo, A5s, A4s',
  },
  mid: {
    call: '99-22, ATs+, KTs+, QTs+, JTs, T9s, 98s, AQo+',
    threeBet: 'JJ+, AJs+, A5s-A4s, KQs, AQo+',
  },
  late: {
    call: '88-22, A9s+, KTs+, QTs+, J9s+, T9s, 98s, 87s, AJo+, KQo',
    threeBet: 'TT+, AJs+, A5s-A3s, KJs+, QJs, AQo+, A5o',
  },
  btn: {
    call: '77-22, A8s+, K9s+, Q9s+, J9s+, T8s+, 98s, 87s, 76s, ATo+, KJo+',
    threeBet: 'TT+, ATs+, A5s-A2s, KJs+, QTs+, JTs, AJo+, KQo, A5o',
  },
};

/** Build a defense node (fold / call / 3-bet) from curated call + 3-bet ranges. */
function buildDefenseNode(
  callStr: string,
  threeBetStr: string,
  heroSeatIndex: number,
  openTo: number,
  heroBlind: number,
): NodeStrategyV2 {
  const callR = parseRange(callStr);
  const tbR = parseRange(threeBetStr);
  const actions: CanonicalAction[] = ['fold', 'call', 'raise-small'];
  const amountToCallBb = Math.max(0, openTo - heroBlind);
  const actionLabels = actions.map((a) => labelFor(a, 1, { amountToCallBb }));

  const hands: HandStrategyV2[] = [];
  let cSum = 0;
  let tSum = 0;
  for (let k = 0; k < 169; k++) {
    const tb = tbR[k] > 0 ? 1 : 0; // 3-bet takes precedence over flat
    let call = 0;
    if (!tb && callR[k] > 0) call = 1;
    const fold = 1 - tb - call;
    hands.push({
      handClass: k,
      freqs: { fold, call, 'raise-small': tb },
      labels: { fold: actionLabels[0], call: actionLabels[1], 'raise-small': actionLabels[2] },
    });
    cSum += call;
    tSum += tb;
  }
  return {
    nodeId: 0,
    label: 'Defense',
    heroSeatIndex,
    raiseDepth: 1,
    actions,
    actionLabels,
    hands,
    nodeActionFreq: { fold: 1 - (cSum + tSum) / 169, call: cSum / 169, 'raise-small': tSum / 169 },
    contrib: [openTo, heroBlind],
  };
}

function seatIndexOfPos(spot: SpotConfigV2, pos: SeatPosition): number {
  return seatLayout(spot.tableSize).find((s) => s.position === pos)?.seatIndex ?? 0;
}

/** RFI chart lookup (folds to hero, hero opens). */
function rfiChart(spot: SpotConfigV2): ChartResult | null {
  if (!isFoldToHero(spot)) return null;
  const rangeStr = rfiTable(spot.tableSize)?.[spot.heroPosition];
  if (!rangeStr) return null; // e.g. BB has no RFI
  return {
    heroNode: buildRfiNode(rangeStr, seatIndexOfPos(spot, spot.heroPosition)),
    caption: `Predefined chart (reference) — ${spot.heroPosition} RFI, ~100bb ${spot.tableSize}-handed cash. Curated standard chart, not live-solved.`,
    key: `cash|${spot.tableSize}|${spot.heroPosition}|100bb|rfi`,
  };
}

/** Pick the response table for the hero facing a single open. */
function responseTable(
  heroPosition: SeatPosition,
): Partial<Record<OpenerTier, { call: string; threeBet: string }>> {
  if (heroPosition === 'BB') return BB_VS_OPEN;
  if (heroPosition === 'SB') return SB_VS_OPEN;
  return IP_VS_OPEN; // any non-blind seat in position vs the opener
}

/** vs-open chart lookup: hero (blind or in position) facing exactly one open, no callers. */
function defenseChart(spot: SpotConfigV2): ChartResult | null {
  if (spot.betContext.raiseDepth !== 1) return null;
  const pa = spot.betContext.priorActions;
  const raises = pa.filter((a) => a.kind === 'raise');
  const others = pa.filter((a) => a.kind !== 'fold' && a.kind !== 'raise');
  if (raises.length !== 1 || others.length !== 0) return null; // exactly one opener, no callers/jams

  const opener = raises[0];
  const openerSeat = seatLayout(spot.tableSize).find((s) => s.seatIndex === opener.seatIndex);
  if (!openerSeat) return null;
  const tier = openerTier(openerSeat.position);
  const entry = responseTable(spot.heroPosition)[tier];
  if (!entry) return null; // e.g. SB/IP never faces an 'sb' opener

  const openTo = opener.toBb ?? 2.5;
  let heroBlind = 0;
  if (spot.heroPosition === 'BB') heroBlind = spot.stakes.bigBlindBb;
  else if (spot.heroPosition === 'SB') heroBlind = spot.stakes.smallBlindBb;
  const verb = spot.heroPosition === 'BB' || spot.heroPosition === 'SB' ? 'defending' : 'in position';
  return {
    heroNode: buildDefenseNode(entry.call, entry.threeBet, seatIndexOfPos(spot, spot.heroPosition), openTo, heroBlind),
    caption: `Predefined chart (reference) — ${spot.heroPosition} ${verb} vs a ${openerSeat.position} open, ~100bb ${spot.tableSize}-handed cash. Curated standard chart, not live-solved.`,
    key: `cash|${spot.tableSize}|${spot.heroPosition}|100bb|vs-open:${openerSeat.position}`,
  };
}

/**
 * Look up a predefined chart for the spot. Returns null on any miss (off-grid depth,
 * facing 3-bet+, custom range override, unsupported spot) → caller falls back to live.
 */
export function lookupChart(spot: SpotConfigV2): ChartResult | null {
  if (spot.gameMode !== 'cash') return null;
  if (!is100bbBucket(spot.effectiveStackBb)) return null;
  if (spot.betContext.priorActions.some((a) => a.range)) return null; // custom range -> live
  return rfiChart(spot) ?? defenseChart(spot);
}

/** Wrap a served chart as a full SolveResultV2 (source = 'predefined'). */
export function chartToResult(spot: SpotConfigV2, chart: ChartResult): SolveResultV2 {
  return {
    schemaVersion: 2,
    mode: 'preflop-spot',
    source: 'predefined',
    trust: {
      label: 'predefined',
      caption: chart.caption,
      zeroSumValid: false,
    },
    spot,
    settings: {},
    heroNode: chart.heroNode,
    subtree: [],
    iterations: 0,
    converged: true,
    seed: 0,
    generatedAt: new Date().toISOString(),
    engineVersion: 'predefined-chart-v1',
    solveTimeMs: 0,
  };
}
