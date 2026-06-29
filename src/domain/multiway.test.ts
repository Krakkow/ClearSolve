import { describe, it, expect } from 'vitest';
import { classStrength, skewByField } from './multiway';
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
});
