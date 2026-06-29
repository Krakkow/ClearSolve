// Injectable CFR solver. Default is the pure-TS solvePreflopTree; the Web Worker
// overrides it with the Rust/WASM solve (bit-identical, faster). Node (tests/scripts)
// never overrides it, so it stays on the TS path.

import { solvePreflopTree, type PreflopCfrResult, type PreflopSolveOptions } from '../domain/preflopCfr';
import type { BetTreeConfig } from '../domain/betTree';

export type CfrSolver = (
  config: BetTreeConfig,
  equity: Float64Array,
  iterations: number,
  options?: PreflopSolveOptions,
) => Promise<PreflopCfrResult>;

let current: CfrSolver = async (config, equity, iterations, options) =>
  solvePreflopTree(config, equity, iterations, options);

export function setCfrSolver(fn: CfrSolver): void {
  current = fn;
}

export function getCfrSolver(): CfrSolver {
  return current;
}
