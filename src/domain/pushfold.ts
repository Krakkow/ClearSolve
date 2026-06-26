// Domain Core — Heads-Up preflop PUSH/FOLD (jam-or-fold) equilibrium solver.
//
// Game (HU, SB = button posts the small blind, BB posts the big blind):
//   - Blinds: SB posts 0.5, BB posts 1.0. Effective stack = S big blinds (each).
//   - SB acts first with exactly two options: JAM (all-in for S) or FOLD.
//   - If SB folds: SB loses its 0.5 posted blind. (SB delta = -0.5)
//   - If SB jams and BB folds: SB wins BB's 1.0 posted blind. (SB delta = +1.0)
//   - If SB jams and BB calls: all-in showdown for the effective stack S.
//       SB delta = eq * (2S) - S = S * (2*eq - 1), where eq = SB equity vs BB hand.
//   This is the standard chip-EV push/fold model (zero-sum: BB delta = -SB delta).
//
// We solve for the Nash equilibrium with FICTITIOUS PLAY / iterated best response
// over the 169x169 class-vs-class equity matrix:
//   - Given the BB calling range, SB jams a hand iff EV(jam) >= EV(fold) = -0.5.
//   - Given the SB jamming range, BB calls a hand iff EV(call) >= EV(fold).
// We damp the updates (averaging strategies over iterations) so the process
// converges smoothly to the equilibrium, then report best-response exploitability.
//
// Hand-class weighting: each of the 169 classes occurs with frequency proportional
// to its combo count (pair=6, suited=4, offsuit=12) out of 1326 total combos. We
// use these weights when a player reasons about the opponent's *range* of hands.

import { HAND_CLASSES } from './handClasses';

export interface PushFoldEquityMatrix {
  /** equity[i][j] = SB-equity of class i all-in vs class j (i as hero). 0..1. */
  equity: Float64Array; // 169*169 flattened (row i = hero class i)
  samples: number;
}

export interface PushFoldStrategies {
  /** sbJam[i] = frequency SB jams class i (0..1). */
  sbJam: Float64Array; // length 169
  /** bbCall[i] = frequency BB calls class i facing a jam (0..1). */
  bbCall: Float64Array; // length 169
}

export interface PushFoldSolveResult extends PushFoldStrategies {
  iterations: number;
  /** Best-response exploitability estimate, in big blinds per game (bb/g). */
  exploitabilityBbPerGame: number;
  /** Same value scaled to mbb/100 hands (for reporting parity with the data model). */
  exploitabilityMbbPer100: number;
  /** Combo-weighted SB jam fraction (0..1) and BB call fraction (0..1). */
  sbJamFraction: number;
  bbCallFraction: number;
}

const N = 169;

/** Combo-count weight per class (pair=6, suited=4, offsuit=12); sums to 1326. */
export const CLASS_WEIGHTS: Float64Array = (() => {
  const w = new Float64Array(N);
  for (let i = 0; i < N; i++) w[i] = HAND_CLASSES[i].comboCount;
  return w;
})();

const TOTAL_COMBOS = 1326;

function eqAt(m: Float64Array, hero: number, villain: number): number {
  return m[hero * N + villain];
}

/**
 * SB's EV of JAMMING class `i` given the BB calling strategy `bbCall`.
 * BB calls hand j with prob bbCall[j]; otherwise folds.
 *
 * Card removal note: when SB holds class i, the BB's hand distribution is very
 * slightly skewed by card removal. For this first slice we use the unconditional
 * combo weights (a standard, well-accepted simplification for HU push/fold charts);
 * the effect on jam/call thresholds is negligible. Documented as an approximation.
 */
function sbJamEV(
  i: number,
  S: number,
  bbCall: Float64Array,
  equity: Float64Array,
): number {
  // Partition BB's range into "calls" vs "folds" by weight.
  let callWeight = 0;
  let evCallTimesWeight = 0;
  for (let j = 0; j < N; j++) {
    const w = CLASS_WEIGHTS[j] * bbCall[j];
    if (w === 0) continue;
    callWeight += w;
    const eq = eqAt(equity, i, j);
    // SB delta when called by class j = S*(2*eq - 1).
    evCallTimesWeight += w * (S * (2 * eq - 1));
  }
  const foldWeight = TOTAL_COMBOS - callWeight;
  // EV(jam) = P(BB folds)*(+1) + sum over called hands of delta, all /total.
  const evFold = foldWeight * 1.0; // SB wins BB's 1.0 blind
  return (evFold + evCallTimesWeight) / TOTAL_COMBOS;
}

/**
 * BB's EV of CALLING class `i` (relative to folding) given the SB jamming strategy.
 * BB only faces a decision when SB jams. Among SB's jamming hands (weighted),
 * BB calling delta vs jamming class j = S*(2*eqBB - 1) where eqBB = 1 - eqSB.
 * Folding delta (relative baseline) = -1.0 (BB loses its posted big blind) ...
 * but since both options share the "SB jammed" context, we compare:
 *   call: average over SB jam range of S*(2*eqBB - 1)
 *   fold: -1.0 (lose the 1.0 already posted)
 * BB calls iff EV(call) >= EV(fold).
 */
