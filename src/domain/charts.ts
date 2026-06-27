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

// In-position (non-blind hero) facing a single earlier open — now keyed by the
// DEFENDER's own position (later = wider; the button defends widest) AND the opener
// tier. A defender only ever faces openers EARLIER than itself, so the opener buckets
// available per defender are limited (e.g. the CO can't face a BTN open).
type DefenderTier = 'btn' | 'co' | 'mid' | 'early';

function defenderTier(pos: SeatPosition): DefenderTier {
  if (pos === 'BTN') return 'btn';
  if (pos === 'CO') return 'co';
  if (pos === 'HJ' || pos === 'LJ') return 'mid';
  return 'early'; // MP, UTG1 (UTG is first and never a defender)
}

const IP_DEF: Record<DefenderTier, Partial<Record<OpenerTier, { call: string; threeBet: string }>>> = {
  btn: {
    early: {
      call: '88-22, A9s+, KTs+, QTs+, J9s+, T9s, 98s, AJo+, KQo',
      threeBet: 'TT+, AQs+, AKo, A5s, A4s, KQs',
    },
    mid: {
      call: '77-22, A8s+, K9s+, Q9s+, J9s+, T8s+, 98s, 87s, ATo+, KJo+, QJo',
      threeBet: 'TT+, A9s+, A5s-A2s, KTs+, QTs+, JTs, AJo+, KQo, A5o',
    },
    late: {
      call: '66-22, A5s+, K8s+, Q8s+, J8s+, T8s+, 97s+, 87s, 76s, 65s, A9o+, KTo+, QJo',
      threeBet: '99+, A8s+, A5s-A2s, K9s+, QTs+, J9s+, T9s, ATo+, KJo+, A5o',
    },
  },
  co: {
    early: {
      call: '99-22, AJs-ATs, KQs, KJs, QJs, JTs, T9s',
      threeBet: 'TT+, AQs+, AKo, A5s, A4s',
    },
    mid: {
      call: '88-22, A9s+, KJs+, QTs+, J9s+, T9s, 98s, AQo+',
      threeBet: 'TT+, AJs+, A5s-A4s, KQs, AQo+',
    },
  },
  mid: {
    early: {
      call: '99-22, ATs+, KJs+, QJs, JTs, T9s',
      threeBet: 'JJ+, AQs+, AKo, A5s',
    },
    mid: {
      call: '88-22, ATs+, KTs+, QTs+, JTs, T9s, 98s, AQo+',
      threeBet: 'JJ+, AJs+, A5s-A4s, KQs, AQo+',
    },
  },
  early: {
    early: {
      call: '99-22, AJs-ATs, KQs, QJs, JTs',
      threeBet: 'JJ+, AQs+, AKo, A5s',
    },
  },
};

/** IP entry for (defender, opener tier), falling back to the closest available bucket. */
function ipEntry(heroPosition: SeatPosition, tier: OpenerTier): { call: string; threeBet: string } | null {
  const byOpener = IP_DEF[defenderTier(heroPosition)];
  return byOpener[tier] ?? byOpener.mid ?? byOpener.early ?? null;
}

/**
 * Build a response node (fold / call / raise) from curated call + raise ranges at a
 * given betting depth. depth 1 -> the raise labels as a "3-bet"; depth 2 -> a "4-bet".
 */
