import { describe, it, expect } from 'vitest';
import { projectToBetTreeConfig, upgradeHuSpot, defaultBetSizing } from './projectSpot';
import type { SpotConfigV2 } from './spotV2';

function baseSpot(over: Partial<SpotConfigV2> = {}): SpotConfigV2 {
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

describe('projectToBetTreeConfig', () => {
  it('maps blinds + stack + sizes into the 2-player config', () => {
    const p = projectToBetTreeConfig(baseSpot());
    expect(p.config.smallBlind).toBe(0.5);
    expect(p.config.stack).toBe(100);
    expect(p.config.openTo).toBe(2.5);
    expect(p.config.threeBetTo).toBe(11);
    expect(p.config.fourBetTo).toBe(24);
  });

  it('RFI (depth 0) -> hero is the aggressor, "SB Open" node', () => {
    const p = projectToBetTreeConfig(baseSpot({ betContext: { priorActions: [], raiseDepth: 0 } }));
    expect(p.heroSide).toBe('aggressor');
    expect(p.heroRaiseDepth).toBe(0);
    expect(p.heroNodeLabel).toBe('SB Open');
  });

  it('facing a raise (depth 1) -> hero is the responder, "BB vs Open" node', () => {
    const p = projectToBetTreeConfig(
      baseSpot({
        heroPosition: 'BB',
        betContext: {
          priorActions: [{ seatIndex: 5, kind: 'raise', toBb: 2.5 }],
          raiseDepth: 1,
        },
      }),
    );
    expect(p.heroSide).toBe('responder');
    expect(p.heroRaiseDepth).toBe(1);
    expect(p.heroNodeLabel).toBe('BB vs Open');
  });

  it('multiway non-blind RFI adds dead-money (SB blind) to the field', () => {
    // 6-max BTN RFI: the SB's 0.5 is dead money in the open-vs-field pot.
    const p = projectToBetTreeConfig(baseSpot({ tableSize: 6, heroPosition: 'BTN' }));
    expect(p.deadMoneyBb).toBeCloseTo(0.5, 9);
    expect(p.config.bigBlind).toBeCloseTo(1.5, 9);
  });

  it('antes add to the dead money across the table', () => {
    const p = projectToBetTreeConfig(
      baseSpot({ tableSize: 6, heroPosition: 'BTN', stakes: { smallBlindBb: 0.5, bigBlindBb: 1.0, anteBb: 0.1 } }),
    );
    // 6 players * 0.1 ante + SB 0.5 dead = 1.1
    expect(p.deadMoneyBb).toBeCloseTo(0.6 + 0.5, 9);
  });

  it('HU (tableSize 2) adds NO dead money — reproduces the v1 1.0 big blind', () => {
    const p = projectToBetTreeConfig(baseSpot({ tableSize: 2, heroPosition: 'SB' }));
    expect(p.deadMoneyBb).toBe(0);
    expect(p.config.bigBlind).toBe(1.0);
  });

  it('rejects tournament mode in E1', () => {
    expect(() => projectToBetTreeConfig(baseSpot({ gameMode: 'tournament' }))).toThrow();
  });
});

describe('upgradeHuSpot', () => {
  it('produces a tableSize:2 SB RFI cash spot equivalent to the HU bet-tree', () => {
    const v2 = upgradeHuSpot({ effectiveStackBb: 100 });
    expect(v2.tableSize).toBe(2);
    expect(v2.heroPosition).toBe('SB');
    expect(v2.gameMode).toBe('cash');
    expect(v2.betContext.raiseDepth).toBe(0);
    expect(v2.effectiveStackBb).toBe(100);

    // Projecting it yields the SAME BetTreeConfig the v1 bet-tree used (0.5/1.0, 2.5/11/24).
    const p = projectToBetTreeConfig(v2);
    expect(p.config).toMatchObject({
      smallBlind: 0.5,
      bigBlind: 1.0,
      stack: 100,
      openTo: defaultBetSizing().openTo,
      threeBetTo: defaultBetSizing().threeBetTo,
      fourBetTo: defaultBetSizing().fourBetTo,
    });
  });
});
