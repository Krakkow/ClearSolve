// Domain Core — card-removal-aware co-occurrence weights between the 169 classes.
//
// When we reason about range-vs-range payoffs at the 169-CLASS abstraction level,
// we must account for CARD REMOVAL: a hero holding class i removes specific cards
// from the deck, so the number of opponent combos of class j that can coexist with
// hero's hand depends on (i, j). For example, if hero holds AA, the opponent can
// hold fewer combos containing an Ace.
//
// pairWeight[i*169 + j] = number of ORDERED (heroCombo, villainCombo) pairings that
//   - are valid for hero class i and villain class j, and
//   - share no card.
// This is the natural class-level co-occurrence weight. Summed appropriately it
// reproduces standard combinatorics (e.g. for distinct non-blocking classes it is
// comboCount[i] * comboCount[j]; for overlapping classes it is reduced).
//
// We use these weights at terminal nodes so range-vs-range EVs are card-removal
// aware (per the slice spec), rather than using unconditional comboCount products.

import { combosForClassIndex } from './combos';

const N = 169;

/**
 * pairWeight[i*169+j] = count of non-conflicting (hero-combo, villain-combo)
 * orderings for hero class i, villain class j. Symmetric: pairWeight[i][j] === pairWeight[j][i].
 */
export const PAIR_WEIGHTS: Float64Array = buildPairWeights();

function buildPairWeights(): Float64Array {
  const m = new Float64Array(N * N);
  // Precompute each class's combos once.
  const combos: number[][][] = [];
  for (let i = 0; i < N; i++) combos.push(combosForClassIndex(i));

  for (let i = 0; i < N; i++) {
    const hi = combos[i];
    for (let j = i; j < N; j++) {
      const hj = combos[j];
      let count = 0;
      for (const a of hi) {
        for (const b of hj) {
          // non-conflicting iff the two combos share no card
          if (a[0] === b[0] || a[0] === b[1] || a[1] === b[0] || a[1] === b[1]) continue;
          count++;
        }
      }
      m[i * N + j] = count;
      m[j * N + i] = count;
    }
  }
  return m;
}

export function pairWeightAt(i: number, j: number): number {
  return PAIR_WEIGHTS[i * N + j];
}
