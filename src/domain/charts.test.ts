import { describe, it, expect } from 'vitest';
import { lookupChart, chartToResult } from './charts';
import { preflopActionOrder, seatIndexOf } from './seatLayout';
import type { PriorAction, SpotConfigV2, TableSize, SeatPosition } from './spotV2';

function foldToHero(tableSize: TableSize, hero: SeatPosition, stackBb = 100): SpotConfigV2 {
  const order = preflopActionOrder(tableSize);
  const heroIdx = order.indexOf(seatIndexOf(tableSize, hero));
  const priorActions: PriorAction[] = order
    .slice(0, heroIdx)
    .map((si) => ({ seatIndex: si, kind: 'fold' as const }));
  return {
    schemaVersion: 2, gameType: 'NLHE', gameMode: 'cash', tableSize, heroPosition: hero,
    stakes: { smallBlindBb: 0.5, bigBlindBb: 1 }, effectiveStackBb: stackBb,
    betContext: { priorActions, raiseDepth: 0 },
    betSizing: { id: 'd', label: 'd', openTo: 2.5, threeBetTo: 11, fourBetTo: 24 },
  };
}

const openFreq = (s: SpotConfigV2) => {
  const c = lookupChart(s);
  if (!c) return null;
  return c.heroNode.nodeActionFreq['raise-small'] ?? 0;
};

