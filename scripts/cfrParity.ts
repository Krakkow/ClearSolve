// Validate the Rust/WASM CFR+ solve vs the TS solvePreflopTree: same evSb,
// exploitability, and per-hand strategies. Run: npx vite-node scripts/cfrParity.ts
import { readFileSync } from 'node:fs';
import { buildEquityMatrix } from '../src/domain/equityMatrix';
import { solvePreflopTree } from '../src/domain/preflopCfr';
import { defaultRange } from '../src/domain/defaultRanges';
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

function rustSolve(cfg: BetTreeConfig, equity: Float64Array, iters: number, edge: number, bbRange?: Float64Array) {
  const eqPtr = writeF64(equity);
  const cfgPtr = writeF64([cfg.smallBlind, cfg.bigBlind, cfg.stack, cfg.openTo, cfg.threeBetTo, cfg.fourBetTo]);
  const bbPtr = bbRange ? writeF64(bbRange) : 0;
  const cap = 8000;
  const outPtr = ex.alloc_f64(cap);
  const n = ex.solve_preflop_tree(eqPtr, cfgPtr, iters, edge, 0, bbPtr, outPtr, cap);
  const out = new Float64Array(ex.memory.buffer, outPtr, n).slice();
  let p = 0;
  const numNodes = out[p++]; const evSb = out[p++]; const expl = out[p++]; p++;
  const nodes: { strategy: number[][]; freq: number[] }[] = [];
  for (let d = 0; d < numNodes; d++) {
    p += 2; const na = out[p++]; p += 2; // label, toAct, na, contrib0, contrib1
    p += na; // action kinds
    const freq: number[] = []; for (let a = 0; a < na; a++) freq.push(out[p++]);
    const strategy: number[][] = [];
    for (let k = 0; k < N; k++) { const row: number[] = []; for (let a = 0; a < na; a++) row.push(out[p++]); strategy.push(row); }
    nodes.push({ strategy, freq });
  }
  return { evSb, expl, nodes };
}

function compare(label: string, cfg: BetTreeConfig, equity: Float64Array, iters: number, edge: number, bbRange?: Float64Array) {
  const opts = bbRange ? { realizationEdge: edge, bbRangeWeights: bbRange } : { realizationEdge: edge };
  const ts = solvePreflopTree(cfg, equity, iters, opts);
  const rs = rustSolve(cfg, equity, iters, edge, bbRange);
  let maxDiff = Math.abs(ts.evSb - rs.evSb);
  maxDiff = Math.max(maxDiff, Math.abs(ts.exploitabilityBbPerGame - rs.expl));
  for (let d = 0; d < ts.nodes.length; d++) {
    const tn = ts.nodes[d]; const rn = rs.nodes[d];
    for (let k = 0; k < N; k++) for (let a = 0; a < tn.strategy[k].length; a++) {
      maxDiff = Math.max(maxDiff, Math.abs(tn.strategy[k][a] - rn.strategy[k][a]));
    }
  }
  console.log(`  ${label}: evSb TS ${ts.evSb.toFixed(5)} / Rust ${rs.evSb.toFixed(5)} · expl ${(ts.exploitabilityBbPerGame * 1000).toFixed(2)} mbb · MAX DIFF ${maxDiff.toExponential(2)}`);
  return maxDiff;
}

const cfg: BetTreeConfig = { smallBlind: 0.5, bigBlind: 1, stack: 100, openTo: 2.5, threeBetTo: 11, fourBetTo: 24 };
const equity = buildEquityMatrix(300, 1337);
console.log('CFR parity (Rust/WASM vs TS), HU 100bb:');
const d1 = compare('full-range @500 iters', cfg, equity, 500, 0.085);
const d2 = compare('vs a CO open range @500 iters', cfg, equity, 500, 0.085, defaultRange('CO', 'open', 100));
const short: BetTreeConfig = { ...cfg, stack: 10 };
const d3 = compare('10bb (clamps to jam/fold) @500 iters', short, equity, 500, 0.085);

const ok = Math.max(d1, d2, d3) < 1e-9;
console.log(ok ? '\nCFR PARITY OK ✓ — Rust CFR matches TS to < 1e-9' : `\nCFR PARITY: max diff ${Math.max(d1, d2, d3).toExponential(2)} (investigate if large)`);
process.exit(ok ? 0 : 1);
