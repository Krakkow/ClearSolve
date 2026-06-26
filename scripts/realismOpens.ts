// Calibration sweep: solve a FOLD-TO-HERO open for each position and print open%.
// Run: npx vite-node scripts/realismOpens.ts
import { PreflopEngine } from '../src/engine/preflopEngine';
import { preflopActionOrder, seatIndexOf } from '../src/domain/seatLayout';
import type { SolveSettings } from '../src/engine/types';
import type { PriorAction, SpotConfigV2, TableSize, SeatPosition } from '../src/domain/spotV2';

const settings: SolveSettings = { algorithm: 'cfr+', seed: 1337, iterations: 1000, equitySamples: 350 };
const engine = new PreflopEngine();

function foldToHeroOpen(tableSize: TableSize, hero: SeatPosition): SpotConfigV2 {
  const order = preflopActionOrder(tableSize);
  const heroIdx = order.indexOf(seatIndexOf(tableSize, hero));
  const priorActions: PriorAction[] = order.slice(0, heroIdx).map((si) => ({ seatIndex: si, kind: 'fold' as const }));
  return {
    schemaVersion: 2, gameType: 'NLHE', gameMode: 'cash', tableSize, heroPosition: hero,
    stakes: { smallBlindBb: 0.5, bigBlindBb: 1 }, effectiveStackBb: 100,
    betContext: { priorActions, raiseDepth: 0 },
    betSizing: { id: 'd', label: 'd', openTo: 2.5, threeBetTo: 11, fourBetTo: 24 },
  };
}

async function openPct(tableSize: TableSize, hero: SeatPosition) {
  const res = await engine.solve({ mode: 'preflop-spot', spot: foldToHeroOpen(tableSize, hero), settings }, () => {});
  if (res.mode !== 'preflop-spot') return;
  const n = res.heroNode;
  const f = (ca: string) => (n.nodeActionFreq[ca as keyof typeof n.nodeActionFreq] ?? 0) * 100;
  const open = f('raise-small') + f('raise-big') + f('allin');
  console.log(`  ${tableSize}-max ${hero.padEnd(4)} (behind ${tableSize - 1 - res.spot.betContext.priorActions.length}): OPEN ${open.toFixed(1)}%  (fold ${f('fold').toFixed(1)}%)`);
}

console.log('Open % by position (target: BTN~45 / CO~28 / HJ~20 / UTG6~16 / UTG9~13):');
await openPct(2, 'SB');
await openPct(6, 'BTN');
await openPct(6, 'CO');
await openPct(6, 'HJ');
await openPct(6, 'UTG');
await openPct(9, 'UTG');
