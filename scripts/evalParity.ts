// Parity check: the Rust/WASM eval7 must agree bit-for-bit with the TS evaluate7 on
// random 7-card hands. Run: npx vite-node scripts/evalParity.ts
import { readFileSync } from 'node:fs';
import { evaluate7 } from '../src/domain/evaluator7';
import { makeRng } from '../src/domain/rng';

const wasmPath = new URL('../engine/target/wasm32-unknown-unknown/release/clearsolve_engine.wasm', import.meta.url);
const { instance } = await WebAssembly.instantiate(readFileSync(wasmPath), {});
const eval7 = instance.exports.eval7 as (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;

const rng = makeRng(20260628).next;
const N = 200000;
let mismatches = 0;
let firstBad = '';
const deck = Array.from({ length: 52 }, (_, i) => i);

for (let t = 0; t < N; t++) {
  // Fisher-Yates partial shuffle for 7 distinct cards.
  for (let i = 0; i < 7; i++) {
    const j = i + Math.floor(rng() * (52 - i));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const [a, b, c, d, e, f, g] = deck;
  const ts = evaluate7(a, b, c, d, e, f, g);
  const rs = eval7(a, b, c, d, e, f, g);
  if (ts !== rs) {
    mismatches++;
    if (!firstBad) firstBad = `cards [${a},${b},${c},${d},${e},${f},${g}]  ts=${ts} rs=${rs}`;
  }
}

console.log(`Compared ${N.toLocaleString()} random 7-card hands.`);
console.log(mismatches === 0 ? 'PARITY OK ✓ — Rust eval7 == TS evaluate7 (bit-for-bit)' : `PARITY FAILED ✗ — ${mismatches} mismatches. First: ${firstBad}`);
process.exit(mismatches === 0 ? 0 : 1);
