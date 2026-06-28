// Rust/WASM engine loader. Lazily instantiates engine/ (raw wasm32 cdylib) and exposes
// the ported solver pieces. Currently: the all-in equity matrix build (bit-identical to
// the TS one, faster). Imported only by the Web Worker, so node/tests never load wasm.

import init from './clearsolve_engine.wasm?init';
import type { EquityMatrixProgress } from '../domain/equityMatrix';

interface EngineExports {
  build_equity_matrix(ptr: number, samples: number, seed: number): void;
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
