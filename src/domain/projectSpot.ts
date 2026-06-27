// Domain Core — project a generalized SpotConfigV2 to the existing 2-player
// BetTreeConfig (DATA_MODEL 13.9, ADR-011). This is where the multiway TABLE
// configuration is reduced to a genuinely zero-sum 2-player game:
//
//   - RFI (raiseDepth 0): hero (aggressor) vs the collapsed remaining field as ONE
//     opponent (modeled like the BB defender). Dead blinds/antes from folded seats
//     are added to the starting pot.
//   - vs a raise (raiseDepth 1): hero vs the raiser only.
//   - vs 3-bet/4-bet (raiseDepth >= 2): hero vs the last aggressor.
//
// The existing `solvePreflopTree` (2-player CFR+) is reused UNCHANGED. The existing
// betTree's nodes line up with raiseDepth:
//   depth 0 -> "SB Open"        (aggressor acts first)
//   depth 1 -> "BB vs Open"     (responder)
//   depth 2 -> "SB vs 3-bet"
//   depth 3 -> "BB vs 4-bet"
//   depth 4 -> "SB vs 5-bet jam"
// So hero's decision node is selected from the solved tree by raiseDepth.
//
// Pot construction: the 2-player tree posts smallBlind for the aggressor-side and
// bigBlind for the field-side. We fold the table's EXTRA dead money (antes from all
// live seats, plus the un-modeled blind when hero is neither blind) into the field's
// posted amount so the starting pot reflects the real multiway dead money. This is
// the standard "open vs the field" pot used by preflop chart trainers (a documented,
// labeled approximation for tableSize > 2).

import { seatLayout, seatIndexOf } from './seatLayout';
import { defaultRange, type RangeActionType } from './defaultRanges';
import { combineComposite } from './range169';
import type { BetTreeConfig } from './betTree';
import type { PriorAction, SpotConfigV2 } from './spotV2';

export interface Projection {
  config: BetTreeConfig;
  /** raiseDepth of hero's decision node (selects which tree node hero acts at). */
  heroRaiseDepth: number;
  /** which tree-side hero is on: 'aggressor' (SB-side, even depth) or 'responder' (BB-side, odd depth). */
  heroSide: 'aggressor' | 'responder';
  heroSeatIndex: number;
  /** the node label hero acts at, e.g. "SB Open", "BB vs Open", "SB vs 3-bet". */
  heroNodeLabel: string;
  /** extra dead money (antes + un-modeled blind + extra callers' chips) in the pot. */
  deadMoneyBb: number;
  /**
   * Entering-range weights for the COMPOSITE opponent (the live, non-folded opponents
   * collapsed to one), to be passed to solvePreflopTree as the opponent side's reach.
   * Undefined => full-range opponent (pure RFI / open with no one yet in the pot).
   */
  oppRangeWeights?: Float64Array;
  /** which tree side the composite opponent occupies: 0 = SB-side, 1 = BB-side. */
  oppSide: 0 | 1;
  /**
   * Number of live opponents hero actually contends with at this node (in-pot
   * opponents + players still to act behind hero). 1 => a genuinely heads-up-resolved
   * spot (trustworthy live solve vs an assumed range); >=2 => a multiway estimate.
   */
  liveOppCount: number;
  /** whether the opponent range is an ASSUMED default range (vs a full-range field). */
  assumedRanges: boolean;
  /**
   * Positional equity-realization edge to use for see-flop terminals. For an OPEN it
   * decreases with the number of players still to act behind hero (multiway pressure),
   * which tightens early-position opens; undefined => engine default.
   */
  realizationEdge?: number;
}

/**
 * Realization edge for an OPEN, as a function of how many players are still to act
 * behind the opener. behind=1 (a heads-up button) keeps the calibrated HU edge; each
 * extra player sharply lowers it (the opener faces more resistance and plays OOP
 * postflop multiway), so early-position opens tighten toward realistic widths. This is
 * a heuristic for the LIVE estimate — reference-grade opens come from precomputed charts.
 */
