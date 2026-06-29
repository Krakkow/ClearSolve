// OFFLINE GENERATION PIPELINE (E4 / ADR-009) — the "desktop calculation" that
// populates the predefined library by SOLVING spots at high quality (no browser
// memory/time limits) and writing the result to a committed JSON the app loads.
//
// v1 scope: RFI charts (6-max + 9-max), at multiple stack depths (100bb + 200bb).
// The equity matrix is built ONCE (high Monte-Carlo sample count) and reused across all
// spots; each spot is solved with the calibrated open realization-edge at a high CFR
// iteration count, so the output has real MIXED frequencies (not pure in/out like the
// hand-curated charts). The stack depth feeds the CFR, so deeper stacks get their own
// (slightly different, less stack-off) equilibrium.
//
// Run: npm run gen:library
//   override quality via env: GEN_ITERS, GEN_EQ_SAMPLES
//   override depths via env:  GEN_STACKS="100,200"

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEquityMatrix } from '../src/domain/equityMatrix';
import { projectToBetTreeConfig } from '../src/domain/projectSpot';
import { solvePreflopTree, type NodeStrategy, type PreflopCfrResult } from '../src/domain/preflopCfr';
import { toNodeStrategyV2 } from '../src/engine/resultV2';
import { seatIndexOf, preflopActionOrder, validPositions } from '../src/domain/seatLayout';
import type { BetTreeConfig } from '../src/domain/betTree';
import type { PriorAction, SpotConfigV2, TableSize, SeatPosition } from '../src/domain/spotV2';

// --- Rust/WASM solve (3.7x faster than TS), loaded synchronously from the release build.
// Falls back to the TS engine if the wasm isn't present (run `npm run wasm:build` first).
const N = 169;
const TREE_LABELS = ['SB Open', 'BB vs Open', 'SB vs 3-bet', 'BB vs 4-bet', 'SB vs 5-bet jam'];
const KIND_LABELS = ['Fold', 'Call', 'Raise', 'All-in'];

interface WasmEx {
  solve_preflop_tree(eq: number, cfg: number, iters: number, edge: number, sb: number, bb: number, out: number, cap: number): number;
  alloc_f64(n: number): number;
  free_f64(p: number, n: number): void;
  memory: WebAssembly.Memory;
}

function loadWasm(): WasmEx | null {
  try {
    const path = new URL('../engine/target/wasm32-unknown-unknown/release/clearsolve_engine.wasm', import.meta.url);
    const mod = new WebAssembly.Module(readFileSync(path));
    return new WebAssembly.Instance(mod, {}).exports as unknown as WasmEx;
  } catch {
    return null;
  }
}

const wasmEx = loadWasm();

/** Solve a bet tree — Rust/WASM when available, else the TS engine (same result shape). */
function solveTree(config: BetTreeConfig, equity: Float64Array, iters: number, edge: number): PreflopCfrResult {
  if (!wasmEx) return solvePreflopTree(config, equity, iters, { realizationEdge: edge });
  const ex = wasmEx;
  const eqPtr = ex.alloc_f64(N * N);
  new Float64Array(ex.memory.buffer, eqPtr, N * N).set(equity);
  const cfgPtr = ex.alloc_f64(6);
  new Float64Array(ex.memory.buffer, cfgPtr, 6).set([
    config.smallBlind, config.bigBlind, config.stack, config.openTo, config.threeBetTo, config.fourBetTo,
  ]);
  const cap = 8000;
  const outPtr = ex.alloc_f64(cap);
  const n = ex.solve_preflop_tree(eqPtr, cfgPtr, iters, edge, 0, 0, outPtr, cap);
  const out = new Float64Array(ex.memory.buffer, outPtr, n).slice();
  ex.free_f64(eqPtr, N * N); ex.free_f64(cfgPtr, 6); ex.free_f64(outPtr, cap);

  let p = 0;
  const numNodes = out[p++];
  const evSb = out[p++];
  const expl = out[p++];
  const iterations = out[p++];
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
  return { nodes, iterations, exploitabilityBbPerGame: expl, exploitabilityMbbPer100: expl * 1000 * 100, evSb, evBb: -evSb };
}

