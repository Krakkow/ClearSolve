// Sanity-print predefined defense chart frequencies. Run: npx vite-node scripts/realismCharts.ts
import { lookupChart } from '../src/domain/charts';
import { seatIndexOf, preflopActionOrder } from '../src/domain/seatLayout';
import type { PriorAction, SpotConfigV2, TableSize, SeatPosition } from '../src/domain/spotV2';

function vsOpen(tableSize: TableSize, hero: SeatPosition, opener: SeatPosition): SpotConfigV2 {
  const order = preflopActionOrder(tableSize);
  const heroSeat = seatIndexOf(tableSize, hero);
  const openerSeat = seatIndexOf(tableSize, opener);
  const heroIdx = order.indexOf(heroSeat);
  const priorActions: PriorAction[] = order.slice(0, heroIdx).map((si) =>
    si === openerSeat ? { seatIndex: si, kind: 'raise' as const, toBb: 2.5 } : { seatIndex: si, kind: 'fold' as const },
  );
  return {
    schemaVersion: 2, gameType: 'NLHE', gameMode: 'cash', tableSize, heroPosition: hero,
    stakes: { smallBlindBb: 0.5, bigBlindBb: 1 }, effectiveStackBb: 100,
    betContext: { priorActions, raiseDepth: 1 },
    betSizing: { id: 'd', label: 'd', openTo: 2.5, threeBetTo: 11, fourBetTo: 24 },
  };
}

function show(label: string, s: SpotConfigV2) {
  const c = lookupChart(s);
  if (!c) { console.log(`  ${label}: (no chart)`); return; }
  const f = c.heroNode.nodeActionFreq;
  const pct = (x?: number) => ((x ?? 0) * 100).toFixed(0);
  console.log(`  ${label}: fold ${pct(f.fold)}% · call ${pct(f.call)}% · 3-bet ${pct(f['raise-small'])}%  (defend ${(100 - Number(pct(f.fold)))}%)`);
}

console.log('Blind defense (6-max, 100bb):');
show('BB vs UTG ', vsOpen(6, 'BB', 'UTG'));
show('BB vs CO  ', vsOpen(6, 'BB', 'CO'));
show('BB vs BTN ', vsOpen(6, 'BB', 'BTN'));
show('BB vs SB  ', vsOpen(6, 'BB', 'SB'));
show('SB vs UTG ', vsOpen(6, 'SB', 'UTG'));
show('SB vs BTN ', vsOpen(6, 'SB', 'BTN'));

console.log('\nIn-position defense vs a UTG open (9-max, 100bb) — defender position:');
show('MP  vs UTG', vsOpen(9, 'MP', 'UTG'));
show('HJ  vs UTG', vsOpen(9, 'HJ', 'UTG'));
show('CO  vs UTG', vsOpen(9, 'CO', 'UTG'));
show('BTN vs UTG', vsOpen(9, 'BTN', 'UTG'));
console.log('  (BB vs UTG for reference: see above is 6-max; 9-max similar)');
console.log('In-position vs a later open:');
show('BTN vs CO ', vsOpen(9, 'BTN', 'CO'));
