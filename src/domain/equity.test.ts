import { describe, it, expect } from 'vitest';
import { classVsClassEquity, comboVsComboEquity } from './equity';
import { HAND_CLASSES } from './handClasses';
import { makeRng } from './rng';
import { cardId } from './cards';
import type { Card, Rank, Suit } from './cards';
import type { Combo } from './combos';

function classIndexByLabel(label: string): number {
  const hc = HAND_CLASSES.find((h) => h.label === label);
  if (!hc) throw new Error(`no class ${label}`);
  return hc.index;
}

function combo(r1: Rank, s1: Suit, r2: Rank, s2: Suit): Combo {
  return [cardId({ rank: r1, suit: s1 } as Card), cardId({ rank: r2, suit: s2 } as Card)];
}

const SAMPLES = 20000;

describe('comboVsComboEquity (known matchups)', () => {
  it('AA vs KK ~ 82% (within MC tolerance)', () => {
    const aa = combo('A', 's', 'A', 'h');
    const kk = combo('K', 's', 'K', 'h');
    const eq = comboVsComboEquity(aa, kk, SAMPLES, makeRng(42));
    expect(eq).toBeGreaterThan(0.79);
    expect(eq).toBeLessThan(0.85);
  });

  it('AKs vs 22 ~ coinflip (within MC tolerance)', () => {
    const aks = combo('A', 's', 'K', 's');
    const pair22 = combo('2', 'h', '2', 'd');
    const eq = comboVsComboEquity(aks, pair22, SAMPLES, makeRng(7));
    expect(eq).toBeGreaterThan(0.45);
    expect(eq).toBeLessThan(0.55);
  });

  it('a hand has ~50% equity against an identical-strength mirror (AKo vs AKo)', () => {
    const a = combo('A', 's', 'K', 'h');
    const b = combo('A', 'd', 'K', 'c');
    const eq = comboVsComboEquity(a, b, SAMPLES, makeRng(99));
    expect(eq).toBeGreaterThan(0.45);
    expect(eq).toBeLessThan(0.55);
  });
});

describe('classVsClassEquity', () => {
  it('AA dominates 72o', () => {
    const aa = classIndexByLabel('AA');
    const t72o = classIndexByLabel('72o');
    const eq = classVsClassEquity(aa, t72o, 4000, 123);
    expect(eq).toBeGreaterThan(0.85);
  });

  it('is deterministic for a fixed seed', () => {
    const aks = classIndexByLabel('AKs');
    const qq = classIndexByLabel('QQ');
    const a = classVsClassEquity(aks, qq, 3000, 555);
    const b = classVsClassEquity(aks, qq, 3000, 555);
    expect(a).toBe(b);
  });
});
