// Fast, allocation-free 7-card evaluator.
//
// Instead of enumerating the 21 five-card subsets (evaluator.ts `evaluateBest`),
// this computes the best 5-card hand DIRECTLY from the 7-card rank/suit histograms.
// It returns a score in the SAME packed encoding as evaluate5 (category<<20 | kickers),
// so scores are directly comparable across evaluate5 / evaluateBest / evaluate7.
//
// This is the hot path for Monte-Carlo equity (millions of calls). It uses only
// preallocated scratch buffers (module-level, single-threaded worker) and a couple
// of small loops — no per-call allocation, no sort.

import { rankOfId } from './cards';

const STRAIGHT_FLUSH = 8;
const QUADS = 7;
const FULL_HOUSE = 6;
const FLUSH = 5;
const STRAIGHT = 4;
const TRIPS = 3;
const TWO_PAIR = 2;
const PAIR = 1;
const HIGH_CARD = 0;

// Scratch buffers reused across calls (safe in the single-threaded worker).
const rankCount = new Int8Array(13);
const suitCount = new Int8Array(4);
// suitRankMask[s] = bitmask (bit r set) of ranks present in suit s.
const suitRankMask = new Int32Array(4);

function pack(category: number, k0: number, k1 = 0, k2 = 0, k3 = 0, k4 = 0): number {
  return ((((category * 16 + k0) * 16 + k1) * 16 + k2) * 16 + k3) * 16 + k4;
}

/**
 * Highest top-rank of a 5-straight present in `mask` (bit r = rank r present),
 * or -1. Handles the wheel (A-2-3-4-5 -> returns 3, i.e. rank '5').
 */
function straightHigh(mask: number): number {
  for (let high = 12; high >= 4; high--) {
    // need bits high, high-1, ..., high-4 all set
    const window = 0b11111 << (high - 4);
    if ((mask & window) === window) return high;
  }
  // wheel: A(12),5(3),4(2),3(1),2(0)
  const wheel = (1 << 12) | (1 << 3) | (1 << 2) | (1 << 1) | 1;
  if ((mask & wheel) === wheel) return 3;
  return -1;
}

/** Evaluate the best 5-card hand from exactly 7 card ids (0..51). Higher = better. */
export function evaluate7(
  a: number, b: number, c: number, d: number, e: number, f: number, g: number,
): number {
  rankCount.fill(0);
  suitCount.fill(0);
  suitRankMask[0] = suitRankMask[1] = suitRankMask[2] = suitRankMask[3] = 0;

  let rankMask = 0;
  for (const id of [a, b, c, d, e, f, g]) {
    const r = rankOfId(id);
    const s = id % 4;
    rankCount[r]++;
    suitCount[s]++;
    suitRankMask[s] |= 1 << r;
    rankMask |= 1 << r;
  }

  // --- Flush / straight-flush ---
  let flushSuit = -1;
  for (let s = 0; s < 4; s++) {
    if (suitCount[s] >= 5) {
      flushSuit = s;
      break;
    }
  }
  if (flushSuit >= 0) {
    const sfHigh = straightHigh(suitRankMask[flushSuit]);
    if (sfHigh >= 0) return pack(STRAIGHT_FLUSH, sfHigh);
  }

  // --- Count multiplicities (scan high->low so first found is highest) ---
  let quad = -1;
  let trip = -1; // highest trips
  let trip2 = -1; // second trips (for full house from two trips)
  let pair1 = -1; // highest pair
  let pair2 = -1; // second pair
  for (let r = 12; r >= 0; r--) {
    const cnt = rankCount[r];
    if (cnt === 4) {
      if (quad < 0) quad = r;
    } else if (cnt === 3) {
      if (trip < 0) trip = r;
      else if (trip2 < 0) trip2 = r;
    } else if (cnt === 2) {
      if (pair1 < 0) pair1 = r;
      else if (pair2 < 0) pair2 = r;
    }
  }

  // --- Quads ---
  if (quad >= 0) {
    // best kicker = highest rank != quad
    let kicker = -1;
    for (let r = 12; r >= 0; r--) {
      if (r !== quad && rankCount[r] > 0) {
        kicker = r;
        break;
      }
    }
    return pack(QUADS, quad, kicker);
  }

  // --- Full house (trips + pair, or two trips) ---
  if (trip >= 0) {
    let pairRank = -1;
    if (trip2 >= 0) pairRank = trip2; // second trips acts as the pair
    if (pair1 > pairRank) pairRank = pair1; // an actual pair, if higher
    if (pairRank >= 0) return pack(FULL_HOUSE, trip, pairRank);
  }

  // --- Flush (no straight flush) ---
  if (flushSuit >= 0) {
    // five highest ranks in the flush suit
    const m = suitRankMask[flushSuit];
    let k0 = -1, k1 = -1, k2 = -1, k3 = -1, k4 = -1;
    let need = 5;
    for (let r = 12; r >= 0 && need > 0; r--) {
      if (m & (1 << r)) {
        if (k0 < 0) k0 = r;
        else if (k1 < 0) k1 = r;
        else if (k2 < 0) k2 = r;
        else if (k3 < 0) k3 = r;
        else k4 = r;
        need--;
      }
    }
    return pack(FLUSH, k0, k1, k2, k3, k4);
  }

  // --- Straight ---
  const sHigh = straightHigh(rankMask);
  if (sHigh >= 0) return pack(STRAIGHT, sHigh);

  // --- Trips ---
  if (trip >= 0) {
    let k0 = -1, k1 = -1;
    for (let r = 12; r >= 0; r--) {
      if (r !== trip && rankCount[r] > 0) {
        if (k0 < 0) k0 = r;
        else if (k1 < 0) {
          k1 = r;
          break;
        }
      }
    }
    return pack(TRIPS, trip, k0, k1);
  }

  // --- Two pair ---
  if (pair1 >= 0 && pair2 >= 0) {
    let kicker = -1;
    for (let r = 12; r >= 0; r--) {
      if (r !== pair1 && r !== pair2 && rankCount[r] > 0) {
        kicker = r;
        break;
      }
    }
    return pack(TWO_PAIR, pair1, pair2, kicker);
  }

  // --- One pair ---
  if (pair1 >= 0) {
    let k0 = -1, k1 = -1, k2 = -1;
    for (let r = 12; r >= 0; r--) {
      if (r !== pair1 && rankCount[r] > 0) {
        if (k0 < 0) k0 = r;
        else if (k1 < 0) k1 = r;
        else if (k2 < 0) {
          k2 = r;
          break;
        }
      }
    }
    return pack(PAIR, pair1, k0, k1, k2);
  }

  // --- High card: five highest ranks ---
  let k0 = -1, k1 = -1, k2 = -1, k3 = -1, k4 = -1;
  let need = 5;
  for (let r = 12; r >= 0 && need > 0; r--) {
    if (rankCount[r] > 0) {
      if (k0 < 0) k0 = r;
      else if (k1 < 0) k1 = r;
      else if (k2 < 0) k2 = r;
      else if (k3 < 0) k3 = r;
      else k4 = r;
      need--;
    }
  }
  return pack(HIGH_CARD, k0, k1, k2, k3, k4);
}
