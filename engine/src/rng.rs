//! mulberry32 PRNG — an exact port of `src/domain/rng.ts` (bit-identical stream for
//! the same seed). Math.imul maps to u32 `wrapping_mul`; JS `>>>` to logical `>>`.

pub struct Rng {
    a: u32,
}

impl Rng {
    #[inline]
    pub fn new(seed: u32) -> Self {
        Rng { a: seed }
    }

    /// Next f64 in [0, 1).
    #[inline]
    pub fn next_f64(&mut self) -> f64 {
        self.a = self.a.wrapping_add(0x6d2b79f5);
        let mut t = (self.a ^ (self.a >> 15)).wrapping_mul(1 | self.a);
        t = t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t)) ^ t;
        ((t ^ (t >> 14)) as f64) / 4294967296.0
    }

    /// Next integer in [0, n).
    #[inline]
    pub fn next_int(&mut self, n: usize) -> usize {
        (self.next_f64() * n as f64).floor() as usize
    }
}
