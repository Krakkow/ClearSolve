// Validate the Rust/WASM equity matrix vs the TS one: bit-identical, correct known
// matchups, and a speed benchmark. Run: npx vite-node scripts/equityParity.ts
import { readFileSync } from 'node:fs';
import { buildEquityMatrix } from '../src/domain/equityMatrix';
import { HAND_CLASSES } from '../src/domain/handClasses';

const wasmPath = new URL('../engine/target/wasm32-unknown-unknown/release/clearsolve_engine.wasm', import.meta.url);
const { instance } = await WebAssembly.instantiate(readFileSync(wasmPath), {});
const ex = instance.exports as unknown as {
  build_equity_matrix: (ptr: number, samples: number, seed: number) => void;
  alloc_f64: (n: number) => number;
  free_f64: (ptr: number, n: number) => void;
  memory: WebAssembly.Memory;
};

const N = 169;
const SAMPLES = 600;
const SEED = 1337;

function rustMatrix(samples: number, seed: number): Float64Array {
  const ptr = ex.alloc_f64(N * N);
  ex.build_equity_matrix(ptr, samples, seed);
  const out = new Float64Array(N * N);
  out.set(new Float64Array(ex.memory.buffer, ptr, N * N)); // copy out before any realloc
  ex.free_f64(ptr, N * N);
  return out;
}

// --- bit-parity vs TS ---
const ts = buildEquityMatrix(SAMPLES, SEED);
const rs = rustMatrix(SAMPLES, SEED);
let maxDiff = 0;
for (let i = 0; i < N * N; i++) maxDiff = Math.max(maxDiff, Math.abs(ts[i] - rs[i]));
console.log(`Bit-parity vs TS (samples=${SAMPLES}): max abs diff = ${maxDiff}`);

// --- known matchups (from the Rust matrix) ---
const idx = (label: string) => HAND_CLASSES.findIndex((h) => h.label === label);
const big = rustMatrix(20000, 99);
const eq = (a: string, b: string) => big[idx(a) * N + idx(b)];
console.log(`AA vs KK = ${(eq('AA', 'KK') * 100).toFixed(1)}%  (expect ~82%)`);
console.log(`AKs vs 22 = ${(eq('AKs', '22') * 100).toFixed(1)}%  (expect ~50%)`);

// --- speed benchmark ---
const t0 = performance.now();
buildEquityMatrix(1500, SEED);
const tTs = performance.now() - t0;
const t1 = performance.now();
rustMatrix(1500, SEED);
const tRs = performance.now() - t1;
console.log(`\nBuild time @1500 samples — TS: ${tTs.toFixed(0)}ms   Rust/WASM: ${tRs.toFixed(0)}ms   (${(tTs / tRs).toFixed(1)}x faster)`);

const ok = maxDiff === 0 && Math.abs(eq('AA', 'KK') - 0.82) < 0.03;
console.log(ok ? '\nEQUITY OK ✓ — bit-identical to TS + correct matchups' : '\nEQUITY CHECK FAILED ✗');
process.exit(ok ? 0 : 1);
