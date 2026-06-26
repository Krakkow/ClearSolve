// Domain Core — expand a 169 hand class into its concrete suit-specific combos
// (DATA_MODEL Sec 2, "Combo"). Combos are pairs of 0..51 card ids.

import { SUITS, rankIndex, type Rank } from './cards';
import { handClassByIndex, type HandClass } from './handClasses';

export type Combo = [number, number]; // two distinct 0..51 card ids

function id(rank: Rank, suitIdx: number): number {
  return rankIndex(rank) * 4 + suitIdx;
}

/** All concrete 2-card combos for a hand class (pre-removal): pair=6, suited=4, offsuit=12. */
export function combosForClass(hc: HandClass): Combo[] {
  const out: Combo[] = [];
  if (hc.kind === 'pair') {
    for (let s1 = 0; s1 < 4; s1++) {
      for (let s2 = s1 + 1; s2 < 4; s2++) {
        out.push([id(hc.high, s1), id(hc.high, s2)]);
      }
    }
  } else if (hc.kind === 'suited') {
    for (let s = 0; s < 4; s++) {
      out.push([id(hc.high, s), id(hc.low, s)]);
    }
  } else {
    // offsuit: every suit pairing where suits differ
    for (let s1 = 0; s1 < 4; s1++) {
      for (let s2 = 0; s2 < 4; s2++) {
        if (s1 === s2) continue;
        out.push([id(hc.high, s1), id(hc.low, s2)]);
      }
    }
  }
  return out;
}

export function combosForClassIndex(index: number): Combo[] {
  return combosForClass(handClassByIndex(index));
}

export const _suits = SUITS; // re-export anchor to keep tree-shaking honest in tests
