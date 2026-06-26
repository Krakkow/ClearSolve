// E1 realism harness. Reports HU (tableSize 2) numbers + a couple of multiway
// (labeled-estimate) spots. Run: npx vite-node scripts/realismE1.ts
import { PreflopEngine } from '../src/engine/preflopEngine';
import type { SolveSettings } from '../src/engine/types';
import type { SpotConfigV2, SeatPosition, TableSize, BetContext } from '../src/domain/spotV2';

const settings: SolveSettings = {
  algorithm: 'cfr+',
  seed: 1337,
  iterations: 1500,
  equitySamples: 600,
};

const engine = new PreflopEngine();
const noop = () => {};

function spot(
  tableSize: TableSize,
  heroPosition: SeatPosition,
  stackBb: number,
  betContext: BetContext,
): SpotConfigV2 {
  return {
    schemaVersion: 2,
    gameType: 'NLHE',
    gameMode: 'cash',
    tableSize,
    heroPosition,
    stakes: { smallBlindBb: 0.5, bigBlindBb: 1.0 },
    effectiveStackBb: stackBb,
    betContext,
    betSizing: { id: 'd', label: 'd', openTo: 2.5, threeBetTo: 11, fourBetTo: 24 },
  };
}

const RFI: BetContext = { priorActions: [], raiseDepth: 0 };
const VS_RAISE: BetContext = {
  priorActions: [{ seatIndex: -1, kind: 'raise', toBb: 2.5 }],
  raiseDepth: 1,
};

function pct(node: any, label: string): string {
  const idx = node.actionLabels.indexOf(label);
  if (idx < 0) return '0.0';
  const ca = node.actions[idx];
  return ((node.nodeActionFreq[ca] ?? 0) * 100).toFixed(1);
}

async function report(name: string, s: SpotConfigV2) {
  const r = await engine.solve({ mode: 'preflop-spot', spot: s, settings }, noop);
  if (r.mode !== 'preflop-spot') return;
  const n = r.heroNode;
  console.log(`\n=== ${name} ===`);
  console.log(`  trust: ${r.trust.label}  | ${r.trust.caption}`);
  console.log(`  actions: [${n.actionLabels.join(', ')}]`);
  const summary = n.actionLabels
    .map((l: string) => `${l} ${pct(n, l)}%`)
    .join('  ');
  console.log(`  freqs: ${summary}`);
  console.log(`  exploitability=${(r.trust.exploitability!.valueBbPerGame * 1000).toFixed(2)} mbb/g  heroEV=${r.ev?.heroBb?.toFixed(3)} bb`);
}

(async () => {
  // (a) HU trustworthy path
  await report('HU 100bb (SB RFI)', spot(2, 'SB', 100, RFI));
  await report('HU 40bb (SB RFI)', spot(2, 'SB', 40, RFI));
  await report('HU 10bb (SB RFI)', spot(2, 'SB', 10, RFI));
  // (b) multiway labeled estimates
  await report('6-max BTN RFI 100bb (ESTIMATE)', spot(6, 'BTN', 100, RFI));
  await report('6-max BB vs BTN raise 100bb (ESTIMATE)', spot(6, 'BB', 100, VS_RAISE));
})();
