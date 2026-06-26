// Realism check for the scenario builder: solve a few AUTHORED spots and print the
// hero's action frequencies. Run: npx vite-node scripts/realismScenario.ts
import { PreflopEngine } from '../src/engine/preflopEngine';
import type { SolveSettings } from '../src/engine/types';
import type { PriorAction, SpotConfigV2, TableSize, SeatPosition } from '../src/domain/spotV2';
import { prettyLabel } from '../src/domain/actionLabels';

const settings: SolveSettings = { algorithm: 'cfr+', seed: 1337, iterations: 1000, equitySamples: 400 };
const engine = new PreflopEngine();

function spot(
  tableSize: TableSize,
  heroPosition: SeatPosition,
  priorActions: PriorAction[],
  raiseDepth: number,
  stack = 100,
): SpotConfigV2 {
  return {
    schemaVersion: 2,
    gameType: 'NLHE',
    gameMode: 'cash',
    tableSize,
    heroPosition,
    stakes: { smallBlindBb: 0.5, bigBlindBb: 1 },
    effectiveStackBb: stack,
    betContext: { priorActions, raiseDepth },
    betSizing: { id: 'd', label: 'd', openTo: 2.5, threeBetTo: 11, fourBetTo: 24 },
  };
}

async function run(name: string, s: SpotConfigV2) {
  const res = await engine.solve({ mode: 'preflop-spot', spot: s, settings }, () => {});
  if (res.mode !== 'preflop-spot') return;
  const n = res.heroNode;
  const parts = n.actions.map((ca, i) => `${prettyLabel(n.actionLabels[i])} ${((n.nodeActionFreq[ca] ?? 0) * 100).toFixed(1)}%`);
  console.log(`\n${name}`);
  console.log(`  trust: ${res.trust.label}  |  live opps via caption: ${res.trust.caption.slice(0, 70)}…`);
  console.log(`  hero (${n.label}): ${parts.join('  ·  ')}`);
}

// 6-max seat indices: SB=0, BB=1, UTG=2, HJ=3, CO=4, BTN=5.
const F = (si: number): PriorAction => ({ seatIndex: si, kind: 'fold' });

await run('HU sanity — SB RFI 100bb', spot(2, 'SB', [], 0));

await run('6-max — folds to BTN, hero BB facing BTN open 2.5', spot(6, 'BB', [
  F(2), F(3), F(4), { seatIndex: 5, kind: 'raise', toBb: 2.5 }, F(0),
], 1));

await run('6-max — UTG open 2.5, folds to hero BTN', spot(6, 'BTN', [
  { seatIndex: 2, kind: 'raise', toBb: 2.5 }, F(3), F(4),
], 1));

await run('6-max — SQUEEZE: UTG open 2.5, CO call, hero BTN', spot(6, 'BTN', [
  { seatIndex: 2, kind: 'raise', toBb: 2.5 }, F(3), { seatIndex: 4, kind: 'call' },
], 1));

await run('6-max — UTG RFI 100bb (early position open)', spot(6, 'UTG', [], 0));
