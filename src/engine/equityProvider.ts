// Injectable equity-matrix builder. The default is the pure-TS Monte-Carlo build;
// the Web Worker overrides it with the Rust/WASM build (bit-identical, faster). Node
// (tests, scripts) never overrides it, so it stays on the TS path.

import { buildEquityMatrix, type EquityMatrixProgress } from '../domain/equityMatrix';

export type EquityBuilder = (
  samples: number,
  seed: number,
  onProgress?: (p: EquityMatrixProgress) => void,
) => Promise<Float64Array>;

let current: EquityBuilder = async (samples, seed, onProgress) =>
  buildEquityMatrix(samples, seed, onProgress);

export function setEquityBuilder(fn: EquityBuilder): void {
  current = fn;
}

export function getEquityBuilder(): EquityBuilder {
  return current;
}
