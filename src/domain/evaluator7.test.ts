import { describe, it, expect } from 'vitest';
import { evaluate7 } from './evaluator7';
import { evaluateBest } from './evaluator';
import { makeRng } from './rng';

// Cross-validate the fast 7-card evaluator against the reference subset-enumeration
// evaluator (evaluateBest) on many random 7-card hands. They must return identical
// COMPARISON results (both use the same packed scoring), so we check that for many
// random pairs of hands, the two evaluators agree on which hand is better/tie.

function deal7(rng: ReturnType<typeof makeRng>): number[] {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let k = 0; k < 7; k++) {
    const j = k + rng.nextInt(deck.length - k);
    [deck[k], deck[j]] = [deck[j], deck[k]];
  }
  return deck.slice(0, 7);
}

describe('evaluate7 vs reference evaluateBest', () => {
  it('produces identical scores on random 7-card hands', () => {
    const rng = makeRng(2026);
    for (let i = 0; i < 50000; i++) {
      const h = deal7(rng);
      const fast = evaluate7(h[0], h[1], h[2], h[3], h[4], h[5], h[6]);
      const ref = evaluateBest(h);
      expect(fast).toBe(ref);
    }
  });

  it('agrees on ordering between two hands (exhaustive-ish random)', () => {
    const rng = makeRng(99);
    for (let i = 0; i < 20000; i++) {
      const a = deal7(rng);
      const b = deal7(rng);
      const fa = evaluate7(a[0], a[1], a[2], a[3], a[4], a[5], a[6]);
      const fb = evaluate7(b[0], b[1], b[2], b[3], b[4], b[5], b[6]);
      const ra = evaluateBest(a);
      const rb = evaluateBest(b);
      expect(Math.sign(fa - fb)).toBe(Math.sign(ra - rb));
    }
  });
});
