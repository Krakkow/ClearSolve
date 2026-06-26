import { describe, it, expect } from 'vitest';
import { buildEquityMatrix } from './equityMatrix';
import { solvePreflopTree } from './preflopCfr';
import { solvePushFold, CLASS_WEIGHTS } from './pushfold';
import { DEFAULT_SIZES } from './betTree';

// One modest equity matrix for the whole suite (stack-independent).
const SAMPLES = 300;
const SEED = 1337;
const equity = buildEquityMatrix(SAMPLES, SEED);

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

describe('CFR strategy validity', () => {
  it('frequencies sum to 1 across legal actions at every node and class', () => {
    const r = solvePreflopTree(cfg(100), equity, 400);
    for (const node of r.nodes) {
      for (let k = 0; k < 169; k++) {
        const sum = node.strategy[k].reduce((s, x) => s + x, 0);
        expect(sum).toBeGreaterThan(0.999);
        expect(sum).toBeLessThan(1.001);
      }
      // node action frequencies also sum to ~1
      const nodeSum = node.nodeActionFreq.reduce((s, x) => s + x, 0);
      expect(nodeSum).toBeGreaterThan(0.999);
      expect(nodeSum).toBeLessThan(1.001);
    }
  });

  it('root EV is approximately zero-sum (EV_SB + EV_BB ~ 0)', () => {
    const r = solvePreflopTree(cfg(100), equity, 800);
    expect(Math.abs(r.evSb + r.evBb)).toBeLessThan(1e-6);
  });

  it('converges to low exploitability', () => {
    const r = solvePreflopTree(cfg(100), equity, 2000);
    // Best-response gain should be small (bb/game) on this tiny tree. Uses the
    // INFORMATION-SET best response (not a clairvoyant per-pair max). A little slack
    // for the modest equity-matrix Monte-Carlo noise.
    expect(r.exploitabilityBbPerGame).toBeLessThan(0.08);
  });
});

describe('CFR determinism', () => {
  it('same params -> identical strategies', () => {
    const a = solvePreflopTree(cfg(100), equity, 500);
    const b = solvePreflopTree(cfg(100), equity, 500);
    for (let n = 0; n < a.nodes.length; n++) {
      expect(a.nodes[n].strategy).toEqual(b.nodes[n].strategy);
    }
    expect(a.exploitabilityBbPerGame).toBe(b.exploitabilityBbPerGame);
    expect(a.evSb).toBe(b.evSb);
  });
});

/**
 * Short-stack parity: when the stack is short enough that the open size clamps to
 * all-in (openTo=2.5 >= stack), the bet tree DEGENERATES to a pure jam/fold game and
 * MUST reproduce the dedicated push/fold engine's ranges. We assert this at a depth
 * where the tree provably collapses, then sanity-check the 8bb case stays jam-heavy.
 */
describe('short-stack parity with push/fold engine', () => {
  function sbAllinFrac(stack: number): number {
    const tree = solvePreflopTree(cfg(stack), equity, 1500);
    const root = tree.nodes.find((n) => n.label === 'SB Open')!;
    const allinIdx = root.actionLabels.findIndex((l) => l.startsWith('All-in'));
    let jam = 0;
    let totalW = 0;
    for (let k = 0; k < 169; k++) {
      const w = CLASS_WEIGHTS[k];
      totalW += w;
      jam += w * (allinIdx >= 0 ? root.strategy[k][allinIdx] : 0);
    }
    return jam / totalW;
  }

  function bbCallAllinFrac(stack: number): number {
    const tree = solvePreflopTree(cfg(stack), equity, 1500);
    // At collapsed depth the only SB non-fold action is All-in -> BB vs Open node has
    // Fold / Call / (3bet->allin) / (allin). BB "calls or jams" = does not fold.
    const bb = tree.nodes.find((n) => n.label === 'BB vs Open')!;
    const foldIdx = bb.actionLabels.findIndex((l) => l.startsWith('Fold'));
    let call = 0;
    let totalW = 0;
    for (let k = 0; k < 169; k++) {
      const w = CLASS_WEIGHTS[k];
      totalW += w;
      call += w * (1 - bb.strategy[k][foldIdx]);
    }
    return call / totalW;
  }

  it('at 2bb (open clamps to all-in) the tree reproduces push/fold ranges', () => {
    const stack = 2;
    const treeJam = sbAllinFrac(stack);
    const treeBbCall = bbCallAllinFrac(stack);
    const pf = solvePushFold(stack, equity, 600);
    // SB jam range and BB calling range should closely match push/fold.
    expect(Math.abs(treeJam - pf.sbJamFraction)).toBeLessThan(0.05);
    expect(Math.abs(treeBbCall - pf.bbCallFraction)).toBeLessThan(0.08);
  });

  it('at 8bb the SB is jam-heavy (a large fraction goes all-in)', () => {
    // 8bb still permits a 2.5x open, so it is not pure jam/fold, but a big chunk of
    // the SB range should still commit all-in — directionally like push/fold.
    const jam = sbAllinFrac(8);
    expect(jam).toBeGreaterThan(0.1);
  });
});
