// Rust/WASM engine loader. Lazily instantiates engine/ (raw wasm32 cdylib) and exposes
// the ported solver pieces. Currently: the all-in equity matrix build (bit-identical to
// the TS one, faster). Imported only by the Web Worker, so node/tests never load wasm.

import init from './clearsolve_engine.wasm?init';
import type { EquityMatrixProgress } from '../domain/equityMatrix';
import type { BetTreeConfig } from '../domain/betTree';
import type { NodeStrategy, PreflopCfrResult, PreflopSolveOptions } from '../domain/preflopCfr';

interface EngineExports {
  build_equity_matrix(ptr: number, samples: number, seed: number): void;
  solve_preflop_tree(
    eq: number, cfg: number, iters: number, edge: number, sb: number, bb: number, out: number, cap: number,
  ): number;
  alloc_f64(n: number): number;
  free_f64(ptr: number, n: number): void;
  memory: WebAssembly.Memory;
}

let exportsP: Promise<EngineExports> | null = null;
function load(): Promise<EngineExports> {
  exportsP ??= init({}).then((inst) => inst.exports as unknown as EngineExports);
  return exportsP;
}

const N = 169;

/** Build the 169x169 equity matrix in Rust/WASM (drop-in for the TS builder). */
export async function buildEquityMatrixWasm(
  samples: number,
  seed: number,
  onProgress?: (p: EquityMatrixProgress) => void,
): Promise<Float64Array> {
  const ex = await load();
  onProgress?.({ done: 0, total: 1 });
  const ptr = ex.alloc_f64(N * N);
  try {
    ex.build_equity_matrix(ptr, samples, seed);
    const out = new Float64Array(N * N);
    // Copy out of wasm memory before it can be reused/grown.
    out.set(new Float64Array(ex.memory.buffer, ptr, N * N));
    onProgress?.({ done: 1, total: 1 });
    return out;
  } finally {
    ex.free_f64(ptr, N * N);
  }
}

const TREE_LABELS = ['SB Open', 'BB vs Open', 'SB vs 3-bet', 'BB vs 4-bet', 'SB vs 5-bet jam'];
const KIND_LABELS = ['Fold', 'Call', 'Raise', 'All-in']; // canonicalForTreeLabel maps these correctly
const DEFAULT_EDGE = 0.085;

/** Solve a preflop bet tree in Rust/WASM (drop-in for solvePreflopTree). */
export async function buildPreflopTreeWasm(
  config: BetTreeConfig,
  equity: Float64Array,
  iterations: number,
  options?: PreflopSolveOptions,
): Promise<PreflopCfrResult> {
  const ex = await load();
  const eqPtr = ex.alloc_f64(N * N);
  new Float64Array(ex.memory.buffer, eqPtr, N * N).set(equity);
  const cfgPtr = ex.alloc_f64(6);
  new Float64Array(ex.memory.buffer, cfgPtr, 6).set([
    config.smallBlind, config.bigBlind, config.stack, config.openTo, config.threeBetTo, config.fourBetTo,
  ]);
  let sbPtr = 0;
  let bbPtr = 0;
  if (options?.sbRangeWeights) {
    sbPtr = ex.alloc_f64(N);
    new Float64Array(ex.memory.buffer, sbPtr, N).set(options.sbRangeWeights);
  }
  if (options?.bbRangeWeights) {
    bbPtr = ex.alloc_f64(N);
    new Float64Array(ex.memory.buffer, bbPtr, N).set(options.bbRangeWeights);
  }
  const edge = options?.realizationEdge ?? DEFAULT_EDGE;
  const cap = 8000;
  const outPtr = ex.alloc_f64(cap);
  const n = ex.solve_preflop_tree(eqPtr, cfgPtr, iterations, edge, sbPtr, bbPtr, outPtr, cap);
  const out = new Float64Array(ex.memory.buffer, outPtr, n).slice();
  ex.free_f64(eqPtr, N * N);
  ex.free_f64(cfgPtr, 6);
  if (sbPtr) ex.free_f64(sbPtr, N);
  if (bbPtr) ex.free_f64(bbPtr, N);
  ex.free_f64(outPtr, cap);

  let p = 0;
  const numNodes = out[p++];
  const evSb = out[p++];
  const expl = out[p++];
  const iters = out[p++];
  const nodes: NodeStrategy[] = [];
  for (let d = 0; d < numNodes; d++) {
    const labelCode = out[p++];
    const toAct = out[p++] as 0 | 1;
    const na = out[p++];
    const c0 = out[p++];
    const c1 = out[p++];
    const actionLabels: string[] = [];
    for (let a = 0; a < na; a++) actionLabels.push(KIND_LABELS[out[p++]]);
    const nodeActionFreq: number[] = [];
    for (let a = 0; a < na; a++) nodeActionFreq.push(out[p++]);
    const strategy: number[][] = [];
    for (let k = 0; k < N; k++) {
      const row: number[] = [];
      for (let a = 0; a < na; a++) row.push(out[p++]);
      strategy.push(row);
    }
    nodes.push({ nodeId: labelCode, label: TREE_LABELS[labelCode], toAct, actionLabels, strategy, nodeActionFreq, contrib: [c0, c1] });
  }
  return {
    nodes,
    iterations: iters,
    exploitabilityBbPerGame: expl,
    exploitabilityMbbPer100: expl * 1000 * 100,
    evSb,
    evBb: -evSb,
  };
}