export function openRealizationEdge(behind: number): number {
  const table: Record<number, number> = {
    1: 0.085, // HU button
    2: -0.005, // BTN (6-max)
    3: -0.05, // CO
    4: -0.08, // HJ/LJ
    5: -0.105, // UTG (6-max)
    6: -0.12,
    7: -0.13,
    8: -0.14, // UTG (9-max)
  };
  return table[behind] ?? -0.15;
}

const NODE_LABEL_BY_DEPTH: Record<number, string> = {
  0: 'SB Open',
  1: 'BB vs Open',
  2: 'SB vs 3-bet',
  3: 'BB vs 4-bet',
  4: 'SB vs 5-bet jam',
};

/**
 * Total dead money (in bb) contributed by ANTES across all live seats, plus a
 * big-blind ante if configured. This is added to the pot regardless of the modeled
 * two players.
 */
function anteDeadMoney(spot: SpotConfigV2): number {
  const { stakes, tableSize } = spot;
  let dead = 0;
  if (stakes.anteBb && stakes.anteBb > 0) dead += stakes.anteBb * tableSize;
  if (stakes.bbAnteBb && stakes.bbAnteBb > 0) dead += stakes.bbAnteBb;
  return dead;
}

/**
 * Classify a prior action into the default-range chart key, tracking how many raises
 * have already occurred (so the 1st raise = an open, 2nd = a 3-bet, 3rd = a 4-bet),
 * and whether a prior all-in means a call is a call-of-a-jam.
 */
function rangeActionFor(action: PriorAction, raiseOrdinal: number, jamFaced: boolean): RangeActionType {
  switch (action.kind) {
    case 'limp':
      return 'limp';
    case 'call':
      return jamFaced ? 'callJam' : 'call';
    case 'allin':
      return 'jam';
    case 'raise':
      if (raiseOrdinal === 0) return 'open';
      if (raiseOrdinal === 1) return '3bet';
      return '4bet';
    default:
      return 'call';
  }
}

/**
 * Build the COMPOSITE opponent entering range from the authored prior actions, plus
 * the extra dead money from non-modeled callers and the count of live opponents.
 *
 * The 2-player reduction models hero against ONE opponent: the last aggressor (whose
 * bet hero faces). Every other live (non-folded) opponent's range is folded into the
 * composite (via combineComposite), and their committed chips become dead money. If no
 * one is yet in the pot (pure RFI/open), the opponent is the full-range field.
 */
function buildComposite(spot: SpotConfigV2, heroSeatIndex: number): {
  weights?: Float64Array;
  extraDead: number;
  inPotOpps: number;
  assumed: boolean;
} {
  const { tableSize, betContext, effectiveStackBb, stakes, betSizing } = spot;
  const seats = seatLayout(tableSize);
  const ranges: Float64Array[] = [];
  const committed: number[] = [];
  let raiseOrdinal = 0; // counts ALL raises (incl. hero's own open) for bet-leveling
  let jamFaced = false;
  let currentBet = stakes.bigBlindBb; // outstanding amount-to-match in the pot

  for (const action of betContext.priorActions) {
    if (action.kind === 'fold') continue;
    // Hero's OWN prior action (e.g. its open, when it now faces a 3-bet) is not an
    // opponent — skip it from the composite, but still count its raise for leveling
    // so a subsequent re-raiser gets the correct (3-bet/4-bet) range.
    const isHero = action.seatIndex === heroSeatIndex;
    if (action.kind === 'raise' || action.kind === 'allin') {
      const level = raiseOrdinal;
      const to = action.toBb ?? currentBet;
      currentBet = Math.max(currentBet, to);
      if (action.kind === 'allin') jamFaced = true;
      raiseOrdinal++;
      if (isHero) continue;
      const seat = seats.find((s) => s.seatIndex === action.seatIndex);
      if (!seat) continue;
      const rat = rangeActionFor(action, level, jamFaced && action.kind !== 'allin');
      ranges.push(action.range ? Float64Array.from(action.range) : defaultRange(seat.position, rat, effectiveStackBb));
      committed.push(to);
      continue;
    }
    // call / limp (non-hero)
    if (isHero) continue;
    const seat = seats.find((s) => s.seatIndex === action.seatIndex);
    if (!seat) continue;
    const rat = rangeActionFor(action, raiseOrdinal, jamFaced);
    ranges.push(action.range ? Float64Array.from(action.range) : defaultRange(seat.position, rat, effectiveStackBb));
    committed.push(action.kind === 'limp' ? stakes.bigBlindBb : currentBet);
  }

  if (ranges.length === 0) {
    return { weights: undefined, extraDead: 0, inPotOpps: 0, assumed: false };
  }
  // The single modeled opponent = the biggest contributor (the aggressor hero faces).
  // The rest become dead money. fall back to defaults when betSizing is absent.
  void betSizing;
  const maxCommit = Math.max(...committed);
  let extraDead = 0;
  let droppedOne = false;
  for (const c of committed) {
    if (!droppedOne && c === maxCommit) {
      droppedOne = true; // this is the modeled opponent; its chips are live, not dead
      continue;
    }
    extraDead += c;
  }
  return {
    weights: combineComposite(ranges),
    extraDead,
    inPotOpps: ranges.length,
    assumed: true,
  };
}

