// Interop proof: load the raw wasm32 module and call its exports, including the
// linear-memory marshalling path the real solver will use. Run: node scripts/wasmCheck.mjs
import { readFileSync } from 'node:fs';

const wasmPath = new URL('../engine/target/wasm32-unknown-unknown/release/clearsolve_engine.wasm', import.meta.url);
const { instance } = await WebAssembly.instantiate(readFileSync(wasmPath), {});
const { add, engine_version, sum_f64, alloc_f64, free_f64, memory } = instance.exports;

const v = engine_version();
const sum = add(2, 3);
console.log(`engine_version = ${v}  (expect 100)`);
console.log(`add(2,3) = ${sum}  (expect 5)`);

// Marshal a Float64Array into wasm memory and sum it in Rust.
const data = [1.5, 2.5, 3.0, 4.0];
const ptr = alloc_f64(data.length);
new Float64Array(memory.buffer, ptr, data.length).set(data);
const s = sum_f64(ptr, data.length);
free_f64(ptr, data.length);
console.log(`sum_f64([1.5,2.5,3,4]) = ${s}  (expect 11)`);

const ok = v === 100 && sum === 5 && Math.abs(s - 11) < 1e-9;
console.log(ok ? '\nINTEROP OK ✓ — Rust -> WASM -> JS works (incl. memory marshalling)' : '\nINTEROP FAILED ✗');
process.exit(ok ? 0 : 1);
