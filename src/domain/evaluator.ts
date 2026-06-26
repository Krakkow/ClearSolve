// Domain Core — poker hand evaluator.
//
// Goal: correctness over cleverness. We evaluate the best 5-card poker hand out
// of N cards (5, 6, or 7) and return a single comparable integer "rank score"
// where a HIGHER score is a BETTER hand. Two hands can be compared directly by
// their scores; equal scores are exact ties.
//
// Encoding of the score (base-16 packed so primary > kickers, lexicographically):
//   score = (category << 20)
//         | (k0 << 16) | (k1 << 12) | (k2 << 8) | (k3 << 4) | k4
// where category is the hand category (0..8) and k0..k4 are the ordered tiebreak
// rank indices (0..12, A high) — at most 5 tiebreak nibbles, each rank < 13 fits
// in a nibble. This yields a total order identical to standard poker ranking.

import { rankOfId } from './cards';

export const HAND_CATEGORY = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  TRIPS: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  QUADS: 7,
  STRAIGHT_FLUSH: 8,
} as const;

function packScore(category: number, kickers: number[]): number {
  // kickers: most-significant first, length <= 5, each 0..12.
  let s = category;
  for (let i = 0; i < 5; i++) {
    s = s * 16 + (kickers[i] ?? 0);
  }
  return s;
}

/**
 * Evaluate exactly 5 cards (given as 0..51 ids) into a comparable score.
 * Higher is better.
 */
export function evaluate5(c0: number, c1: number, c2: number, c3: number, c4: number): number {
  const ids = [c0, c1, c2, c3, c4];

  // rankCounts[r] = how many of rank r (0..12). suitMask bits track flush.
  const rankCounts = new Int8Array(13);
  const suitCounts = new Int8Array(4);
  for (const id of ids) {
    rankCounts[rankOfId(id)]++;
    suitCounts[id % 4]++;
  }

  const isFlush = suitCounts[0] === 5 || suitCounts[1] === 5 || suitCounts[2] === 5 || suitCounts[3] === 5;

  // Straight detection (A can be high or low). Build a presence bitmask of ranks.
  let rankMask = 0;
  for (let r = 0; r < 13; r++) if (rankCounts[r] > 0) rankMask |= 1 << r;

  // High of a straight (top rank index) or -1 if none. Handle the wheel A-2-3-4-5.
  const straightHigh = straightHighFromMask(rankMask);

  if (isFlush && straightHigh >= 0) {
    return packScore(HAND_CATEGORY.STRAIGHT_FLUSH, [straightHigh]);
  }

  // Group ranks by count for pair/trips/quads logic.
  // Build arrays sorted by (count desc, rank desc).
  const byCount: { rank: number; count: number }[] = [];
  for (let r = 12; r >= 0; r--) {
    if (rankCounts[r] > 0) byCount.push({ rank: r, count: rankCounts[r] });
  }
  byCount.sort((a, b) => (b.count - a.count) || (b.rank - a.rank));

  const counts = byCount.map((x) => x.count);

  // Quads
  if (counts[0] === 4) {
    const quad = byCount[0].rank;
    const kicker = byCount.find((x) => x.count === 1)!.rank;
    return packScore(HAND_CATEGORY.QUADS, [quad, kicker]);
  }
  // Full house (trips + pair)
  if (counts[0] === 3 && counts[1] >= 2) {
    return packScore(HAND_CATEGORY.FULL_HOUSE, [byCount[0].rank, byCount[1].rank]);
  }
  if (isFlush) {
    // flush: five highest ranks present (exactly 5 cards so all of them)
    const ranks = byCount.map((x) => x.rank); // already count-then-rank sorted; all count 1
    ranks.sort((a, b) => b - a);
    return packScore(HAND_CATEGORY.FLUSH, ranks.slice(0, 5));
  }
  if (straightHigh >= 0) {
    return packScore(HAND_CATEGORY.STRAIGHT, [straightHigh]);
  }
  // Trips
  if (counts[0] === 3) {
    const trip = byCount[0].rank;
    const kickers = byCount.filter((x) => x.count === 1).map((x) => x.rank).sort((a, b) => b - a);
    return packScore(HAND_CATEGORY.TRIPS, [trip, kickers[0], kickers[1]]);
  }
  // Two pair
  if (counts[0] === 2 && counts[1] === 2) {
    const pairs = byCount.filter((x) => x.count === 2).map((x) => x.rank).sort((a, b) => b - a);
    const kicker = byCount.find((x) => x.count === 1)!.rank;
    return packScore(HAND_CATEGORY.TWO_PAIR, [pairs[0], pairs[1], kicker]);
  }
  // One pair
  if (counts[0] === 2) {
    const pair = byCount[0].rank;
    const kickers = byCount.filter((x) => x.count === 1).map((x) => x.rank).sort((a, b) => b - a);
    return packScore(HAND_CATEGORY.PAIR, [pair, kickers[0], kickers[1], kickers[2]]);
  }
  // High card
  const highs = byCount.map((x) => x.rank).sort((a, b) => b - a);
  return packScore(HAND_CATEGORY.HIGH_CARD, highs.slice(0, 5));
}

/**
 * Return the top rank index of the best straight present in `rankMask`,
 * or -1 if there is no straight. Handles the A-2-3-4-5 wheel (high = 5 -> index 3).
 */
function straightHighFromMask(rankMask: number): number {
  // Treat Ace (bit 12) as also a low card below '2' for the wheel.
  // Build a 14-wide window: positions 0..12 = ranks 2..A, position -1 conceptually = Ace-low.
  // Simpler: check windows of 5 consecutive ranks from high to low.
  // Ace-high straight: ranks A,K,Q,J,T -> bits 12,11,10,9,8.
  for (let high = 12; high >= 4; high--) {
    let ok = true;
    for (let k = 0; k < 5; k++) {
      if ((rankMask & (1 << (high - k))) === 0) {
        ok = false;
        break;
      }
    }
    if (ok) return high;
  }
  // Wheel: A-2-3-4-5 -> need ranks A(12),5(3),4(2),3(1),2(0). Straight high = 5 (index 3).
  const wheel = (1 << 12) | (1 << 3) | (1 << 2) | (1 << 1) | (1 << 0);
  if ((rankMask & wheel) === wheel) return 3;
  return -1;
}

/**
 * Evaluate the best 5-card hand from N cards (N = 5, 6, or 7), given as 0..51 ids.
 * Returns the maximum evaluate5 score over all 5-card subsets. Higher is better.
 */
export function evaluateBest(cards: number[]): number {
  const n = cards.length;
  if (n === 5) {
    return evaluate5(cards[0], cards[1], cards[2], cards[3], cards[4]);
  }
  let best = -1;
  // Enumerate all C(n,5) subsets via nested loops (n <= 7 -> at most 21 subsets).
  for (let a = 0; a < n - 4; a++) {
    for (let b = a + 1; b < n - 3; b++) {
      for (let c = b + 1; c < n - 2; c++) {
        for (let d = c + 1; d < n - 1; d++) {
          for (let e = d + 1; e < n; e++) {
            const s = evaluate5(cards[a], cards[b], cards[c], cards[d], cards[e]);
            if (s > best) best = s;
          }
        }
      }
    }
  }
  return best;
}
