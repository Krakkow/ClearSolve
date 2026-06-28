// Sanity-check the responder fix on 3-bet+ pots. Run: npx vite-node scripts/realismVs3bet.ts
import { PreflopEngine } from '../src/engine/preflopEngine';
import { seatIndexOf } from '../src/domain/seatLayout';
import type { SolveSettings } from '../src/engine/types';
import type { PriorAction, SpotConfigV2, TableSize, SeatPosition } from '../src/domain/spotV2';

const settings: SolveSettings = { algorithm: 'cfr+', seed: 1337, iterations: 1200, equitySamples: 400 };
const engine = new PreflopEngine();

function spot(tableSize: TableSize, hero: SeatPosition, pa: PriorAction[], raiseDepth: number, stack = 100): SpotConfigV2 {
  return {
    schemaVersion: 2, gameType: 'NLHE', gameMode: 'cash', tableSize, heroPosition: hero,
    stakes: { smallBlindBb: 0.5, bigBlindBb: 1 }, effectiveStackBb: stack,
    betContext: { priorActions: pa, raiseDepth }, betSizing: { id: 'd', label: 'd', openTo: 2.5, threeBetTo: 11, fourBetTo: 24 },
  };
}
const raise = (ts: TableSize, p: SeatPosition, to: number): PriorAction => ({ seatIndex: seatIndexOf(ts, p), kind: 'raise', toBb: to });
const fold = (ts: TableSize, p: SeatPosition): PriorAction => ({ seatIndex: seatIndexOf(ts, p), kind: 'fold' });

async function show(label: string, s: SpotConfigV2) {
  const res = await engine.solve({ mode: 'preflop-spot', spot: s, settings }, () => {});
  if (res.mode !== 'preflop-spot') return;
  const n = res.heroNode;
  const parts = n.actions.map((ca, i) => `${n.actionLabels[i]} ${((n.nodeActionFreq[ca] ?? 0) * 100).toFixed(0)}%`);
  console.log(`  ${label}\n     ${n.label} (depth ${n.raiseDepth}): ${parts.join(' · ')}`);
}

console.log('THE BUG SPOT — 9-max BB, UTG open 2.5, CO 3-bet 11, 200bb (was: 4-bet-shove 61%):');
await show('BB vs UTG-open + CO-3bet @200bb', spot(9, 'BB', [
  raise(9, 'UTG', 2.5), fold(9, 'UTG1'), fold(9, 'MP'), fold(9, 'LJ'), fold(9, 'HJ'),
  raise(9, 'CO', 11), fold(9, 'BTN'), fold(9, 'SB'),
], 2, 200));

console.log('\nOpener facing a 3-bet (was: calls ~61%):');
await show('CO opens 2.5, BTN 3-bets 11, hero CO @100bb', spot(9, 'CO', [
  fold(9, 'UTG'), fold(9, 'UTG1'), fold(9, 'MP'), fold(9, 'LJ'), fold(9, 'HJ'),
  raise(9, 'CO', 2.5), raise(9, 'BTN', 11),
], 2, 100));

console.log('\nUnchanged sanity checks:');
await show('BB vs BTN open 2.5 @100bb (depth 1)', spot(6, 'BB', [
  fold(6, 'UTG'), fold(6, 'HJ'), fold(6, 'CO'), raise(6, 'BTN', 2.5), fold(6, 'SB'),
], 1, 100));
await show('BTN RFI @100bb (depth 0)', spot(6, 'BTN', [fold(6, 'UTG'), fold(6, 'HJ'), fold(6, 'CO')], 0, 100));
