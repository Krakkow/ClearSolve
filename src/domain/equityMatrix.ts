// Domain Core — build the full 169x169 class-vs-class all-in equity matrix.
//
// equity[i*169 + j] = SB-equity of hero class i vs villain class j (0..1).
// Computed once via Monte Carlo, then reused by the push/fold solver for every
// stack depth (the equities don't depend on stack size). Deterministic given seed.
//
// Symmetry: for i !== j we compute equity[i][j] directly, and set
// equity[j][i] = 1 - equity[i][j] (ties split evenly, so SB-equity vs the swapped
// hero is the complement). Diagonal i===i (class vs same class, e.g. AA vs AA over
// different suits) is computed directly. This halves the Monte Carlo work and keeps
// the matrix internally consistent.

import { classVsClassEquity } from './equity';

const N = 169;

export interface EquityMatrixProgress {
  done: number;
  total: number;
}

export function buildEquityMatrix(
  samples: number,
  seed: number,
  onProgress?: (p: EquityMatrixProgress) => void,
): Float64Array {
  const m = new Float64Array(N * N);
  const total = (N * (N + 1)) / 2; // upper triangle incl. diagonal
  let done = 0;
  let progressTick = 0;

  for (let i = 0; i < N; i++) {
    for (let j = i; j < N; j++) {
      // Derive a per-pair seed so the whole matrix is reproducible from one seed.
      const pairSeed = (seed ^ (i * 73856093) ^ (j * 19349663)) >>> 0;
      const eq = classVsClassEquity(i, j, samples, pairSeed);
      m[i * N + j] = eq;
      if (i !== j) m[j * N + i] = 1 - eq;
      done++;
      if (onProgress && ++progressTick >= 200) {
        progressTick = 0;
        onProgress({ done, total });
      }
    }
  }
  if (onProgress) onProgress({ done, total });
  return m;
}
