// OFFLINE GENERATION PIPELINE (E4 / ADR-009) — the "desktop calculation" that
// populates the predefined library by SOLVING spots at high quality (no browser
// memory/time limits) and writing the result to a committed JSON the app loads.
//
// v1 scope: RFI charts (6-max + 9-max, ~100bb). The equity matrix is built ONCE
// (high Monte-Carlo sample count) and reused across all spots; each spot is solved
// with the calibrated open realization-edge at a high CFR iteration count, so the
// output has real MIXED frequencies (not pure in/out like the hand-curated charts).
//
// Run: npm run gen:library   (override quality via env: GEN_ITERS, GEN_EQ_SAMPLES)

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEquityMatrix } from '../src/domain/equityMatrix';
import { projectToBetTreeConfig } from '../src/domain/projectSpot';
import { solvePreflopTree } from '../src/domain/preflopCfr';
import { toNodeStrategyV2 } from '../src/engine/resultV2';
import { seatIndexOf, preflopActionOrder, validPositions } from '../src/domain/seatLayout';
import type { PriorAction, SpotConfigV2, TableSize, SeatPosition } from '../src/domain/spotV2';

const SEED = 1337;
const ITERS = Number(process.env.GEN_ITERS ?? 4000);
const EQ_SAMPLES = Number(process.env.GEN_EQ_SAMPLES ?? 1500);
const STACK = 100;

function foldToHeroRfi(tableSize: TableSize, hero: SeatPosition): SpotConfigV2 {
  const order = preflopActionOrder(tableSize);
  const heroIdx = order.indexOf(seatIndexOf(tableSize, hero));
  const priorActions: PriorAction[] = order
    .slice(0, heroIdx)
    .map((si) => ({ seatIndex: si, kind: 'fold' as const }));
  return {
    schemaVersion: 2, gameType: 'NLHE', gameMode: 'cash', tableSize, heroPosition: hero,
    stakes: { smallBlindBb: 0.5, bigBlindBb: 1 }, effectiveStackBb: STACK,
    betContext: { priorActions, raiseDepth: 0 },
    betSizing: { id: 'gen', label: 'gen', openTo: 2.5, threeBetTo: 11, fourBetTo: 24 },
  };
}

const round = (x: number) => Math.round(x * 1e4) / 1e4;

function main() {
  console.log(`Generating RFI library (iters=${ITERS}, equitySamples=${EQ_SAMPLES})…`);
  const t0 = Date.now();
  console.log('Building equity matrix (shared across all spots)…');
  const equity = buildEquityMatrix(EQ_SAMPLES, SEED);
  console.log(`  equity built in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const entries: Record<string, unknown> = {};
  for (const tableSize of [6, 9] as TableSize[]) {
    for (const pos of validPositions(tableSize)) {
      if (pos === 'BB') continue; // BB never opens unopened
      const spot = foldToHeroRfi(tableSize, pos);
      const proj = projectToBetTreeConfig(spot);
      const result = solvePreflopTree(proj.config, equity, ITERS, { realizationEdge: proj.realizationEdge });
      const raw = result.nodes.find((n) => n.label === proj.heroNodeLabel) ?? result.nodes[0];
      const node = toNodeStrategyV2(raw, proj.heroRaiseDepth, proj.heroSeatIndex, 0);
      const key = `cash|${tableSize}|${pos}|100bb|rfi`;
      entries[key] = {
        raiseDepth: node.raiseDepth,
        actions: node.actions,
        actionLabels: node.actionLabels,
        nodeActionFreq: node.actions.map((a) => round(node.nodeActionFreq[a] ?? 0)),
        hands: node.hands.map((h) => node.actions.map((a) => round(h.freqs[a] ?? 0))),
      };
      const open = ((node.nodeActionFreq['raise-small'] ?? 0) + (node.nodeActionFreq.allin ?? 0)) * 100;
      console.log(`  ${tableSize}-max ${pos.padEnd(4)} open ${open.toFixed(1)}%  ->  ${key}`);
    }
  }

  const out = {
    meta: {
      kind: 'rfi',
      engineVersion: 'ts-preflop-gen',
      iterations: ITERS,
      equitySamples: EQ_SAMPLES,
      seed: SEED,
      stackBb: STACK,
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
