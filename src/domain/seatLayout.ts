// Domain Core — canonical seat -> position + preflop action-order mapping for
// table sizes 2..9 (DATA_MODEL 13.1.1). Pure & deterministic (NFR-004).
//
// `seatIndex` is POSTING order from SB: 0 = SB, 1 = BB, 2 = first non-blind to act
// preflop, ... , last = BTN. `position` is the button-relative label.
//
// The architect's table lists positions in non-blind-first SPEAKING order (first to
// act preflop -> last). We reproduce that order, then assign seatIndex in posting
// order (SB=0, BB=1, then the non-blind seats in their speaking order, ending at BTN).

import type { Seat, SeatPosition, TableSize } from './spotV2';

// Preflop SPEAKING order (first to act -> last), per DATA_MODEL 13.1.1.
// For tableSize >= 3 the blinds (SB, BB) close the action and are listed last here.
const SPEAKING_ORDER: Record<TableSize, SeatPosition[]> = {
  2: ['BTN', 'BB'], // HU special case: BTN(=SB) acts FIRST preflop
  3: ['BTN', 'SB', 'BB'],
  4: ['CO', 'BTN', 'SB', 'BB'],
  5: ['HJ', 'CO', 'BTN', 'SB', 'BB'],
  6: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  7: ['UTG', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  8: ['UTG', 'UTG1', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  9: ['UTG', 'UTG1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
};

/**
 * Canonical seats in POSTING order (seatIndex 0 = SB ... last = BTN).
 *
 * HU (tableSize 2) is the documented exception: the BTN posts the SB and acts
 * first preflop, so seatIndex 0 is labeled 'SB' (it IS the button), seatIndex 1 = BB.
 */
export function seatLayout(tableSize: TableSize, stackBb = 100): Seat[] {
  if (tableSize === 2) {
    // BTN(=SB) at seatIndex 0 (posts SB, acts first), BB at seatIndex 1.
    return [
      { seatIndex: 0, position: 'SB', stackBb },
      { seatIndex: 1, position: 'BB', stackBb },
    ];
  }
  // For 3+ players: posting order is SB(0), BB(1), then the non-blind seats in
  // speaking order (UTG..CO, BTN last). Extract SB/BB out of the speaking list.
  const speaking = SPEAKING_ORDER[tableSize];
  const nonBlinds = speaking.filter((p) => p !== 'SB' && p !== 'BB'); // UTG..BTN order
  const ordered: SeatPosition[] = ['SB', 'BB', ...nonBlinds];
  return ordered.map((position, seatIndex) => ({ seatIndex, position, stackBb }));
}

/**
 * Preflop action order as a list of seatIndex values, first-to-act -> last.
 * HU: BTN(=SB, seatIndex 0) first, then BB. 3+: non-blinds first, SB then BB last.
 */
export function preflopActionOrder(tableSize: TableSize): number[] {
  const seats = seatLayout(tableSize);
  const byPos = new Map<SeatPosition, number>();
  for (const s of seats) byPos.set(s.position, s.seatIndex);
  if (tableSize === 2) {
    return [byPos.get('SB')!, byPos.get('BB')!];
  }
  const speaking = SPEAKING_ORDER[tableSize]; // already first->last speaking order
  return speaking.map((p) => byPos.get(p)!);
}

/** Resolve a hero position to its seatIndex for a table size (throws if invalid). */
export function seatIndexOf(tableSize: TableSize, position: SeatPosition): number {
  const seat = seatLayout(tableSize).find((s) => s.position === position);
  if (!seat) {
    throw new Error(`position ${position} is not valid for tableSize ${tableSize}`);
  }
  return seat.seatIndex;
}

/** The valid hero positions for a table size (for UI dropdown population). */
export function validPositions(tableSize: TableSize): SeatPosition[] {
  // Present in speaking order (most intuitive for a position picker).
  if (tableSize === 2) return ['SB', 'BB'];
  return SPEAKING_ORDER[tableSize];
}
