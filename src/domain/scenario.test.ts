import { describe, it, expect } from 'vitest';
import { projectToBetTreeConfig, defaultRangeForSeat, openRealizationEdge } from './projectSpot';
import { buildTrustInfo } from '../engine/resultV2';
import { rangeComboFraction } from './range169';
import type { PriorAction, SpotConfigV2 } from './spotV2';

// 6-max seat indices: SB=0, BB=1, UTG=2, HJ=3, CO=4, BTN=5.
function spot(over: Partial<SpotConfigV2>, priorActions: PriorAction[], raiseDepth: number): SpotConfigV2 {
  return {
    schemaVersion: 2,
    gameType: 'NLHE',
    gameMode: 'cash',
    tableSize: 6,
    heroPosition: 'BTN',
    stakes: { smallBlindBb: 0.5, bigBlindBb: 1 },
    effectiveStackBb: 100,
    betContext: { priorActions, raiseDepth },
    betSizing: { id: 'd', label: 'd', openTo: 2.5, threeBetTo: 11, fourBetTo: 24 },
    ...over,
  };
}

describe('scenario projection — composite opponent + dead money + live-opp count', () => {
  it('pure RFI (no prior action): full-range field, no composite, not assumed', () => {
    const p = projectToBetTreeConfig(spot({ tableSize: 6, heroPosition: 'BTN' }, [], 0));
    expect(p.oppRangeWeights).toBeUndefined();
    expect(p.assumedRanges).toBe(false);
    // BTN with SB+BB+nobody-acted-yet... priorActions empty => 5 seats still live.
    expect(p.liveOppCount).toBe(5);
  });

  it('folds to a single BTN raiser, hero in BB: 1 live opp, assumed composite range', () => {
    // action order before BB: UTG fold, HJ fold, CO fold, BTN raise 2.5, SB fold.
    const pa: PriorAction[] = [
      { seatIndex: 2, kind: 'fold' },
      { seatIndex: 3, kind: 'fold' },
      { seatIndex: 4, kind: 'fold' },
      { seatIndex: 5, kind: 'raise', toBb: 2.5 },
      { seatIndex: 0, kind: 'fold' },
    ];
    const p = projectToBetTreeConfig(spot({ heroPosition: 'BB' }, pa, 1));
    expect(p.oppRangeWeights).toBeDefined();
    expect(p.assumedRanges).toBe(true);
    expect(p.liveOppCount).toBe(1); // only the raiser; nobody left to act behind BB
    expect(p.oppSide).toBe(0); // hero is the responder (BB-side); opponent on SB-side
    // the composite is the BTN open range -> a wide but not full range.
    const frac = rangeComboFraction(p.oppRangeWeights!);
    expect(frac).toBeGreaterThan(0.2);
    expect(frac).toBeLessThan(1);
    // the scenario's actual open size flows into the tree config.
    expect(p.config.openTo).toBeCloseTo(2.5, 6);
  });

  it('squeeze (UTG raise, CO call, hero BTN): >=2 live opps, caller chips are dead money', () => {
    const pa: PriorAction[] = [
      { seatIndex: 2, kind: 'raise', toBb: 2.5 }, // UTG open
      { seatIndex: 3, kind: 'fold' }, // HJ
      { seatIndex: 4, kind: 'call' }, // CO call
    ];
    const p = projectToBetTreeConfig(spot({ heroPosition: 'BTN' }, pa, 1));
    expect(p.oppRangeWeights).toBeDefined();
    // 2 in-pot opponents (UTG, CO) + SB,BB still to act = 4.
    expect(p.liveOppCount).toBe(4);
    // CO's called 2.5 becomes dead money (the modeled opponent = the UTG raiser);
    // plus the un-modeled SB blind (0.5) since BTN is not a blind.
    expect(p.deadMoneyBb).toBeCloseTo(0.5 + 2.5, 6);
  });

  it('a per-actor range OVERRIDE flows into the composite (range editor)', () => {
    // BTN raises with an override range of ONLY AA (class 0); folds elsewhere; hero BB.
    const aaOnly = new Array(169).fill(0);
    aaOnly[0] = 1; // AA
    const pa: PriorAction[] = [
      { seatIndex: 2, kind: 'fold' },
      { seatIndex: 3, kind: 'fold' },
      { seatIndex: 4, kind: 'fold' },
      { seatIndex: 5, kind: 'raise', toBb: 2.5, range: aaOnly },
      { seatIndex: 0, kind: 'fold' },
    ];
    const p = projectToBetTreeConfig(spot({ heroPosition: 'BB' }, pa, 1));
    expect(p.oppRangeWeights).toBeDefined();
    expect(p.oppRangeWeights![0]).toBeCloseTo(1, 6); // AA present
    let nonAa = 0;
    for (let i = 1; i < 169; i++) nonAa += p.oppRangeWeights![i];
    expect(nonAa).toBeCloseTo(0, 6); // nothing else
  });

  it('defaultRangeForSeat returns a range for a raiser and null for a folder', () => {
    const pa: PriorAction[] = [
      { seatIndex: 2, kind: 'raise', toBb: 2.5 }, // UTG open
      { seatIndex: 3, kind: 'fold' },
    ];
    const s = spot({ heroPosition: 'BTN' }, pa, 1);
    const utg = defaultRangeForSeat(s, 2);
    expect(utg).not.toBeNull();
    expect(rangeComboFraction(utg!)).toBeGreaterThan(0);
    expect(rangeComboFraction(utg!)).toBeLessThan(0.5); // UTG opens tight
    expect(defaultRangeForSeat(s, 3)).toBeNull(); // folder has no range
  });

  it('open realization edge decreases monotonically with players behind', () => {
    for (let b = 1; b <= 7; b++) {
      expect(openRealizationEdge(b)).toBeGreaterThan(openRealizationEdge(b + 1));
    }
  });

  it('facing a 3-bet, hero is a RESPONDER (not the "opener at a deeper layer")', () => {
    // 9-max BB; UTG opens 2.5, CO 3-bets to 11, folds elsewhere. Hero (BB) did NOT open.
    const pa: PriorAction[] = [
      { seatIndex: 2, kind: 'raise', toBb: 2.5 }, // UTG (9-max seat 2)
      { seatIndex: 3, kind: 'fold' },
      { seatIndex: 4, kind: 'fold' },
      { seatIndex: 5, kind: 'fold' },
      { seatIndex: 6, kind: 'fold' },
      { seatIndex: 7, kind: 'raise', toBb: 11 }, // CO (seat 7) 3-bets
      { seatIndex: 8, kind: 'fold' },
      { seatIndex: 0, kind: 'fold' },
    ];
    const p = projectToBetTreeConfig(spot({ tableSize: 9, heroPosition: 'BB' }, pa, 2));
    expect(p.heroSide).toBe('responder'); // regression: was 'aggressor' (depth-parity bug)
    expect(p.heroNodeLabel).toBe('BB vs Open'); // structural responder node
    // hero responds to the 11 bet: tree's "open" is the faced bet, raise ladder shifts up.
    expect(p.config.openTo).toBeCloseTo(11, 6);
    expect(p.config.threeBetTo).toBeCloseTo(24, 6); // hero's raise is a 4-bet sizing
  });

  it('an opener facing a 3-bet is also a responder (symmetric fix)', () => {
    // CO opens 2.5, BTN 3-bets 11; hero is the CO opener.
    const pa: PriorAction[] = [
      { seatIndex: 7, kind: 'raise', toBb: 2.5 }, // hero CO opens
      { seatIndex: 8, kind: 'raise', toBb: 11 }, // BTN 3-bets
    ];
    const p = projectToBetTreeConfig(spot({ tableSize: 9, heroPosition: 'CO' }, pa, 2));
    expect(p.heroSide).toBe('responder');
    expect(p.heroNodeLabel).toBe('BB vs Open');
  });

  it('trust label keys on live-opp count', () => {
    const one = buildTrustInfo(spot({}, [], 0), 0.01, { liveOppCount: 1, assumedRanges: true });
    expect(one.label).toBe('live-solve');
    expect(one.caption.toLowerCase()).toContain('assumed');

    const many = buildTrustInfo(spot({}, [], 0), 0.01, { liveOppCount: 4, assumedRanges: true });
    expect(many.label).toBe('estimate-composite');
    expect(many.caption.toLowerCase()).toContain('composite');
    expect(many.caption.toLowerCase()).not.toContain('exact gto');
  });
});
