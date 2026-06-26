import { describe, it, expect } from 'vitest';
import { labelFor } from './actionLabels';

describe('labelFor — raise-small by depth', () => {
  it('depth 0 RFI -> raise (open)', () => {
    expect(labelFor('raise-small', 0)).toBe('raise');
  });
  it('depth 1 (vs raise) -> 3bet', () => {
    expect(labelFor('raise-small', 1)).toBe('3bet');
  });
  it('depth 2 (vs 3bet) -> 4bet', () => {
    expect(labelFor('raise-small', 2)).toBe('4bet');
  });
  it('depth 3 (vs 4bet) -> 5bet', () => {
    expect(labelFor('raise-small', 3)).toBe('5bet');
  });
});

describe('labelFor — raise-big by depth', () => {
  it('depth 0 -> raise-big', () => {
    expect(labelFor('raise-big', 0)).toBe('raise-big');
  });
  it('depth 1 -> 3bet-big', () => {
    expect(labelFor('raise-big', 1)).toBe('3bet-big');
  });
  it('depth 2 -> 4bet-big', () => {
    expect(labelFor('raise-big', 2)).toBe('4bet-big');
  });
});

describe('labelFor — allin (shove) by depth', () => {
  it('depth 0 -> shove (open jam)', () => {
    expect(labelFor('allin', 0)).toBe('shove');
  });
  it('depth 1 -> 3bet-shove', () => {
    expect(labelFor('allin', 1)).toBe('3bet-shove');
  });
  it('depth 2 -> 4bet-shove', () => {
    expect(labelFor('allin', 2)).toBe('4bet-shove');
  });
  it('depth 3 -> 5bet-shove', () => {
    expect(labelFor('allin', 3)).toBe('5bet-shove');
  });
  it('depth 4+ -> shove', () => {
    expect(labelFor('allin', 4)).toBe('shove');
    expect(labelFor('allin', 7)).toBe('shove');
  });
});

describe('labelFor — call/check/fold', () => {
  it('fold is always fold', () => {
    expect(labelFor('fold', 0)).toBe('fold');
    expect(labelFor('fold', 3)).toBe('fold');
  });
  it('call with amount to call > 0 is call', () => {
    expect(labelFor('call', 1, { amountToCallBb: 1.5 })).toBe('call');
  });
  it('call with amount to call 0 renders as check', () => {
    expect(labelFor('call', 0, { amountToCallBb: 0 })).toBe('check');
  });
});
