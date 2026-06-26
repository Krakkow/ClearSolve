// Domain Core — all-in preflop equity via Monte Carlo over a real 5-card board.
//
// Equity = P(hero wins) + 0.5 * P(tie), estimated by dealing random 5-card boards
// from the remaining deck and comparing best 7-card hands with the evaluator.
//
// Determinism (NFR-004): the caller passes a seed; the same (hero, villain, seed,
// samples) yields an identical equity. We also expose a class-vs-class equity that
// averages over the suit-specific combos of each class (excluding blocked combos).

import { combosForClassIndex, type Combo } from './combos';
import { evaluate7 } from './evaluator7';
import { makeRng, type Rng } from './rng';

/** Equity of a specific 2-card hand vs another specific 2-card hand, all-in preflop. */
export function comboVsComboEquity(
  hero: Combo,
  villain: Combo,
  samples: number,
  rng: Rng,
): number {
  // Build the remaining deck (52 - 4 known cards).
  const dead = new Uint8Array(52);
  dead[hero[0]] = 1;
  dead[hero[1]] = 1;
  dead[villain[0]] = 1;
  dead[villain[1]] = 1;
  const deck: number[] = [];
  for (let i = 0; i < 52; i++) if (!dead[i]) deck.push(i);

  let win = 0;
  let tie = 0;
  const board = new Array<number>(5);
  const heroCards = [hero[0], hero[1], 0, 0, 0, 0, 0];
  const villCards = [villain[0], villain[1], 0, 0, 0, 0, 0];

  for (let s = 0; s < samples; s++) {
    // Partial Fisher-Yates: pick 5 distinct board cards from `deck`.
    for (let k = 0; k < 5; k++) {
      const j = k + rng.nextInt(deck.length - k);
      const tmp = deck[k];
      deck[k] = deck[j];
      deck[j] = tmp;
      board[k] = deck[k];
    }
    for (let k = 0; k < 5; k++) {
      heroCards[2 + k] = board[k];
      villCards[2 + k] = board[k];
    }
    const hs = evaluate7(
      heroCards[0], heroCards[1], heroCards[2], heroCards[3], heroCards[4], heroCards[5], heroCards[6],
    );
    const vs = evaluate7(
      villCards[0], villCards[1], villCards[2], villCards[3], villCards[4], villCards[5], villCards[6],
    );
    if (hs > vs) win++;
    else if (hs === vs) tie++;
  }
  return (win + 0.5 * tie) / samples;
}

/**
 * Equity of one starting-hand CLASS vs another CLASS, all-in preflop.
 *
 * A class pairing has up to 144 non-conflicting suit-specific combo pairings.
 * Suit differences barely affect preflop all-in equity (only via flush/straight
 * texture), so rather than fully sampling every pairing (which is very expensive),
 * we spread a FIXED TOTAL sample budget (`samples`) across the valid combo
 * pairings round-robin: each MC trial picks the next pairing and deals one random
 * board. This makes runtime depend only on `samples`, not on the (variable) number
 * of pairings, while still averaging across suit combinations. Deterministic given
 * `seed`. Documented Monte-Carlo approximation for this slice.
 */
export function classVsClassEquity(
  heroClass: number,
  villainClass: number,
  samples: number,
  seed: number,
): number {
  const heroCombos = combosForClassIndex(heroClass);
  const villCombos = combosForClassIndex(villainClass);
  const rng = makeRng(seed);

  // Enumerate non-conflicting combo pairings (suits that don't share a card).
  const validPairs: [Combo, Combo][] = [];
  for (const h of heroCombos) {
    for (const v of villCombos) {
      if (h[0] === v[0] || h[0] === v[1] || h[1] === v[0] || h[1] === v[1]) continue;
      validPairs.push([h, v]);
    }
  }
  if (validPairs.length === 0) return 0.5; // fully blocked (cannot happen for distinct classes here)

  const np = validPairs.length;
  let win = 0;
  let tie = 0;
  const board = new Array<number>(5);
  const heroCards = [0, 0, 0, 0, 0, 0, 0];
  const villCards = [0, 0, 0, 0, 0, 0, 0];
  const deck = new Array<number>(48);

  for (let s = 0; s < samples; s++) {
    const [hero, villain] = validPairs[s % np];
    heroCards[0] = hero[0];
    heroCards[1] = hero[1];
    villCards[0] = villain[0];
    villCards[1] = villain[1];

    // Build the 48-card live deck for this pairing.
    let di = 0;
    for (let i = 0; i < 52; i++) {
      if (i === hero[0] || i === hero[1] || i === villain[0] || i === villain[1]) continue;
      deck[di++] = i;
    }
    // Deal 5 distinct board cards (partial Fisher-Yates).
    for (let k = 0; k < 5; k++) {
      const j = k + rng.nextInt(di - k);
      const tmp = deck[k];
      deck[k] = deck[j];
      deck[j] = tmp;
      board[k] = deck[k];
      heroCards[2 + k] = board[k];
      villCards[2 + k] = board[k];
    }
    const hs = evaluate7(
      heroCards[0], heroCards[1], heroCards[2], heroCards[3], heroCards[4], heroCards[5], heroCards[6],
    );
    const vs = evaluate7(
      villCards[0], villCards[1], villCards[2], villCards[3], villCards[4], villCards[5], villCards[6],
    );
    if (hs > vs) win++;
    else if (hs === vs) tie++;
  }
  return (win + 0.5 * tie) / samples;
}
