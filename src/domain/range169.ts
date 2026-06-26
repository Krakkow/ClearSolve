// Domain Core — a 169-class RANGE as a weight vector (each entry 0..1 = the fraction
// of that hand class included). Plus a compact parser for poker range notation so the
// default-range library (defaultRanges.ts) reads like standard charts.
//
// Notation supported (comma/space separated tokens):
//   "AA"            single pair
//   "AKs" / "AKo"   single suited / offsuit combo class
//   "77+"           pairs 77 and up (77,88,...,AA)
//   "ATs+"          suited Ax from ATs up to AKs (same high card, kicker T..K)
//   "KQo+"          offsuit, kicker up to one below the high card
//   "T9s+"          suited connectors-ish: increments BOTH ranks up to the high card
//   "22-66"         pair range
//   "A5s-A2s"       explicit suited range (same high card)
//   "AJs:0.5"       partial weight (50%) for any single token
//
// This is a pragmatic parser for AUTHORING the static default charts, not a general
// solver input. Unknown tokens throw (fail fast during development).

import { HAND_CLASSES } from './handClasses';
import { RANKS_HIGH_TO_LOW, type Rank } from './cards';

const RANK_INDEX = new Map<Rank, number>(RANKS_HIGH_TO_LOW.map((r, i) => [r, i]));

/** classIndex for a (highRank, lowRank, suitedness). High/low by rank value. */
function classIndexFor(a: Rank, b: Rank, suited: boolean | null): number {
  const ia = RANK_INDEX.get(a)!;
  const ib = RANK_INDEX.get(b)!;
  if (a === b) return ia * 13 + ia; // pair
  const hi = Math.min(ia, ib); // smaller axis index = higher rank
  const lo = Math.max(ia, ib);
  // suited = upper-right (row=hi, col=lo); offsuit = lower-left (row=lo, col=hi)
  return suited ? hi * 13 + lo : lo * 13 + hi;
}

function isRank(ch: string): ch is Rank {
  return RANK_INDEX.has(ch as Rank);
}

/** Parse one token into [classIndex...] (a token can expand to several classes). */
function parseToken(tokenRaw: string): { idxs: number[]; weight: number } {
  let token = tokenRaw.trim();
  let weight = 1;
  const colon = token.indexOf(':');
  if (colon >= 0) {
    weight = Number(token.slice(colon + 1));
    token = token.slice(0, colon).trim();
  }
  if (!token) return { idxs: [], weight };

  // explicit range "X-Y" (e.g. "22-66", "A5s-A2s")
  const dash = token.indexOf('-');
  if (dash > 0 && token.length > dash + 1) {
    return { idxs: parseDashRange(token.slice(0, dash), token.slice(dash + 1)), weight };
  }

  const plus = token.endsWith('+');
  const core = plus ? token.slice(0, -1) : token;
  const idxs = parseCore(core, plus);
  return { idxs, weight };
}

function suitedness(core: string): boolean | null {
  if (core.endsWith('s')) return true;
  if (core.endsWith('o')) return false;
  return null; // pair
}

function ranksOf(core: string): [Rank, Rank] {
  const stripped = core.replace(/[so]$/i, '');
  const a = stripped[0];
  const b = stripped[1] ?? stripped[0];
  if (!isRank(a) || !isRank(b)) throw new Error(`bad range token rank: ${core}`);
  return [a, b];
}

function parseCore(core: string, plus: boolean): number[] {
  const s = suitedness(core);
  const [a, b] = ranksOf(core);
  if (!plus) return [classIndexFor(a, b, s)];

  // "+" expansion
  if (a === b) {
    // pairs from this pair UP to AA
    const start = RANK_INDEX.get(a)!;
    const out: number[] = [];
    for (let r = start; r >= 0; r--) {
      const rk = RANKS_HIGH_TO_LOW[r];
      out.push(classIndexFor(rk, rk, null));
    }
    return out;
  }
  // suited/offsuit "+": fix the HIGH rank, sweep the kicker UP toward the high rank.
  const ia = RANK_INDEX.get(a)!;
  const ib = RANK_INDEX.get(b)!;
  const hiIdx = Math.min(ia, ib);
  const loIdx = Math.max(ia, ib);
  const hiRank = RANKS_HIGH_TO_LOW[hiIdx];
  const out: number[] = [];
  for (let k = loIdx; k > hiIdx; k--) {
    out.push(classIndexFor(hiRank, RANKS_HIGH_TO_LOW[k], s));
  }
  return out;
}

function parseDashRange(loToken: string, hiToken: string): number[] {
  const s = suitedness(loToken);
  const [a1, b1] = ranksOf(loToken);
  const [a2, b2] = ranksOf(hiToken);
  if (a1 === b1 && a2 === b2) {
    // pair range, e.g. "22-66"
    let r1 = RANK_INDEX.get(a1)!;
    let r2 = RANK_INDEX.get(a2)!;
    if (r1 < r2) [r1, r2] = [r2, r1]; // r1 = lower pair (higher index)
    const out: number[] = [];
    for (let r = r1; r >= r2; r--) out.push(classIndexFor(RANKS_HIGH_TO_LOW[r], RANKS_HIGH_TO_LOW[r], null));
    return out;
  }
  // same-high-card suited/offsuit range, e.g. "A5s-A2s"
  const hi = a1; // assume same high rank
  const k1 = RANK_INDEX.get(b1)!;
  const k2 = RANK_INDEX.get(b2)!;
  const lo = Math.max(k1, k2);
  const hiK = Math.min(k1, k2);
  const out: number[] = [];
  for (let k = hiK; k <= lo; k++) out.push(classIndexFor(hi, RANKS_HIGH_TO_LOW[k], s));
  void a2;
  void b2;
  return out;
}

/** Build a 169 weight vector from a range string (e.g. "77+, ATs+, KQs, AJo+"). */
export function parseRange(spec: string): Float64Array {
  const w = new Float64Array(169);
  for (const tok of spec.split(/[,\s]+/).filter(Boolean)) {
    const { idxs, weight } = parseToken(tok);
    for (const i of idxs) w[i] = weight;
  }
  return w;
}

/** A full-range (all 169 at weight 1) vector. */
export function fullRange(): Float64Array {
  return new Float64Array(169).fill(1);
}

/** Total combo weight of a range (for % of all hands), using combo counts. */
export function rangeComboFraction(w: Float64Array): number {
  let num = 0;
  let den = 0;
  for (let i = 0; i < 169; i++) {
    den += HAND_CLASSES[i].comboCount;
    num += HAND_CLASSES[i].comboCount * w[i];
  }
  return den > 0 ? num / den : 0;
}

/**
 * Combine multiple LIVE-opponent ranges into ONE composite opponent range
 * (E1/scenario reduction). We take the per-class UNION weighted by combo presence:
 * a hand class is in the composite if ANY live opponent could hold it, with weight =
 * combo-weighted average of the contributing ranges. This is a pragmatic v1 collapse
 * (card-removal BETWEEN the composite and the hero is still applied at solve time via
 * PAIR_WEIGHTS). Returns a normalized-ish weight vector in [0,1].
 */
export function combineComposite(ranges: Float64Array[]): Float64Array {
  const out = new Float64Array(169);
  if (ranges.length === 0) return fullRange();
  for (let i = 0; i < 169; i++) {
    // probability that AT LEAST ONE opponent holds class i = 1 - prod(1 - w_k[i]).
    let pNone = 1;
    for (const r of ranges) pNone *= 1 - Math.min(1, Math.max(0, r[i]));
    out[i] = 1 - pNone;
  }
  return out;
}