/** Chips a position posts as a forced blind (SB=smallBlind, BB=bigBlind, else 0). */
function postedBlindOf(spot: SpotConfigV2, position: string): number {
  if (position === 'SB') return spot.stakes.smallBlindBb;
  if (position === 'BB') return spot.stakes.bigBlindBb;
  return 0;
}

/** The posted blind of the aggressor hero faces (the last raiser), 0 if non-blind. */
function aggressorPostedBlind(spot: SpotConfigV2): number {
  const seats = seatLayout(spot.tableSize);
  const raises = spot.betContext.priorActions.filter((a) => a.kind === 'raise' || a.kind === 'allin');
  const last = raises[raises.length - 1];
  if (!last) return 0;
  const seat = seats.find((s) => s.seatIndex === last.seatIndex);
  return seat ? postedBlindOf(spot, seat.position) : 0;
}

/** The outstanding bet (bb) the hero faces = the largest prior raise/all-in toBb. */
function raiseFacedBb(spot: SpotConfigV2): number {
  let r = 0;
  for (const a of spot.betContext.priorActions) {
    if ((a.kind === 'raise' || a.kind === 'allin') && typeof a.toBb === 'number') {
      r = Math.max(r, a.toBb);
    }
  }
  return r;
}

/**
 * The DEFAULT entering range (169 weights) the solver would assume for the action at
 * `seatIndex`, given the scenario context (raise ordinal / facing a jam). Used to seed
 * the range editor. Returns null if the seat has no live action (fold / not authored).
 */
export function defaultRangeForSeat(spot: SpotConfigV2, seatIndex: number): Float64Array | null {
  const seats = seatLayout(spot.tableSize);
  let raiseOrdinal = 0;
  let jamFaced = false;
  for (const action of spot.betContext.priorActions) {
    if (action.seatIndex === seatIndex) {
      if (action.kind === 'fold') return null;
      const seat = seats.find((s) => s.seatIndex === seatIndex);
      if (!seat) return null;
      const rat = rangeActionFor(action, raiseOrdinal, jamFaced);
      return defaultRange(seat.position, rat, spot.effectiveStackBb);
    }
    if (action.kind === 'raise' || action.kind === 'allin') {
      raiseOrdinal++;
      if (action.kind === 'allin') jamFaced = true;
    }
  }
  return null;
}

