// Domain Core — MULTIWAY field model.
//
// The preflop solver reduces a multiway pot to hero vs ONE composite opponent. That
// collapse overstates hero's situation two ways: (1) hero's equity (you only need to beat
// ONE composite hand, not the BEST of N separate opponents), and (2) squeeze fold-equity
// (one composite folds to 3-bets like a heads-up player). Both push toward "always
// continue", so multiway cold-call/defense ranges come out absurdly wide.
//
// Fix: skew the composite opponent's range toward STRONGER hands as the field grows — an
// approximation of "the strongest of N opponents", which is what hero must actually beat.
// A stronger opponent range simultaneously (1) lowers hero's showdown equity and (2) makes
// the opponent continue more vs a 3-bet — so the bottom of hero's range finally folds
// instead of light-squeezing. A heuristic for the 2-player estimate, applied at solve time
// (the equity matrix is needed for the per-class strength), so it works for both engines.

import { HAND_CLASSES } from './handClasses';

const N = 169;

/**
 * Per-class "strength" = the class's combo-weighted average all-in equity vs the full
 * field of 169 classes (i.e. equity vs a random hand). Row of `equity` is the hero/SB
 * side, so strength[i] = avg_j equity[i,j] weighted by class j's combo count. In [0,1].
 */
export function classStrength(equity: Float64Array): Float64Array {
  const s = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    let sum = 0;
    let w = 0;
    for (let j = 0; j < N; j++) {
      const c = HAND_CLASSES[j].comboCount;
      sum += equity[i * N + j] * c;
      w += c;
    }
    s[i] = w > 0 ? sum / w : 0;
  }
  return s;
}

/**
 * Skew a composite-opponent range toward stronger hands to approximate the "best of N"
 * the hero faces multiway. `fieldSize` = number of live opponents folded into the
 * composite; <=1 returns the input unchanged (heads-up: no skew). The skew multiplies each
 * class weight by strength^(fieldStrengthExponent * (fieldSize-1)); the solver renormalises
 * the prior, so only the RELATIVE reshaping matters. `exponent` is tunable (calibrated so
 * multiway defense folds the bottom of the range rather than continuing ~everything).
 */
export function skewByField(
  weights: Float64Array,
  strength: Float64Array,
  fieldSize: number,
  exponent = 1.0,
): Float64Array {
  if (fieldSize <= 1) return weights;
  const p = exponent * (fieldSize - 1);
  const out = new Float64Array(weights.length);
  for (let i = 0; i < weights.length; i++) {
    out[i] = weights[i] * Math.pow(Math.max(0, strength[i]), p);
  }
  return out;
}
