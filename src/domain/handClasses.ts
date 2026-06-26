// Domain Core — the 169 canonical starting-hand classes (DATA_MODEL Sec 2).
//
// Grid convention (BR-001): a 13x13 matrix indexed by [row][col] over the
// rank axis A(0)..2(12) (high->low). Cells:
//   - row === col  -> pair (e.g. AA at [0][0])
//   - col  >  row   -> SUITED  (upper-right triangle)  e.g. AKs at [0][1]
//   - row  >  col   -> OFFSUIT (lower-left triangle)   e.g. AKo at [1][0]
//
// classIndex = row*13 + col  (0..168).

import { RANKS_HIGH_TO_LOW, type Rank } from './cards';

export type HandClassKind = 'pair' | 'suited' | 'offsuit';

export interface HandClass {
  index: number; // 0..168
  row: number; // 0..12 (A..2)
  col: number; // 0..12 (A..2)
  label: string; // e.g. "AKs", "QJo", "TT"
  kind: HandClassKind;
  high: Rank;
  low: Rank;
  comboCount: number; // pair=6, suited=4, offsuit=12 (pre-board removal)
}

function buildHandClasses(): HandClass[] {
  const out: HandClass[] = [];
  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      const rHigh = RANKS_HIGH_TO_LOW[row];
      const rCol = RANKS_HIGH_TO_LOW[col];
      const index = row * 13 + col;
      let kind: HandClassKind;
      let label: string;
      let high: Rank;
      let low: Rank;
      let comboCount: number;

      if (row === col) {
        kind = 'pair';
        high = rHigh;
        low = rHigh;
        label = `${rHigh}${rHigh}`;
        comboCount = 6;
      } else if (col > row) {
        // upper-right -> suited; the higher rank is the smaller axis index (row)
        kind = 'suited';
        high = rHigh;
        low = rCol;
        label = `${rHigh}${rCol}s`;
        comboCount = 4;
      } else {
        // lower-left -> offsuit; higher rank is the column (smaller index)
        kind = 'offsuit';
        high = rCol;
        low = rHigh;
        label = `${rCol}${rHigh}o`;
        comboCount = 12;
      }
      out.push({ index, row, col, label, kind, high, low, comboCount });
    }
  }
  return out;
}

/** All 169 hand classes in classIndex order (0..168). */
export const HAND_CLASSES: HandClass[] = buildHandClasses();

export function handClassByIndex(i: number): HandClass {
  return HAND_CLASSES[i];
}
