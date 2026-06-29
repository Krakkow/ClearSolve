import { describe, it, expect } from 'vitest';
import { PreflopEngine } from './preflopEngine';
import { upgradeHuSpot } from '../domain/projectSpot';
import type { SolveSettings, SolveRequest, SolveResultV2 } from './types';
import type { SpotConfigV2 } from '../domain/spotV2';

const settings: SolveSettings = {
  algorithm: 'cfr+',
  seed: 1337,
  iterations: 600,
  equitySamples: 250, // modest for test speed
};

const engine = new PreflopEngine();
const noop = () => {};

function spot(over: Partial<SpotConfigV2> = {}): SpotConfigV2 {
  return {
    schemaVersion: 2,
    gameType: 'NLHE',
    gameMode: 'cash',
    tableSize: 6,
    heroPosition: 'BTN',
    stakes: { smallBlindBb: 0.5, bigBlindBb: 1.0 },
    effectiveStackBb: 100,
    betContext: { priorActions: [], raiseDepth: 0 },
    betSizing: { id: 'd', label: 'd', openTo: 2.5, threeBetTo: 11, fourBetTo: 24 },
    ...over,
  };
}

async function solveSpot(s: SpotConfigV2): Promise<SolveResultV2> {
  const req: SolveRequest = { mode: 'preflop-spot', spot: s, settings };
  const res = await engine.solve(req, noop);
  if (res.mode !== 'preflop-spot') throw new Error('wrong mode');
  return res;
}

describe('preflop-spot E1 engine', () => {
  it('frequencies sum to 1 per hand over the new taxonomy at the hero node', async () => {
    const res = await solveSpot(spot());
    for (const h of res.heroNode.hands) {
      const sum = Object.values(h.freqs).reduce((s, x) => s + (x ?? 0), 0);
      expect(sum).toBeGreaterThan(0.999);
      expect(sum).toBeLessThan(1.001);
    }
    const nodeSum = Object.values(res.heroNode.nodeActionFreq).reduce((s, x) => s + (x ?? 0), 0);
    expect(nodeSum).toBeGreaterThan(0.999);
    expect(nodeSum).toBeLessThan(1.001);
  });

  it('HU (tableSize 2 SB) -> live-solve trust with exploitability; multiway -> honest estimate caption', async () => {
    const hu = await solveSpot(spot({ tableSize: 2, heroPosition: 'SB' }));
    expect(hu.trust.label).toBe('live-solve');
    expect(hu.trust.zeroSumValid).toBe(true);
    expect(hu.trust.exploitability).toBeDefined();
    expect(hu.trust.caption.toLowerCase()).toContain('heads-up');

    // 6-max RFI: hero contends with 5 players still to act -> a genuine multiway
    // estimate (field collapsed to one composite opponent).
    const mw = await solveSpot(spot({ tableSize: 6, heroPosition: 'BTN' }));
    expect(mw.trust.label).toBe('estimate-composite');
    expect(mw.trust.fieldModel).toBe('composite-field');
    expect(mw.trust.caption.toLowerCase()).toContain('estimate');
    expect(mw.trust.caption.toLowerCase()).toContain('composite');
  });

  it('NEVER renders the string "exact GTO" in any caption', async () => {
    const results = await Promise.all([
      solveSpot(spot({ tableSize: 2, heroPosition: 'SB' })),
      solveSpot(spot({ tableSize: 6, heroPosition: 'BTN' })),
      solveSpot(spot({ tableSize: 9, heroPosition: 'UTG' })),
    ]);
    for (const r of results) {
      expect(r.trust.caption.toLowerCase()).not.toContain('exact gto');
    }
  });

  it('RFI hero node labels: deep = fold/raise (no open-jam); short adds shove', async () => {
    const deep = await solveSpot(spot({ tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 100 }));
    expect(deep.heroNode.raiseDepth).toBe(0);
    expect(deep.heroNode.actionLabels).toContain('fold');
    expect(deep.heroNode.actionLabels).toContain('raise'); // open
    // Deep: open-jamming is removed as a bet-abstraction artifact -> no shove here.
    expect(deep.heroNode.actionLabels).not.toContain('shove');
    // Short: open-jam is a genuine action and renders via labelFor (depth 0) as 'shove'.
    const short = await solveSpot(spot({ tableSize: 6, heroPosition: 'BTN', effectiveStackBb: 12 }));
    expect(short.heroNode.actionLabels).toContain('shove');
  });

  it('upgradeHuSpot path == direct HU bet-tree (same SB open strategy)', async () => {
    // The generalized tableSize:2 SB RFI must reproduce the v1 bet-tree SB Open node.
    const viaUpgrade = await solveSpot(upgradeHuSpot({ effectiveStackBb: 100 }));
    const betTreeReq: SolveRequest = {
      mode: 'bet-tree',
      spot: {
        gameType: 'NLHE',
        players: 2,
        variant: 'preflop-bet-tree',
        effectiveStackBb: 100,
        smallBlindBb: 0.5,
        bigBlindBb: 1.0,
        positions: { sb: 'SB', bb: 'BB' },
        sizes: { openTo: 2.5, threeBetTo: 11, fourBetTo: 24 },
      },
      settings,
    };
    const betTreeRes = await engine.solve(betTreeReq, noop);
    if (betTreeRes.mode !== 'bet-tree') throw new Error('wrong mode');
    const sbOpen = betTreeRes.nodes.find((n) => n.label === 'SB Open')!;

    // Compare combo-agnostic per-class fold frequency of the SB Open node.
    // Both solves use the same seed/equity, so strategies must be identical.
    for (let k = 0; k < 169; k++) {
      const upFold = viaUpgrade.heroNode.hands[k].freqs.fold ?? 0;
      const foldIdx = sbOpen.actionLabels.findIndex((l) => l.startsWith('Fold'));
      const btFold = sbOpen.strategy[k][foldIdx];
      expect(Math.abs(upFold - btFold)).toBeLessThan(1e-9);
    }
  });
});
