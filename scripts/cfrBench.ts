// Benchmark the full preflop CFR+ solve: Rust/WASM vs pure TS, same config + iters.
// Run: npx vite-node scripts/cfrBench.ts
import { readFileSync } from 'node:fs';
import { buildEquityMatrix } from '../src/domain/equityMatrix';
import { solvePreflopTree } from '../src/domain/preflopCfr';
import type { BetTreeConfig } from '../src/domain/betTree';

const wasmPath = new URL('../engine/target/wasm32-unknown-unknown/release/clearsolve_engine.wasm', import.meta.url);
const { instance } = await WebAssembly.instantiate(readFileSync(wasmPath), {});
const ex = instance.exports as unknown as {
  solve_preflop_tree: (eq: number, cfg: number, iters: number, edge: number, sb: number, bb: number, out: number, cap: number) => number;
  alloc_f64: (n: number) => number;
  free_f64: (p: number, n: number) => void;
  memory: WebAssembly.Memory;
};
const N = 169;
const writeF64 = (arr: ArrayLike<number>) => {
  const ptr = ex.alloc_f64(arr.length);
  new Float64Array(ex.memory.buffer, ptr, arr.length).set(arr);
  return ptr;
};

const cfg: BetTreeConfig = { smallBlind: 0.5, bigBlind: 1, stack: 100, openTo: 2.5, threeBetTo: 11, fourBetTo: 24 };
const equity = buildEquityMatrix(300, 1337);
const iters = 1500;
const edge = 0.085;

function rustSolve() {
  const eqPtr = writeF64(equity);
  const cfgPtr = writeF64([cfg.smallBlind, cfg.bigBlind, cfg.stack, cfg.openTo, cfg.threeBetTo, cfg.fourBetTo]);
  const cap = 8000;
  const outPtr = ex.alloc_f64(cap);
  const n = ex.solve_preflop_tree(eqPtr, cfgPtr, iters, edge, 0, 0, outPtr, cap);
  ex.free_f64(eqPtr, N * N); ex.free_f64(cfgPtr, 6); ex.free_f64(outPtr, cap);
  return n;
}

// Warm up both paths once (JIT + wasm instantiate).
solvePreflopTree(cfg, equity, 50, { realizationEdge: edge });
rustSolve();

const t0 = performance.now();
solvePreflopTree(cfg, equity, iters, { realizationEdge: edge });
const tsMs = performance.now() - t0;

const t1 = performance.now();
rustSolve();
const rsMs = performance.now() - t1;

console.log(`CFR+ solve @ ${iters} iters, HU 100bb:`);
console.log(`  TS   : ${tsMs.toFixed(0)} ms`);
console.log(`  Rust : ${rsMs.toFixed(0)} ms`);
console.log(`  speedup: ${(tsMs / rsMs).toFixed(2)}x`);
