import { describe, it, expect } from 'vitest';
import {
  seatLayout,
  preflopActionOrder,
  seatIndexOf,
  validPositions,
} from './seatLayout';
import type { TableSize } from './spotV2';

describe('seatLayout', () => {
  it('HU (tableSize 2): SB=button at seatIndex 0, BB at 1', () => {
    const seats = seatLayout(2);
    expect(seats).toHaveLength(2);
    expect(seats[0]).toMatchObject({ seatIndex: 0, position: 'SB' });
    expect(seats[1]).toMatchObject({ seatIndex: 1, position: 'BB' });
  });

  it('posting order always starts SB(0), BB(1) for 3+ players', () => {
    for (const ts of [3, 4, 5, 6, 7, 8, 9] as TableSize[]) {
      const seats = seatLayout(ts);
      expect(seats).toHaveLength(ts);
      expect(seats[0].position).toBe('SB');
      expect(seats[1].position).toBe('BB');
      expect(seats[seats.length - 1].position).toBe('BTN');
    }
  });

  it('6-max has the canonical positions', () => {
    const set = new Set(seatLayout(6).map((s) => s.position));
    expect(set).toEqual(new Set(['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN']));
  });

  it('9-max (full ring) has all positions', () => {
    const set = new Set(seatLayout(9).map((s) => s.position));
    expect(set).toEqual(
      new Set(['SB', 'BB', 'UTG', 'UTG1', 'MP', 'LJ', 'HJ', 'CO', 'BTN']),
    );
  });

  it('seatIndexOf resolves a position', () => {
    expect(seatIndexOf(6, 'BTN')).toBeGreaterThanOrEqual(0);
    expect(() => seatIndexOf(6, 'MP')).toThrow(); // MP not valid at 6-max
  });

  it('per-seat stacks default to the given depth', () => {
    const seats = seatLayout(6, 80);
    for (const s of seats) expect(s.stackBb).toBe(80);
  });
});

describe('preflopActionOrder', () => {
  it('HU: BTN(=SB) acts first, then BB', () => {
    const order = preflopActionOrder(2);
    const seats = seatLayout(2);
    expect(seats[order[0]].position).toBe('SB');
    expect(seats[order[1]].position).toBe('BB');
  });

  it('6-max: UTG first, BB last', () => {
    const order = preflopActionOrder(6);
    const seats = seatLayout(6);
    expect(seats[order[0]].position).toBe('UTG');
    expect(seats[order[order.length - 1]].position).toBe('BB');
    // SB acts second-to-last preflop.
    expect(seats[order[order.length - 2]].position).toBe('SB');
  });
});

describe('validPositions', () => {
  it('returns the speaking-order positions for the table size', () => {
    expect(validPositions(2)).toEqual(['SB', 'BB']);
    expect(validPositions(6)).toEqual(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
  });
});
