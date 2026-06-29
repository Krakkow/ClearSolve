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
import { rankIndex } from './cards';

const N = 169;

/**
 * Per-class POSTFLOP REALIZATION quality in [0,1] — how much of its raw (all-in) equity a
 * hand actually realizes when it just CALLS to see a flop, out of position, multiway. Made
 * hands realize ~fully (pairs: set-mining + showdown value); speculative hands realize less
 * the LOWER and more DISCONNECTED they are (weak suited like J2s/84s make dominated draws
 * you can't get paid on and get bluffed off OOP). The see-flop terminal otherwise credits
 * these their full equity, which is why multiway defense over-calls weak suited — this
 * gives them a realization HAIRCUT. Static (no equity needed); a heuristic.
 */
export function classPlayability(): Float64Array {
  const out = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const hc = HAND_CLASSES[i];
    if (hc.kind === 'pair') {
      out[i] = 1;
      continue;
    }
    const hi = rankIndex(hc.high); // 0..12 (2..A)
    const lo = rankIndex(hc.low);
    const gap = hi - lo;
    const highScore = (hi + lo) / 24; // 0 (32) .. ~0.96 (AK)
    const connScore = Math.max(0, 1 - (gap - 1) / 11); // gap1 -> 1, gap12 -> 0
    out[i] = Math.min(1, 0.55 * highScore + 0.45 * connScore);
  }
  return out;
}

/**
 * Return a copy of the equity matrix with the BB-side (hero, column j) speculative hands
 * given a see-flop realization HAIRCUT: each column j is shifted toward the SB by
 * k*(1 - playability[j]). Only meaningful for RESPONDER (hero = BB) solves, applied per
 * spot (so opens are untouched). Used together with the composite skew so multiway defense
 * folds weak suited too — not just weak offsuit. `equity[i*N+j]` is SB equity (row i = SB).
 */
export function penalizeHeroRealization(
  equity: Float64Array,
  playability: Float64Array,
  k: number,
): Float64Array {
  if (k <= 0) return equity;
  const out = Float64Array.from(equity);
  for (let j = 0; j < N; j++) {
    const pen = k * (1 - playability[j]);
    if (pen <= 0) continue;
    for (let i = 0; i < N; i++) {
      out[i * N + j] = Math.min(1, equity[i * N + j] + pen);
    }
  }
  return out;
}

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
