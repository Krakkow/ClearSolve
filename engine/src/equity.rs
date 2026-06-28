//! All-in preflop equity — exact port of `src/domain/equity.ts` + `equityMatrix.ts`.
//! Produces a bit-identical 169x169 matrix to the TS engine for the same (samples,
//! seed), so it's a true drop-in (the CFR results are unchanged).

use crate::evaluator::evaluate7;
use crate::rng::Rng;

const N: usize = 169;

/// classIndex -> (high id-rank, low id-rank, kind) where id-rank 0=2 .. 12=A and
/// kind 0=pair, 1=suited, 2=offsuit. Mirrors handClasses.ts (row/col over A..2 high->low)
/// combined with rankIndex (id-order) => idRank = 12 - highToLowIndex.
fn class_ranks(index: usize) -> (u32, u32, u8) {
    let row = (index / 13) as i32;
    let col = (index % 13) as i32;
    if row == col {
        let h = (12 - row) as u32;
        (h, h, 0)
    } else if col > row {
        ((12 - row) as u32, (12 - col) as u32, 1)
    } else {
        ((12 - col) as u32, (12 - row) as u32, 2)
    }
}

/// Concrete 2-card combos for a class — same enumeration order as combos.ts.
fn class_combos(index: usize) -> Vec<[u32; 2]> {
    let (high, low, kind) = class_ranks(index);
    let mut out = Vec::with_capacity(12);
    match kind {
        0 => {
            for s1 in 0..4u32 {
                for s2 in (s1 + 1)..4u32 {
                    out.push([high * 4 + s1, high * 4 + s2]);
                }
            }
        }
        1 => {
            for s in 0..4u32 {
                out.push([high * 4 + s, low * 4 + s]);
            }
        }
        _ => {
            for s1 in 0..4u32 {
                for s2 in 0..4u32 {
                    if s1 != s2 {
                        out.push([high * 4 + s1, low * 4 + s2]);
                    }
                }
            }
        }
    }
    out
}

/// Equity of class `hero` vs class `vill`, all-in preflop (round-robin over combo pairings).
fn class_vs_class(hero: usize, vill: usize, samples: usize, seed: u32) -> f64 {
    let hero_combos = class_combos(hero);
    let vill_combos = class_combos(vill);
    let mut rng = Rng::new(seed);

    let mut valid: Vec<([u32; 2], [u32; 2])> = Vec::new();
    for &h in &hero_combos {
        for &v in &vill_combos {
            if h[0] == v[0] || h[0] == v[1] || h[1] == v[0] || h[1] == v[1] {
                continue;
            }
            valid.push((h, v));
        }
    }
    if valid.is_empty() {
        return 0.5;
    }
    let np = valid.len();
    let mut win = 0u32;
    let mut tie = 0u32;
    let mut deck = [0u32; 52];

    for s in 0..samples {
        let (hero_c, vill_c) = valid[s % np];
        let mut di = 0usize;
        for i in 0..52u32 {
            if i == hero_c[0] || i == hero_c[1] || i == vill_c[0] || i == vill_c[1] {
                continue;
            }
            deck[di] = i;
            di += 1;
        }
        let mut board = [0u32; 5];
        for k in 0..5 {
            let j = k + rng.next_int(di - k);
            deck.swap(k, j);
            board[k] = deck[k];
        }
        let hs = evaluate7([hero_c[0], hero_c[1], board[0], board[1], board[2], board[3], board[4]]);
        let vs = evaluate7([vill_c[0], vill_c[1], board[0], board[1], board[2], board[3], board[4]]);
        if hs > vs {
            win += 1;
        } else if hs == vs {
            tie += 1;
        }
    }
    (win as f64 + 0.5 * tie as f64) / samples as f64
}

/// Fill `m` (length 169*169) with the class-vs-class equity matrix. Upper triangle is
/// computed; the lower triangle uses the complement (1 - eq), matching equityMatrix.ts.
pub fn build(m: &mut [f64], samples: usize, seed: u32) {
    for i in 0..N {
        for j in i..N {
            let pair_seed = seed
                ^ (i as u32).wrapping_mul(73856093)
                ^ (j as u32).wrapping_mul(19349663);
            let eq = class_vs_class(i, j, samples, pair_seed);
            m[i * N + j] = eq;
            if i != j {
                m[j * N + i] = 1.0 - eq;
            }
        }
    }
}