function buildResponseNode(
  callStr: string,
  raiseStr: string,
  heroSeatIndex: number,
  raiseDepth: number,
  contrib: [number, number],
  amountToCallBb: number,
): NodeStrategyV2 {
  const callR = parseRange(callStr);
  const rR = parseRange(raiseStr);
  const actions: CanonicalAction[] = ['fold', 'call', 'raise-small'];
  const actionLabels = actions.map((a) => labelFor(a, raiseDepth, { amountToCallBb }));

  const hands: HandStrategyV2[] = [];
  let cSum = 0;
  let rSum = 0;
  for (let k = 0; k < 169; k++) {
    const raise = rR[k] > 0 ? 1 : 0; // raise takes precedence over flat
    let call = 0;
    if (!raise && callR[k] > 0) call = 1;
    const fold = 1 - raise - call;
    hands.push({
      handClass: k,
      freqs: { fold, call, 'raise-small': raise },
      labels: { fold: actionLabels[0], call: actionLabels[1], 'raise-small': actionLabels[2] },
    });
    cSum += call;
    rSum += raise;
  }
  return {
    nodeId: 0,
    label: 'Response',
    heroSeatIndex,
    raiseDepth,
    actions,
    actionLabels,
    hands,
    nodeActionFreq: { fold: 1 - (cSum + rSum) / 169, call: cSum / 169, 'raise-small': rSum / 169 },
    contrib,
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

/** The curated { call, 3-bet } entry for the hero facing an open at `tier`. */
function vsOpenEntry(heroPosition: SeatPosition, tier: OpenerTier): { call: string; threeBet: string } | null {
  if (heroPosition === 'BB') return BB_VS_OPEN[tier] ?? null;
  if (heroPosition === 'SB') return SB_VS_OPEN[tier] ?? null;
  return ipEntry(heroPosition, tier); // defender-position-aware (BTN > CO > HJ > MP)
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
  const entry = vsOpenEntry(spot.heroPosition, tier);
  if (!entry) return null; // e.g. SB/IP never faces an 'sb' opener

  const openTo = opener.toBb ?? 2.5;
  let heroBlind = 0;
  if (spot.heroPosition === 'BB') heroBlind = spot.stakes.bigBlindBb;
  else if (spot.heroPosition === 'SB') heroBlind = spot.stakes.smallBlindBb;
  const verb = spot.heroPosition === 'BB' || spot.heroPosition === 'SB' ? 'defending' : 'in position';
  const amountToCallBb = Math.max(0, openTo - heroBlind);
  return {
    heroNode: buildResponseNode(
      entry.call,
      entry.threeBet,
      seatIndexOfPos(spot, spot.heroPosition),
      1,
      [openTo, heroBlind],
      amountToCallBb,
    ),
    caption: `Predefined chart (reference) — ${spot.heroPosition} ${verb} vs a ${openerSeat.position} open, ~100bb ${spot.tableSize}-handed cash. Curated standard chart, not live-solved.`,
    key: `cash|${spot.tableSize}|${spot.heroPosition}|100bb|vs-open:${openerSeat.position}`,
  };
}

// --- vs-3-BET charts (~100bb): hero OPENED and now faces a single 3-bet. Response is
//     fold / call / 4-bet, keyed by the opener (hero) tier and whether the 3-bettor is
//     a blind (wider, more bluffs -> defend wider) or in position (tighter -> 4-bet/fold).
type HeroOpenTier = 'early' | 'mid' | 'late';

function heroOpenTier(pos: SeatPosition): HeroOpenTier {
  if (pos === 'CO' || pos === 'BTN') return 'late';
  if (pos === 'HJ' || pos === 'LJ') return 'mid';
  return 'early'; // UTG, UTG1, MP
}

const VS_3BET: Record<HeroOpenTier, Record<'blind' | 'ip', { call: string; fourBet: string }>> = {
  early: {
    blind: { call: 'JJ-99, AQs, AJs, KQs', fourBet: 'QQ+, AKs, AKo, A5s' },
    ip: { call: 'JJ, AQs', fourBet: 'QQ+, AKs, AKo' },
  },
  mid: {
    blind: { call: 'JJ-88, AQs, AJs, ATs, KQs, KJs, QJs', fourBet: 'QQ+, AKs, AKo, A5s, A4s' },
    ip: { call: 'JJ-99, AQs, AJs, KQs', fourBet: 'QQ+, AKs, AKo, A5s' },
  },
  late: {
    blind: { call: 'JJ-77, AQs-ATs, A5s, KQs, KJs, QJs, JTs, T9s', fourBet: 'QQ+, AKs, AKo, A5s, A4s' },
    ip: { call: 'JJ-88, AQs, AJs, KQs, KJs, QJs', fourBet: 'TT+, AQs+, AKo, A5s' },
  },
};

/** vs-3-bet chart: hero opened (first raise) and faces a single 3-bet (second raise). */
function vs3betChart(spot: SpotConfigV2): ChartResult | null {
  if (spot.betContext.raiseDepth !== 2) return null;
  const pa = spot.betContext.priorActions;
  const raises = pa.filter((a) => a.kind === 'raise');
  const others = pa.filter((a) => a.kind !== 'fold' && a.kind !== 'raise');
  if (raises.length !== 2 || others.length !== 0) return null;

  const heroSeat = seatIndexOfPos(spot, spot.heroPosition);
  if (raises[0].seatIndex !== heroSeat) return null; // hero must be the OPENER
  const tbSeat = seatLayout(spot.tableSize).find((s) => s.seatIndex === raises[1].seatIndex);
  if (!tbSeat) return null;

  const tier = heroOpenTier(spot.heroPosition);
  const tbType = tbSeat.position === 'SB' || tbSeat.position === 'BB' ? 'blind' : 'ip';
  const entry = VS_3BET[tier][tbType];

  const openTo = raises[0].toBb ?? 2.5;
  const threeBetTo = raises[1].toBb ?? 11;
  return {
    heroNode: buildResponseNode(entry.call, entry.fourBet, heroSeat, 2, [openTo, threeBetTo], Math.max(0, threeBetTo - openTo)),
    caption: `Predefined chart (reference) — ${spot.heroPosition} (opener) facing a 3-bet from ${tbSeat.position}, ~100bb ${spot.tableSize}-handed cash. Curated standard chart, not live-solved.`,
    key: `cash|${spot.tableSize}|${spot.heroPosition}|100bb|vs-3bet:${tbSeat.position}`,
  };
}

/**
 * Look up a predefined chart for the spot. Returns null on any miss (off-grid depth,
 * facing 4-bet+, custom range override, unsupported spot) → caller falls back to live.
 */
export function lookupChart(spot: SpotConfigV2): ChartResult | null {
  if (spot.gameMode !== 'cash') return null;
  if (!is100bbBucket(spot.effectiveStackBb)) return null;
  if (spot.betContext.priorActions.some((a) => a.range)) return null; // custom range -> live
  return rfiChart(spot) ?? defenseChart(spot) ?? vs3betChart(spot);
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