const SEED = 1337;
const ITERS = Number(process.env.GEN_ITERS ?? 4000);
const EQ_SAMPLES = Number(process.env.GEN_EQ_SAMPLES ?? 1500);
const STACKS = (process.env.GEN_STACKS ?? '100,200').split(',').map((s) => Number(s.trim()));

function foldToHeroRfi(tableSize: TableSize, hero: SeatPosition, stack: number): SpotConfigV2 {
  const order = preflopActionOrder(tableSize);
  const heroIdx = order.indexOf(seatIndexOf(tableSize, hero));
  const priorActions: PriorAction[] = order
    .slice(0, heroIdx)
    .map((si) => ({ seatIndex: si, kind: 'fold' as const }));
  return {
    schemaVersion: 2, gameType: 'NLHE', gameMode: 'cash', tableSize, heroPosition: hero,
    stakes: { smallBlindBb: 0.5, bigBlindBb: 1 }, effectiveStackBb: stack,
    betContext: { priorActions, raiseDepth: 0 },
    betSizing: { id: 'gen', label: 'gen', openTo: 2.5, threeBetTo: 11, fourBetTo: 24 },
  };
}

const round = (x: number) => Math.round(x * 1e4) / 1e4;

function main() {
  console.log(`Generating RFI library (stacks=${STACKS.join('/')}bb, iters=${ITERS}, equitySamples=${EQ_SAMPLES}, engine=${wasmEx ? 'Rust/WASM' : 'TS'})…`);
  const t0 = Date.now();
  console.log('Building equity matrix (shared across all spots)…');
  const equity = buildEquityMatrix(EQ_SAMPLES, SEED);
  console.log(`  equity built in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const entries: Record<string, unknown> = {};
  for (const stack of STACKS) {
    for (const tableSize of [6, 9] as TableSize[]) {
      for (const pos of validPositions(tableSize)) {
        if (pos === 'BB') continue; // BB never opens unopened
        const spot = foldToHeroRfi(tableSize, pos, stack);
        const proj = projectToBetTreeConfig(spot);
        const result = solveTree(proj.config, equity, ITERS, proj.realizationEdge ?? 0.085);
        const raw = result.nodes.find((n) => n.label === proj.heroNodeLabel) ?? result.nodes[0];
        const node = toNodeStrategyV2(raw, proj.heroRaiseDepth, proj.heroSeatIndex, 0);
        const key = `cash|${tableSize}|${pos}|${stack}bb|rfi`;
        entries[key] = {
          raiseDepth: node.raiseDepth,
          actions: node.actions,
          actionLabels: node.actionLabels,
          nodeActionFreq: node.actions.map((a) => round(node.nodeActionFreq[a] ?? 0)),
          hands: node.hands.map((h) => node.actions.map((a) => round(h.freqs[a] ?? 0))),
        };
        const open = ((node.nodeActionFreq['raise-small'] ?? 0) + (node.nodeActionFreq.allin ?? 0)) * 100;
        console.log(`  ${stack}bb ${tableSize}-max ${pos.padEnd(4)} open ${open.toFixed(1)}%  ->  ${key}`);
      }
    }
  }

  const out = {
    meta: {
      kind: 'rfi',
      engineVersion: 'ts-preflop-gen',
      iterations: ITERS,
      equitySamples: EQ_SAMPLES,
      seed: SEED,
      stacksBb: STACKS,
      generatedAt: new Date().toISOString(),
      note: 'Solved offline by the TS CFR+ engine (2-effective-player model). Reproducible; an estimate, not exact GTO.',
    },
    entries,
  };
  const here = dirname(fileURLToPath(import.meta.url));
  const dest = resolve(here, '../src/domain/generated/rfiLibrary.json');
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(out, null, 0));
  console.log(`Wrote ${Object.keys(entries).length} entries to ${dest} in ${((Date.now() - t0) / 1000).toFixed(1)}s total.`);
}

main();