/** Bet sizes actually used in the scenario (raise/all-in toBb), falling back to defaults. */
function scenarioSizes(spot: SpotConfigV2): { openTo: number; threeBetTo: number; fourBetTo: number } {
  const raises = spot.betContext.priorActions
    .filter((a) => a.kind === 'raise' || a.kind === 'allin')
    .map((a) => a.toBb)
    .filter((x): x is number => typeof x === 'number' && x > 0);
  return {
    openTo: raises[0] ?? spot.betSizing.openTo,
    threeBetTo: raises[1] ?? spot.betSizing.threeBetTo,
    fourBetTo: raises[2] ?? spot.betSizing.fourBetTo,
  };
}

/**
 * Project the generalized spot to a 2-player BetTreeConfig + hero-node selection.
 *
 * E1 supports gameMode 'cash' only; tournament is rejected (ICM is E3).
 */
export function projectToBetTreeConfig(spot: SpotConfigV2): Projection {
  if (spot.gameMode !== 'cash') {
    throw new Error('projectToBetTreeConfig: only cash is supported in E1 (tournament/ICM is E3)');
  }

  const { stakes, tableSize, heroPosition, betContext, effectiveStackBb } = spot;
  const heroSeatIndex = seatIndexOf(tableSize, heroPosition);
  const depth = betContext.raiseDepth;

  // Even depth = hero is the aggressor side (acts/raises first at its layer);
  // odd depth = hero is the responder facing the last raise.
  const heroSide: 'aggressor' | 'responder' = depth % 2 === 0 ? 'aggressor' : 'responder';
  // Hero occupies the SB-side (player 0) on even depth, BB-side (player 1) on odd.
  // The composite OPPONENT is therefore on the other side.
  const oppSide: 0 | 1 = heroSide === 'aggressor' ? 1 : 0;

  const composite = buildComposite(spot, heroSeatIndex);

  // Dead money: antes (whole table) + the un-modeled small blind when hero is not a
  // blind + extra callers' chips folded into the pot (multiway). Used for the
  // open-vs-field model (hero aggressor) and for display.
  const heroIsBlind = heroPosition === 'SB' || heroPosition === 'BB';
  let deadMoney = anteDeadMoney(spot);
  if (tableSize > 2 && !heroIsBlind) deadMoney += stakes.smallBlindBb;
  deadMoney += composite.extraDead;

  const sizes = scenarioSizes(spot);
  const heroPosted = postedBlindOf(spot, heroPosition);

  // Build the 2-player config. Two cases:
  //  - HERO AGGRESSOR (open / vs-3bet): the open-vs-field model — hero posts the small
  //    blind, the collapsed defender posts the big blind PLUS the dead money it competes
  //    for. (Unchanged; accurate for opens and HU.)
  //  - HERO RESPONDER (facing a raise): each modeled player posts its ACTUAL blind, so a
  //    non-blind COLD-CALLER posts 0 and must call the full raise (not raise-minus-1bb).
  //    This fixes the cold-call pot geometry that otherwise overstates calling. The
  //    folded blinds / extra-caller chips are NOT injected into the 2-player pot (the
  //    tree has no dead-pot slot; that needs a solver change), so multiway cold-calls
  //    are slightly conservative — and are already labeled an ESTIMATE.
  let config: BetTreeConfig;
  if (heroSide === 'responder') {
    // Reproduce the CORRECT call/fold pot odds in the zero-sum tree (which has no
    // dead-pot slot) by choosing hero's modeled posted chips `bTree` so the tree's
    // break-even equity equals the true one including dead money:
    //   true break-even   eq* = (R - hb) / (2R + D)
    //   tree break-even   eq* = (R - bTree) / (2R)
    // Equating gives  bTree = R*(D + 2*hb) / (2R + D).
    // This reduces to hero's real blind for HU/blind-defense (D shrinks to 0) and to a
    // small dead-money-adjusted post for a non-blind cold-caller (hb = 0).
    const aggPosted = aggressorPostedBlind(spot);
    const R = raiseFacedBb(spot) || sizes.openTo;
    const otherBlinds = Math.max(0, stakes.smallBlindBb + stakes.bigBlindBb - heroPosted - aggPosted);
    const D = otherBlinds + anteDeadMoney(spot) + composite.extraDead;
    const bTree = (R * (D + 2 * heroPosted)) / (2 * R + D);
    config = {
      smallBlind: aggPosted, // the opener's blind (affects only its own fold cost)
      bigBlind: bTree, // hero's modeled post — matches true pot odds incl. dead money
      stack: effectiveStackBb,
      openTo: sizes.openTo,
      threeBetTo: sizes.threeBetTo,
      fourBetTo: sizes.fourBetTo,
    };
  } else {
    config = {
      smallBlind: stakes.smallBlindBb,
      bigBlind: stakes.bigBlindBb + deadMoney,
      stack: effectiveStackBb,
      openTo: sizes.openTo,
      threeBetTo: sizes.threeBetTo,
      fourBetTo: sizes.fourBetTo,
    };
  }

  // Live opponents = in-pot opponents + seats still to act behind hero. (Seats before
  // hero in action order are all authored; the rest, minus hero, act after.)
  const seatsBehind = Math.max(0, tableSize - 1 - betContext.priorActions.length);
  const liveOppCount = composite.inPotOpps + seatsBehind;

  // For an OPEN (hero is first-in aggressor), tighten with players behind via the
  // realization edge. Facing-action spots keep the engine default.
  const realizationEdge =
    heroSide === 'aggressor' && depth === 0 ? openRealizationEdge(seatsBehind) : undefined;

  return {
    config,
    heroRaiseDepth: depth,
    heroSide,
    heroSeatIndex,
    heroNodeLabel: NODE_LABEL_BY_DEPTH[depth] ?? NODE_LABEL_BY_DEPTH[4],
    deadMoneyBb: deadMoney,
    oppRangeWeights: composite.weights,
    oppSide,
    liveOppCount,
    assumedRanges: composite.assumed,
    realizationEdge,
  };
}

