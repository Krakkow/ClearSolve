// Deterministic PRNG — mulberry32. Same seed -> identical stream (NFR-004).
// Small, fast, good enough for Monte Carlo equity sampling.

export interface Rng {
  /** next float in [0, 1). */
  next(): number;
  /** next integer in [0, n). */
  nextInt(n: number): number;
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    nextInt: (n: number) => Math.floor(next() * n),
  };
}
