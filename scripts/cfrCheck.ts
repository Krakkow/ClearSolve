// Quick CFR convergence check: build a small equity matrix, solve at a few depths,
// print exploitability + zero-sum + headline frequencies. Run:
//   npx vite-node scripts/cfrCheck.ts
import { buildEquityMatrix } from '../src/domain/equityMatrix';
import { solvePreflopTree } from '../src/domain/preflopCfr';
import { DEFAULT_SIZES } from '../src/domain/betTree';
import { CLASS_WEIGHTS } from '../src/domain/pushfold';

const equity = buildEquityMatrix(300, 1337);

function cfg(stack: number) {
  return {
    smallBlind: DEFAULT_SIZES.smallBlind,
    bigBlind: DEFAULT_SIZES.bigBlind,
    stack,
    openTo: DEFAULT_SIZES.openTo,
    threeBetTo: DEFAULT_SIZES.threeBetTo,
    fourBetTo: DEFAULT_SIZES.fourBetTo,
  };
}

function comboFrac(strategy: number[][], actionIdx: number): number {
  let num = 0;
  let den = 0;
  for (let k = 0; k < 169; k++) {
    den += CLASS_WEIGHTS[k];
    num += CLASS_WEIGHTS[k] * (strategy[k][actionIdx] ?? 0);
  }
  return num / den;
}

for (const S of [100, 40, 10]) {
  const r = solvePreflopTree(cfg(S), equity, 1500);
  const root = r.nodes.find((n) => n.label === 'SB Open')!;
  const bb = r.nodes.find((n) => n.label === 'BB vs Open')!;
  const foldIdx = root.actionLabels.findIndex((l) => l.startsWith('Fold'));
  const openIdx = root.actionLabels.findIndex((l) => l.startsWith('Open'));
  const jamIdx = root.actionLabels.findIndex((l) => l.startsWith('All-in'));
  const bbFoldIdx = bb.actionLabels.findIndex((l) => l.startsWith('Fold'));
  const bbCallIdx = bb.actionLabels.findIndex((l) => l.startsWith('Call'));
  const bb3betIdx = bb.actionLabels.findIndex((l) => l.startsWith('3-Bet'));

  console.log(`\n=== ${S}bb ===`);
  console.log(`  exploitability=${r.exploitabilityBbPerGame.toFixed(5)} bb/g  evSb=${r.evSb.toFixed(4)}  zeroSum(evSb+evBb)=${(r.evSb + r.evBb).toExponential(2)}`);
  console.log(`  SB: fold ${(comboFrac(root.strategy, foldIdx) * 100).toFixed(1)}%  open ${(openIdx >= 0 ? comboFrac(root.strategy, openIdx) * 100 : 0).toFixed(1)}%  jam ${(jamIdx >= 0 ? comboFrac(root.strategy, jamIdx) * 100 : 0).toFixed(1)}%`);
  console.log(`  BB vs open: fold ${(comboFrac(bb.strategy, bbFoldIdx) * 100).toFixed(1)}%  call ${(comboFrac(bb.strategy, bbCallIdx) * 100).toFixed(1)}%  3bet ${(bb3betIdx >= 0 ? comboFrac(bb.strategy, bb3betIdx) * 100 : 0).toFixed(1)}%`);
}
