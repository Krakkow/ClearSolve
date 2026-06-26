// Domain Core — DEFAULT RANGE LIBRARY for the scenario builder.
//
// PROVENANCE / APPROXIMATION NOTE (read this):
// These are compact, well-known APPROXIMATE preflop charts (cash, ~100bb 6-max style),
// hand-authored as the STARTING ASSUMPTION for each seat's assigned action. They are
// NOT ground-truth GTO output — they are the "entering ranges" the scenario solve is
// conditioned on, and every result is explicitly labeled "relative to assumed ranges".
// The user can override any seat's range later (RangeOverride in SpotConfigV2).
//
// Keyed by (positionGroup, actionType, stackBucket). positionGroup buckets the 9
// canonical positions into early/middle/late/blinds tiers so we don't need a chart for
// all 9*N combos. stackBucket is coarse: 'short' (<=15bb), 'mid' (16..40), 'deep' (>40).
//
// Ranges widen as position gets later; 3-bet/jam ranges are tighter/polarized.

import { parseRange, fullRange } from './range169';
import type { SeatPosition } from './spotV2';

export type RangeActionType = 'open' | 'call' | 'limp' | '3bet' | '4bet' | 'jam' | 'callJam';
export type StackBucket = 'short' | 'mid' | 'deep';

/** Coarse position tiers for chart selection. */
type PosTier = 'early' | 'middle' | 'late' | 'sb' | 'bb';

function posTier(p: SeatPosition): PosTier {
  switch (p) {
    case 'UTG':
    case 'UTG1':
    case 'MP':
      return 'early';
    case 'LJ':
    case 'HJ':
      return 'middle';
    case 'CO':
    case 'BTN':
      return 'late';
    case 'SB':
      return 'sb';
    case 'BB':
      return 'bb';
  }
}

export function stackBucketOf(stackBb: number): StackBucket {
  if (stackBb <= 15) return 'short';
  if (stackBb <= 40) return 'mid';
  return 'deep';
}

// --- OPEN (RFI) ranges by tier (deep ~100bb). Approximate standard charts. ---
const OPEN_DEEP: Record<PosTier, string> = {
  early: '22+, ATs+, KTs+, QTs+, JTs, T9s, 98s, AJo+, KQo',
  middle: '22+, A8s+, K9s+, Q9s+, J9s+, T9s, 98s, 87s, ATo+, KJo+, QJo',
  late: '22+, A2s+, K7s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, A7o+, A5o, KTo+, QTo+, JTo, T9o',
  sb: '22+, A2s+, K6s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 76s, 65s, A8o+, A5o, KTo+, QTo+, JTo',
  bb: '22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 96s+, 86s+, 75s+, 65s, 54s, A2o+, K8o+, Q9o+, J9o+, T9o',
};

// short-stack (<=15bb) opens are wider/jam-heavy; mid in between.
const OPEN_SHORT: Record<PosTier, string> = {
  early: '22+, A7s+, KTs+, QTs+, JTs, AJo+, KQo',
  middle: '22+, A5s+, K9s+, QTs+, JTs, T9s, ATo+, KJo+',
  late: '22+, A2s+, K7s+, Q9s+, J9s+, T9s, 98s, A7o+, KTo+, QJo',
  sb: '22+, A2s+, K8s+, Q9s+, J9s+, T9s, A7o+, KTo+, QJo',
  bb: '22+, A2s+, K5s+, Q8s+, J8s+, T8s+, A5o+, K9o+, QTo+',
};

// --- CALL / FLAT ranges (vs a single open). ---
const CALL_DEEP: Record<PosTier, string> = {
  early: '22-JJ, AQs, AJs, KQs, AKo',
  middle: '22-JJ, ATs+, KJs+, QJs, JTs, T9s, AQo+',
  late: '22-QQ, A9s+, KTs+, QTs+, JTs, T9s, 98s, AJo+, KQo',
  sb: '22-JJ, ATs+, KTs+, QTs+, JTs, AJo+, KQo',
  bb: '22-JJ, A2s+, K7s+, Q8s+, J8s+, T8s+, 97s+, 87s, 76s, 65s, A8o+, KTo+, QTo+, JTo',
};

// --- 3-BET ranges (polarized: premiums + suited bluffs). ---
const THREEBET_DEEP: Record<PosTier, string> = {
  early: 'QQ+, AKs, AKo, A5s',
  middle: 'JJ+, AQs+, AKo, A5s, A4s, KQs',
  late: 'TT+, AQs+, AKo, A5s-A2s, KQs, KJs, QJs',
  sb: 'TT+, AJs+, AQo+, A5s-A2s, KJs+, QJs',
  bb: 'TT+, AJs+, AQo+, A5s-A3s, KJs+, QTs, JTs',
};

// --- 4-BET ranges (very tight + a few bluffs). ---
const FOURBET = 'QQ+, AKs, AKo, A5s';

// --- JAM (short-stack all-in) ranges by tier. Wide late/blinds. ---
const JAM_SHORT: Record<PosTier, string> = {
  early: '55+, A9s+, KTs+, QJs, AJo+, KQo',
  middle: '44+, A7s+, KTs+, QTs+, JTs, ATo+, KQo',
  late: '22+, A2s+, K8s+, Q9s+, J9s+, T9s, A7o+, KTo+, QJo',
  sb: '22+, A2s+, K7s+, Q8s+, J8s+, T8s+, 98s, A5o+, K9o+, QTo+',
  bb: '22+, A2s+, K8s+, Q9s+, J9s+, T9s, A8o+, KTo+, QJo',
};

// --- CALL-A-JAM ranges (tighter than jamming). ---
const CALL_JAM: Record<PosTier, string> = {
  early: '77+, AJs+, AQo+, KQs',
  middle: '66+, ATs+, AJo+, KQs',
  late: '55+, A9s+, ATo+, KJs+, QJs',
  sb: '44+, A8s+, ATo+, KTs+, QJs',
  bb: '22+, A2s+, K9s+, Q9s+, JTs, A9o+, KTo+, QJo',
};

/**
 * Default entering range (169 weight vector) for an actor at `position` taking
 * `action` at `stackBb`. Falls back to full range only if nothing matches (never for
 * the supported action types).
 */
export function defaultRange(
  position: SeatPosition,
  action: RangeActionType,
  stackBb: number,
): Float64Array {
  const tier = posTier(position);
  const bucket = stackBucketOf(stackBb);

  switch (action) {
    case 'open':
    case 'limp':
      // limps reuse a wide-but-passive proxy = the open range (v1 approximation).
      return parseRange(bucket === 'short' ? OPEN_SHORT[tier] : OPEN_DEEP[tier]);
    case 'call':
      return parseRange(CALL_DEEP[tier]);
    case '3bet':
      return parseRange(THREEBET_DEEP[tier]);
    case '4bet':
      return parseRange(FOURBET);
    case 'jam':
      return parseRange(JAM_SHORT[tier]);
    case 'callJam':
      return parseRange(CALL_JAM[tier]);
    default:
      return fullRange();
  }
}

/** Human description of which default chart was selected (for UI provenance). */
export function defaultRangeLabel(
  position: SeatPosition,
  action: RangeActionType,
  stackBb: number,
): string {
  return `default ${action} range · ${position} · ${stackBucketOf(stackBb)} stack (approx chart)`;
}
