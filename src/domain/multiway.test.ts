import { describe, it, expect } from 'vitest';
import { classStrength, skewByField, classPlayability, penalizeHeroRealization } from './multiway';
import { buildEquityMatrix } from './equityMatrix';
import { fullRange } from './range169';
import { HAND_CLASSES } from './handClasses';

const idx = (label: string) => HAND_CLASSES.findIndex((h) => h.label === label);

describe('multiway field model', () => {
  const equity = buildEquityMatrix(300, 1337);
  const strength = classStrength(equity);

  it('classStrength ranks premiums above trash and stays in [0,1]', () => {
    for (const s of strength) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
    expect(strength[idx('AA')]).toBeGreaterThan(strength[idx('KK')]);
    expect(strength[idx('KK')]).toBeGreaterThan(strength[idx('72o')]);
    expect(strength[idx('AKs')]).toBeGreaterThan(strength[idx('A2o')]);
  });

  it('skewByField is a no-op heads-up (fieldSize <= 1)', () => {
    const r = fullRange();
    expect(skewByField(r, strength, 1, 4)).toBe(r); // same reference, unchanged
  });

  it('skewByField down-weights trash relative to premiums as the field grows', () => {
    const r = fullRange(); // every class weight = 1
    const sk = skewByField(r, strength, 3, 4); // 3-way
    // Premium keeps far more of its weight than trash.
    expect(sk[idx('AA')]).toBeGreaterThan(sk[idx('72o')]);
    // The RATIO trash:premium collapses hard (best-of-N concentration).
    const ratio = sk[idx('72o')] / sk[idx('AA')];
    expect(ratio).toBeLessThan(0.1);
    // Bigger field => even more concentration (trash:premium ratio shrinks further).
    const sk4 = skewByField(r, strength, 4, 4);
    expect(sk4[idx('72o')] / sk4[idx('AA')]).toBeLessThan(ratio);
  });

  it('classPlayability: pairs full; playable suited > weak suited; in [0,1]', () => {
    const p = classPlayability();
    for (const v of p) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(p[idx('AA')]).toBe(1);
    expect(p[idx('22')]).toBe(1);
    // connected/high suited realizes better than low disconnected suited.
    expect(p[idx('T9s')]).toBeGreaterThan(p[idx('J2s')]);
    expect(p[idx('87s')]).toBeGreaterThan(p[idx('84s')]);
  });

  it('penalizeHeroRealization shifts weak hero hands toward the SB, leaves premiums alone', () => {
    const p = classPlayability();
    const adj = penalizeHeroRealization(equity, p, 0.05);
    const j2s = idx('J2s');
    const aa = idx('AA');
    // a weak BB hand (column j) gets a positive shift in SB equity for every SB row i...
    expect(adj[0 * 169 + j2s]).toBeGreaterThan(equity[0 * 169 + j2s]);
    // ...while a full-playability hand (pair) column is unchanged.
    expect(adj[0 * 169 + aa]).toBeCloseTo(equity[0 * 169 + aa], 12);
    // k=0 is a no-op (same reference).
    expect(penalizeHeroRealization(equity, p, 0)).toBe(equity);
  });
});
