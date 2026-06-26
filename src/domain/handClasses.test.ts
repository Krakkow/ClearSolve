import { describe, it, expect } from 'vitest';
import { HAND_CLASSES } from './handClasses';

describe('169 hand classes / grid layout', () => {
  it('has exactly 169 classes', () => {
    expect(HAND_CLASSES).toHaveLength(169);
  });

  it('places pairs on the diagonal', () => {
    expect(HAND_CLASSES[0].label).toBe('AA'); // [0][0]
    expect(HAND_CLASSES[14].label).toBe('KK'); // [1][1]
    expect(HAND_CLASSES[168].label).toBe('22'); // [12][12]
  });

  it('suited in the upper-right, offsuit in the lower-left', () => {
    expect(HAND_CLASSES[1].label).toBe('AKs'); // [0][1]
    expect(HAND_CLASSES[13].label).toBe('AKo'); // [1][0]
  });

  it('combo counts: pair=6, suited=4, offsuit=12', () => {
    const aa = HAND_CLASSES.find((h) => h.label === 'AA')!;
    const aks = HAND_CLASSES.find((h) => h.label === 'AKs')!;
    const ako = HAND_CLASSES.find((h) => h.label === 'AKo')!;
    expect(aa.comboCount).toBe(6);
    expect(aks.comboCount).toBe(4);
    expect(ako.comboCount).toBe(12);
  });

  it('total combos sum to 1326', () => {
    const total = HAND_CLASSES.reduce((s, h) => s + h.comboCount, 0);
    expect(total).toBe(1326);
  });
});
