import { describe, it, expect } from 'vitest';
import { buildEquityMatrix } from './equityMatrix';
import { solvePushFold } from './pushfold';

// Build the equity matrix once for the whole suite (it is stack-independent).
// A modest sample count keeps the test fast while preserving threshold realism.
const SAMPLES = 300;
const SEED = 1337;
const equity = buildEquityMatrix(SAMPLES, SEED);

describe('push/fold equilibrium realism', () => {
  it('SB jams nearly any-two at 1bb', () => {
    const r = solvePushFold(1, equity, 600);
    expect(r.sbJamFraction).toBeGreaterThan(0.9);
  });

  it('SB jams a wide range at 10bb and BB calls tighter', () => {
    const r = solvePushFold(10, equity, 600);
    // At 10bb the SB jam range is wide (well over half of all hands).
    expect(r.sbJamFraction).toBeGreaterThan(0.5);
    // BB calls a meaningful but tighter range than SB jams.
    expect(r.bbCallFraction).toBeGreaterThan(0.1);
    expect(r.bbCallFraction).toBeLessThan(r.sbJamFraction);
  });

  it('SB jam range shrinks as stacks get deeper (10bb vs 20bb)', () => {
    const r10 = solvePushFold(10, equity, 600);
    const r20 = solvePushFold(20, equity, 600);
    expect(r20.sbJamFraction).toBeLessThan(r10.sbJamFraction);
  });

  it('converges to low exploitability', () => {
    const r = solvePushFold(10, equity, 800);
    // Equilibrium best-response gain should be small (bb/game).
    expect(r.exploitabilityBbPerGame).toBeLessThan(0.02);
  });
});

describe('push/fold determinism', () => {
  it('same inputs -> identical strategy output', () => {
    const a = solvePushFold(12, equity, 500);
    const b = solvePushFold(12, equity, 500);
    expect(Array.from(a.sbJam)).toEqual(Array.from(b.sbJam));
    expect(Array.from(a.bbCall)).toEqual(Array.from(b.bbCall));
    expect(a.exploitabilityBbPerGame).toBe(b.exploitabilityBbPerGame);
  });

  it('equity matrix is reproducible from a seed', () => {
    const m1 = buildEquityMatrix(60, 2024);
    const m2 = buildEquityMatrix(60, 2024);
    expect(Array.from(m1)).toEqual(Array.from(m2));
  });
});
