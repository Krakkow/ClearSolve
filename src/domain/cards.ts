// Domain Core — cards & board (DATA_MODEL Sec 1).
// Pure, framework-free, no I/O. The engine uses the compact 0..51 integer form
// for speed; the UI/domain use the structured {rank, suit} form.

export type Rank =
  | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';
export type Suit = 'c' | 'd' | 'h' | 's';

export interface Card {
  rank: Rank;
  suit: Suit;
}

/** Ranks low->high, index 0..12. 'A' is high (index 12). */
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
export const SUITS: Suit[] = ['c', 'd', 'h', 's'];

/** Ranks high->low — the standard 13x13 grid axis order (A in top-left .. 2 bottom-right). */
export const RANKS_HIGH_TO_LOW: Rank[] = [
  'A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2',
];

export function rankIndex(r: Rank): number {
  return RANKS.indexOf(r);
}

export function suitIndex(s: Suit): number {
  return SUITS.indexOf(s);
}

/** Compact 0..51 integer encoding: rankIndex*4 + suitIndex. */
export function cardId(c: Card): number {
  return rankIndex(c.rank) * 4 + suitIndex(c.suit);
}

export function cardFromId(id: number): Card {
  return { rank: RANKS[Math.floor(id / 4)], suit: SUITS[id % 4] };
}

/** Rank index (0..12) of a 0..51 card id. */
export function rankOfId(id: number): number {
  return Math.floor(id / 4);
}

/** Full 52-card deck as 0..51 ids. */
export function fullDeckIds(): number[] {
  const d: number[] = [];
  for (let i = 0; i < 52; i++) d.push(i);
  return d;
}

export function cardLabel(c: Card): string {
  return c.rank + c.suit;
}
