import { describe, it, expect } from 'vitest';
import { evaluate5, evaluateBest, HAND_CATEGORY } from './evaluator';
import { cardId } from './cards';
import type { Card, Rank, Suit } from './cards';

function c(rank: Rank, suit: Suit): number {
  return cardId({ rank, suit } as Card);
}

function category(score: number): number {
  // category occupies the most-significant chunk (score / 16^5).
  return Math.floor(score / 16 ** 5);
}

describe('evaluate5 categories', () => {
  it('detects a royal/straight flush', () => {
    const s = evaluate5(c('A', 's'), c('K', 's'), c('Q', 's'), c('J', 's'), c('T', 's'));
    expect(category(s)).toBe(HAND_CATEGORY.STRAIGHT_FLUSH);
  });

  it('detects the wheel straight flush (A-2-3-4-5)', () => {
    const s = evaluate5(c('A', 'd'), c('2', 'd'), c('3', 'd'), c('4', 'd'), c('5', 'd'));
    expect(category(s)).toBe(HAND_CATEGORY.STRAIGHT_FLUSH);
  });

  it('detects quads', () => {
    const s = evaluate5(c('9', 's'), c('9', 'h'), c('9', 'd'), c('9', 'c'), c('K', 's'));
    expect(category(s)).toBe(HAND_CATEGORY.QUADS);
  });

  it('detects a full house', () => {
    const s = evaluate5(c('Q', 's'), c('Q', 'h'), c('Q', 'd'), c('5', 'c'), c('5', 's'));
    expect(category(s)).toBe(HAND_CATEGORY.FULL_HOUSE);
  });

  it('detects a flush', () => {
    const s = evaluate5(c('A', 'h'), c('J', 'h'), c('8', 'h'), c('5', 'h'), c('2', 'h'));
    expect(category(s)).toBe(HAND_CATEGORY.FLUSH);
  });

  it('detects a straight', () => {
    const s = evaluate5(c('9', 's'), c('8', 'h'), c('7', 'd'), c('6', 'c'), c('5', 's'));
    expect(category(s)).toBe(HAND_CATEGORY.STRAIGHT);
  });

  it('detects the wheel straight (A-2-3-4-5)', () => {
    const s = evaluate5(c('A', 's'), c('2', 'h'), c('3', 'd'), c('4', 'c'), c('5', 's'));
    expect(category(s)).toBe(HAND_CATEGORY.STRAIGHT);
  });

  it('detects trips, two pair, pair, high card', () => {
    expect(category(evaluate5(c('7', 's'), c('7', 'h'), c('7', 'd'), c('K', 'c'), c('2', 's')))).toBe(
      HAND_CATEGORY.TRIPS,
    );
    expect(category(evaluate5(c('7', 's'), c('7', 'h'), c('4', 'd'), c('4', 'c'), c('2', 's')))).toBe(
      HAND_CATEGORY.TWO_PAIR,
    );
    expect(category(evaluate5(c('7', 's'), c('7', 'h'), c('K', 'd'), c('4', 'c'), c('2', 's')))).toBe(
      HAND_CATEGORY.PAIR,
    );
    expect(category(evaluate5(c('A', 's'), c('J', 'h'), c('9', 'd'), c('4', 'c'), c('2', 's')))).toBe(
      HAND_CATEGORY.HIGH_CARD,
    );
  });
});

describe('evaluate5 ordering', () => {
  it('ranks categories in the right order', () => {
    const sf = evaluate5(c('A', 's'), c('K', 's'), c('Q', 's'), c('J', 's'), c('T', 's'));
    const quad = evaluate5(c('9', 's'), c('9', 'h'), c('9', 'd'), c('9', 'c'), c('K', 's'));
    const flush = evaluate5(c('A', 'h'), c('J', 'h'), c('8', 'h'), c('5', 'h'), c('2', 'h'));
    const pair = evaluate5(c('7', 's'), c('7', 'h'), c('K', 'd'), c('4', 'c'), c('2', 's'));
    expect(sf).toBeGreaterThan(quad);
    expect(quad).toBeGreaterThan(flush);
    expect(flush).toBeGreaterThan(pair);
  });

  it('breaks ties by kicker (AK > AQ with same top pair)', () => {
    const ak = evaluate5(c('A', 's'), c('A', 'h'), c('K', 'd'), c('4', 'c'), c('2', 's'));
    const aq = evaluate5(c('A', 's'), c('A', 'h'), c('Q', 'd'), c('4', 'c'), c('2', 's'));
    expect(ak).toBeGreaterThan(aq);
  });
});

describe('evaluateBest (7 cards)', () => {
  it('picks the best 5 of 7 (flush over pair)', () => {
    const seven = [
      c('A', 'h'), c('K', 'h'), c('Q', 'h'), c('2', 'h'), c('5', 'h'),
      c('A', 's'), c('A', 'd'),
    ];
    expect(category(evaluateBest(seven))).toBe(HAND_CATEGORY.FLUSH);
  });

  it('finds a straight using board + hole cards', () => {
    const seven = [
      c('9', 'c'), c('8', 'd'), // hole
      c('7', 'h'), c('6', 's'), c('5', 'c'), c('K', 'd'), c('2', 'h'), // board
    ];
    expect(category(evaluateBest(seven))).toBe(HAND_CATEGORY.STRAIGHT);
  });
});