/** Default E1 bet-sizing scheme (mirrors the HU bet-tree defaults). */
export function defaultBetSizing(): SpotConfigV2['betSizing'] {
  return {
    id: 'e1-default',
    label: 'Small / Big / All-in (2.5 / 11 / 24)',
    openTo: 2.5,
    threeBetTo: 11,
    fourBetTo: 24,
  };
}

/**
 * upgradeHuSpot — adapter making the v1 HU slice (bet-tree at a given stack depth,
 * SB-vs-BB) into the equivalent generalized tableSize:2 SpotConfigV2 (DATA_MODEL
 * 13.9). The HU bet-tree slice IS the tableSize:2 RFI projection: hero = SB(button),
 * unopened, standard 0.5/1.0 blinds, the default sizing scheme. This keeps the prior
 * HU behavior reachable through the single generalized path (no separate code path).
 */
export function upgradeHuSpot(v1: {
  effectiveStackBb: number;
  smallBlindBb?: number;
  bigBlindBb?: number;
  sizes?: { openTo: number; threeBetTo: number; fourBetTo: number };
}): SpotConfigV2 {
  const sizes = v1.sizes ?? {
    openTo: defaultBetSizing().openTo,
    threeBetTo: defaultBetSizing().threeBetTo,
    fourBetTo: defaultBetSizing().fourBetTo,
  };
  return {
    schemaVersion: 2,
    gameType: 'NLHE',
    gameMode: 'cash',
    tableSize: 2,
    heroPosition: 'SB', // the button, acts first preflop (HU)
    stakes: {
      smallBlindBb: v1.smallBlindBb ?? 0.5,
      bigBlindBb: v1.bigBlindBb ?? 1.0,
    },
    effectiveStackBb: v1.effectiveStackBb,
    betContext: { priorActions: [], raiseDepth: 0 }, // RFI
    betSizing: {
      id: 'e1-default',
      label: 'Small / Big / All-in',
      openTo: sizes.openTo,
      threeBetTo: sizes.threeBetTo,
      fourBetTo: sizes.fourBetTo,
    },
  };
}
