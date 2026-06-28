//! 7-card hand evaluator — a direct port of `src/domain/evaluator7.ts`.
//!
//! Card ids are 0..51 with `rank = id / 4` (0=2 .. 12=A) and `suit = id % 4`. Returns
//! the SAME packed score as the TS evaluator (category<<.. | kickers), so Rust and TS
//! scores are bit-identical for the same 7 cards — making cross-validation trivial.

const STRAIGHT_FLUSH: i32 = 8;
const QUADS: i32 = 7;
const FULL_HOUSE: i32 = 6;
const FLUSH: i32 = 5;
const STRAIGHT: i32 = 4;
const TRIPS: i32 = 3;
const TWO_PAIR: i32 = 2;
const PAIR: i32 = 1;
const HIGH_CARD: i32 = 0;

#[inline]
fn pack(category: i32, k0: i32, k1: i32, k2: i32, k3: i32, k4: i32) -> i32 {
    ((((category * 16 + k0) * 16 + k1) * 16 + k2) * 16 + k3) * 16 + k4
}

/// Highest top-rank of a 5-straight in `mask` (bit r = rank present), or -1. Handles
/// the wheel (A-2-3-4-5 -> returns rank 3 = '5').
fn straight_high(mask: i32) -> i32 {
    let mut high = 12;
    while high >= 4 {
        let window = 0b11111 << (high - 4);
        if mask & window == window {
            return high;
        }
        high -= 1;
    }
    let wheel = (1 << 12) | (1 << 3) | (1 << 2) | (1 << 1) | 1;
    if mask & wheel == wheel {
        return 3;
    }
    -1
}

/// Evaluate the best 5-card hand from exactly 7 card ids (0..51). Higher = better.
pub fn evaluate7(cards: [u32; 7]) -> i32 {
    let mut rank_count = [0i32; 13];
    let mut suit_count = [0i32; 4];
    let mut suit_rank_mask = [0i32; 4];
    let mut rank_mask = 0i32;
    for &id in &cards {
        let r = (id / 4) as usize;
        let s = (id % 4) as usize;
        rank_count[r] += 1;
        suit_count[s] += 1;
        suit_rank_mask[s] |= 1 << r;
        rank_mask |= 1 << r;
    }

    // Flush / straight-flush
    let mut flush_suit: i32 = -1;
    for s in 0..4 {
        if suit_count[s] >= 5 {
            flush_suit = s as i32;
            break;
        }
    }
    if flush_suit >= 0 {
        let sf = straight_high(suit_rank_mask[flush_suit as usize]);
        if sf >= 0 {
            return pack(STRAIGHT_FLUSH, sf, 0, 0, 0, 0);
        }
    }

    // Multiplicities, scanned high->low so the first found is highest.
    let mut quad = -1;
    let mut trip = -1;
    let mut trip2 = -1;
    let mut pair1 = -1;
    let mut pair2 = -1;
    for r in (0..13).rev() {
        match rank_count[r] {
            4 if quad < 0 => quad = r as i32,
            3 if trip < 0 => trip = r as i32,
            3 if trip2 < 0 => trip2 = r as i32,
            2 if pair1 < 0 => pair1 = r as i32,
            2 if pair2 < 0 => pair2 = r as i32,
            _ => {}
        }
    }

    // Quads
    if quad >= 0 {
        let mut kicker = -1;
        for r in (0..13).rev() {
            if r as i32 != quad && rank_count[r] > 0 {
                kicker = r as i32;
                break;
            }
        }
        return pack(QUADS, quad, kicker, 0, 0, 0);
    }

    // Full house (trips + pair, or two trips)
    if trip >= 0 {
        let mut pair_rank = -1;
        if trip2 >= 0 {
            pair_rank = trip2;
        }
        if pair1 > pair_rank {
            pair_rank = pair1;
        }
        if pair_rank >= 0 {
            return pack(FULL_HOUSE, trip, pair_rank, 0, 0, 0);
        }
    }

    // Flush (no straight flush)
    if flush_suit >= 0 {
        let m = suit_rank_mask[flush_suit as usize];
        let mut k = [-1i32; 5];
        let mut idx = 0;
        for r in (0..13).rev() {
            if idx == 5 {
                break;
            }
            if m & (1 << r) != 0 {
                k[idx] = r as i32;
                idx += 1;
            }
        }
        return pack(FLUSH, k[0], k[1], k[2], k[3], k[4]);
    }

    // Straight
    let sh = straight_high(rank_mask);
    if sh >= 0 {
        return pack(STRAIGHT, sh, 0, 0, 0, 0);
    }

    // Trips
    if trip >= 0 {
        let mut k = [-1i32; 2];
        let mut idx = 0;
        for r in (0..13).rev() {
            if r as i32 != trip && rank_count[r] > 0 {
                k[idx] = r as i32;
                idx += 1;
                if idx == 2 {
                    break;
                }
            }
        }
        return pack(TRIPS, trip, k[0], k[1], 0, 0);
    }

    // Two pair
    if pair1 >= 0 && pair2 >= 0 {
        let mut kicker = -1;
        for r in (0..13).rev() {
            let ri = r as i32;
            if ri != pair1 && ri != pair2 && rank_count[r] > 0 {
                kicker = ri;
                break;
            }
        }
        return pack(TWO_PAIR, pair1, pair2, kicker, 0, 0);
    }

    // One pair
    if pair1 >= 0 {
        let mut k = [-1i32; 3];
        let mut idx = 0;
        for r in (0..13).rev() {
            if r as i32 != pair1 && rank_count[r] > 0 {
                k[idx] = r as i32;
                idx += 1;
                if idx == 3 {
                    break;
                }
            }
        }
        return pack(PAIR, pair1, k[0], k[1], k[2], 0);
    }

    // High card: five highest ranks
    let mut k = [-1i32; 5];
    let mut idx = 0;
    for r in (0..13).rev() {
        if idx == 5 {
            break;
        }
        if rank_count[r] > 0 {
            k[idx] = r as i32;
            idx += 1;
        }
    }
    pack(HIGH_CARD, k[0], k[1], k[2], k[3], k[4])
}
