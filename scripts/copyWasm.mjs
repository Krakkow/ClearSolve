// Copy the built wasm into src/ so the app (Vite) can import it. Run after cargo build.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../engine/target/wasm32-unknown-unknown/release/clearsolve_engine.wasm');
const dst = resolve(here, '../src/wasm/clearsolve_engine.wasm');

if (!existsSync(src)) {
  console.error(`wasm not found: ${src}\nRun: cargo build --manifest-path engine/Cargo.toml --target wasm32-unknown-unknown --release`);
  process.exit(1);
}
mkdirSync(dirname(dst), { recursive: true });
copyFileSync(src, dst);
console.log(`copied wasm -> ${dst}`);