function bbCallEV(
  i: number,
  S: number,
  sbJam: Float64Array,
  equity: Float64Array,
): { call: number; fold: number } {
  let jamWeight = 0;
  let evCallTimesWeight = 0;
  for (let j = 0; j < N; j++) {
    const w = CLASS_WEIGHTS[j] * sbJam[j];
    if (w === 0) continue;
    jamWeight += w;
    const eqSB = eqAt(equity, j, i); // SB hero=j vs BB=i
    const eqBB = 1 - eqSB;
    evCallTimesWeight += w * (S * (2 * eqBB - 1));
  }
  if (jamWeight === 0) {
    // SB never jams -> BB never faces a decision; calling EV is irrelevant.
    return { call: 0, fold: 0 };
  }
  const call = evCallTimesWeight / jamWeight;
  const fold = -1.0;
  return { call, fold };
}

/**
 * Solve the HU push/fold equilibrium via damped fictitious play.
 *
 * @param S        effective stack in big blinds
 * @param equity   169x169 SB-equity matrix (row = SB hero class)
 * @param iters    fictitious-play iterations
 */
export function solvePushFold(
  S: number,
  equity: Float64Array,
  iters: number,
): PushFoldSolveResult {
  // Average strategies (the converging quantities).
  const sbJam = new Float64Array(N).fill(0.5);
  const bbCall = new Float64Array(N).fill(0.5);

  // Best-response (pure) strategies each iteration.
  const sbBR = new Float64Array(N);
  const bbBR = new Float64Array(N);

  for (let t = 1; t <= iters; t++) {
    // Best response of SB to current average BB calling strategy.
    for (let i = 0; i < N; i++) {
      const evJam = sbJamEV(i, S, bbCall, equity);
      const evFold = -0.5; // SB loses its posted small blind
      sbBR[i] = evJam >= evFold ? 1 : 0;
    }
    // Best response of BB to current average SB jamming strategy.
    for (let i = 0; i < N; i++) {
      const { call, fold } = bbCallEV(i, S, sbJam, equity);
      bbBR[i] = call >= fold ? 1 : 0;
    }
    // Average the best responses into the running strategy (fictitious play).
    const lr = 1 / (t + 1);
    for (let i = 0; i < N; i++) {
      sbJam[i] += lr * (sbBR[i] - sbJam[i]);
      bbCall[i] += lr * (bbBR[i] - bbCall[i]);
    }
  }

  // --- Exploitability (best-response gain) of the converged average strategy. ---
  const expl = bestResponseExploitability(S, equity, sbJam, bbCall);

  // Combo-weighted fractions for reporting.
  let sbW = 0;
  let bbW = 0;
  for (let i = 0; i < N; i++) {
    sbW += CLASS_WEIGHTS[i] * sbJam[i];
    bbW += CLASS_WEIGHTS[i] * bbCall[i];
  }

  return {
    sbJam,
    bbCall,
    iterations: iters,
    exploitabilityBbPerGame: expl,
    exploitabilityMbbPer100: expl * 1000 * 100,
    sbJamFraction: sbW / TOTAL_COMBOS,
    bbCallFraction: bbW / TOTAL_COMBOS,
  };
}

/**
 * Exploitability = sum of both players' best-response gains against the produced
 * (average) strategy profile, in big blinds per game. An equilibrium has ~0.
 *
 * SB's BR gain: for each SB class, max(EV(jam), EV(fold)) under the current BB
 * strategy, weighted by class frequency; minus the value SB actually achieves
 * with its mixed strategy. Same idea for BB over the hands where it faces a jam.
 */
export function bestResponseExploitability(
  S: number,
  equity: Float64Array,
  sbJam: Float64Array,
  bbCall: Float64Array,
): number {
  // SB side.
  let sbActual = 0;
  let sbBest = 0;
  for (let i = 0; i < N; i++) {
    const wi = CLASS_WEIGHTS[i] / TOTAL_COMBOS;
    const evJam = sbJamEV(i, S, bbCall, equity);
    const evFold = -0.5;
    const actual = sbJam[i] * evJam + (1 - sbJam[i]) * evFold;
    const best = Math.max(evJam, evFold);
    sbActual += wi * actual;
    sbBest += wi * best;
  }
  const sbGain = sbBest - sbActual;

  // BB side. BB only acts when SB jams. Weight each BB class by its frequency,
  // and by the probability SB actually jams (so we measure regret on the reached
  // information sets). The "value" BB gets is the per-hand call/fold value.
  let bbActual = 0;
  let bbBest = 0;
  // Probability SB jams (combo-weighted) — BB only faces a decision then.
  let pJam = 0;
  for (let j = 0; j < N; j++) pJam += (CLASS_WEIGHTS[j] / TOTAL_COMBOS) * sbJam[j];
  if (pJam > 0) {
    for (let i = 0; i < N; i++) {
      const wi = CLASS_WEIGHTS[i] / TOTAL_COMBOS;
      const { call, fold } = bbCallEV(i, S, sbJam, equity);
      const actual = bbCall[i] * call + (1 - bbCall[i]) * fold;
      const best = Math.max(call, fold);
      // Scale by pJam: BB only realises this decision when SB jams.
      bbActual += wi * pJam * actual;
      bbBest += wi * pJam * best;
    }
  }
  const bbGain = bbBest - bbActual;

  return Math.max(0, sbGain) + Math.max(0, bbGain);
}