describe('predefined RFI charts (E4)', () => {
  it('serves a chart for cash ~100bb fold-to-hero RFI (6-max + 9-max)', () => {
    expect(lookupChart(foldToHero(6, 'BTN'))).not.toBeNull();
    expect(lookupChart(foldToHero(9, 'UTG'))).not.toBeNull();
  });

  it('chartToResult is labeled predefined and never claims exact GTO', () => {
    const s = foldToHero(6, 'CO');
    const res = chartToResult(s, lookupChart(s)!);
    expect(res.source).toBe('predefined');
    expect(res.trust.label).toBe('predefined');
    expect(res.trust.exploitability).toBeUndefined();
    expect(res.trust.caption.toLowerCase()).not.toContain('exact gto');
    // pure chart: each hand's freqs sum to 1 over fold/raise.
    for (const h of res.heroNode.hands) {
      const sum = (h.freqs.fold ?? 0) + (h.freqs['raise-small'] ?? 0);
      expect(sum).toBeCloseTo(1, 9);
    }
  });

  it('open width increases from early position to the button', () => {
    const utg = openFreq(foldToHero(9, 'UTG'))!;
    const co = openFreq(foldToHero(9, 'CO'))!;
    const btn = openFreq(foldToHero(9, 'BTN'))!;
    expect(utg).toBeLessThan(co);
    expect(co).toBeLessThan(btn);
  });

  it('serves a blind-defense chart (BB/SB vs a single open) with fold/call/3-bet', () => {
    // 6-max: folds to BTN, BTN opens 2.5, hero BB.
    const s = foldToHero(6, 'BB');
    s.betContext = {
      priorActions: [
        { seatIndex: 2, kind: 'fold' },
        { seatIndex: 3, kind: 'fold' },
        { seatIndex: 4, kind: 'fold' },
        { seatIndex: 5, kind: 'raise', toBb: 2.5 },
        { seatIndex: 0, kind: 'fold' },
      ],
      raiseDepth: 1,
    };
    const chart = lookupChart(s);
    expect(chart).not.toBeNull();
    const res = chartToResult(s, chart!);
    expect(res.trust.label).toBe('predefined');
    expect(res.heroNode.actionLabels).toContain('call');
    expect(res.heroNode.actionLabels).toContain('3bet');
    for (const h of res.heroNode.hands) {
      const sum = (h.freqs.fold ?? 0) + (h.freqs.call ?? 0) + (h.freqs['raise-small'] ?? 0);
      expect(sum).toBeCloseTo(1, 9);
    }
    // BB defends wider vs a late open than the SB does (SB is OOP and tighter).
    const sbSpot = foldToHero(6, 'SB');
    sbSpot.betContext = {
      priorActions: [
        { seatIndex: 2, kind: 'fold' },
        { seatIndex: 3, kind: 'fold' },
        { seatIndex: 4, kind: 'fold' },
        { seatIndex: 5, kind: 'raise', toBb: 2.5 },
      ],
      raiseDepth: 1,
    };
    const bbDefend = 1 - (res.heroNode.nodeActionFreq.fold ?? 0);
    const sbChart = lookupChart(sbSpot)!;
    const sbDefend = 1 - (sbChart.heroNode.nodeActionFreq.fold ?? 0);
    expect(bbDefend).toBeGreaterThan(sbDefend);
  });

  // helper: hero facing a single open from `opener` (folds elsewhere).
  function vsOpen(tableSize: TableSize, hero: SeatPosition, opener: SeatPosition): SpotConfigV2 {
    const order = preflopActionOrder(tableSize);
    const heroSeat = seatIndexOf(tableSize, hero);
    const openerSeat = seatIndexOf(tableSize, opener);
    const heroIdx = order.indexOf(heroSeat);
    const priorActions: PriorAction[] = order.slice(0, heroIdx).map((si) =>
      si === openerSeat
        ? { seatIndex: si, kind: 'raise' as const, toBb: 2.5 }
        : { seatIndex: si, kind: 'fold' as const },
    );
    const s = foldToHero(tableSize, hero);
    s.betContext = { priorActions, raiseDepth: 1 };
    return s;
  }
  const defendPct = (s: SpotConfigV2) => {
    const c = lookupChart(s);
    return c ? 1 - (c.heroNode.nodeActionFreq.fold ?? 0) : null;
  };

  it('BB defends wider vs a BTN open than vs a CO open (CO/BTN split)', () => {
    const vsCo = defendPct(vsOpen(6, 'BB', 'CO'))!;
    const vsBtn = defendPct(vsOpen(6, 'BB', 'BTN'))!;
    expect(vsBtn).toBeGreaterThan(vsCo);
  });

  it('serves an in-position vs-open chart for a non-blind hero (fold/call/3-bet)', () => {
    const coVsUtg = lookupChart(vsOpen(9, 'CO', 'UTG'));
    expect(coVsUtg).not.toBeNull();
    expect(coVsUtg!.heroNode.actionLabels).toContain('call');
    expect(coVsUtg!.heroNode.actionLabels).toContain('3bet');
    // The BB (closing, with odds) defends wider than an in-position seat vs the same open.
    // (v1: IP defenders share a chart by opener tier; per-defender-position is future.)
    const ip = defendPct(vsOpen(9, 'CO', 'UTG'))!;
    const bb = defendPct(vsOpen(9, 'BB', 'UTG'))!;
    expect(bb).toBeGreaterThan(ip);
  });

  it('misses (-> live fallback) for off-grid depth, facing action, BB, and custom ranges', () => {
    expect(lookupChart(foldToHero(6, 'BTN', 40))).toBeNull(); // wrong depth bucket
    expect(lookupChart(foldToHero(6, 'BB'))).toBeNull(); // BB has no RFI
    // facing a 3-bet (raiseDepth 2) is not charted yet -> live fallback:
    const vs3bet = foldToHero(6, 'BB');
    vs3bet.betContext = {
      priorActions: [
        { seatIndex: 5, kind: 'raise', toBb: 2.5 },
        { seatIndex: 0, kind: 'raise', toBb: 11 },
      ],
      raiseDepth: 2,
    };
    expect(lookupChart(vs3bet)).toBeNull();
    // a custom range override anywhere -> skip the chart (user customized the spot):
    const custom = foldToHero(6, 'BTN');
    custom.betContext.priorActions[0] = { ...custom.betContext.priorActions[0], range: new Array(169).fill(1) };
    expect(lookupChart(custom)).toBeNull();
  });
});
