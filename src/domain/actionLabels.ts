// Domain Core — action-label mapping (DATA_MODEL 13.4). Pure & unit-tested.
//
// The engine emits CANONICAL (mechanical) actions; the UI labels them by the node's
// raiseDepth. The same mechanical "raise-small" is an OPEN at depth 0, a 3-BET at
// depth 1, a 4-BET at depth 2, a 5-BET at depth 3.
//
//  raiseDepth | raise-small ->   | raise-big ->  | allin ->     | call/fold
//  -----------|------------------|---------------|--------------|-----------
//  0 (RFI)    | raise (open)     | raise-big     | shove        | call/fold
//  1 (vs raise)| 3bet            | 3bet-big      | 3bet-shove   | call/fold
//  2 (vs 3bet)| 4bet            | 4bet-big      | 4bet-shove   | call/fold
//  3 (vs 4bet)| 5bet            | (none)        | 5bet-shove   | call/fold
//  4+ (vs 5bet+)| (none)        | (none)        | shove        | call/fold
//
// Extra rules:
//  - `call` renders as `check` when amountToCallBb === 0 (e.g. BB facing limps).
//  - When a node has only ONE non-all-in raise size, do not emit a phantom
//    `raise-big` (callers should simply not include 'raise-big' in the node's
//    action list — labelFor still maps it if asked, but the node won't list it).

import type { ActionLabel, CanonicalAction } from './spotV2';

export interface LabelOptions {
  /** amount hero must put in to call at this node, in bb. 0 -> `call` becomes `check`. */
  amountToCallBb?: number;
}

export function labelFor(
  action: CanonicalAction,
  raiseDepth: number,
  opts: LabelOptions = {},
): ActionLabel {
  if (action === 'fold') return 'fold';
  if (action === 'call') {
    return (opts.amountToCallBb ?? 1) <= 0 ? 'check' : 'call';
  }

  if (action === 'allin') {
    switch (raiseDepth) {
      case 0:
        return 'shove';
      case 1:
        return '3bet-shove';
      case 2:
        return '4bet-shove';
      case 3:
        return '5bet-shove';
      default:
        return 'shove';
    }
  }

  // raise-small / raise-big
  const big = action === 'raise-big';
  switch (raiseDepth) {
    case 0:
      return big ? 'raise-big' : 'raise';
    case 1:
      return big ? '3bet-big' : '3bet';
    case 2:
      return big ? '4bet-big' : '4bet';
    case 3:
      // depth 3 has no "big" non-all-in raise in the v1 scheme; collapse to 5bet.
      return '5bet';
    default:
      // depth 4+: any further non-all-in raise is just a shove-ward action.
      return 'shove';
  }
}

/** Human-friendly display text for a label (e.g. "3-Bet", "4-Bet Shove"). */
export function prettyLabel(label: ActionLabel): string {
  switch (label) {
    case 'fold':
      return 'Fold';
    case 'check':
      return 'Check';
    case 'call':
      return 'Call';
    case 'raise':
      return 'Raise';
    case 'raise-big':
      return 'Raise Big';
    case '3bet':
      return '3-Bet';
    case '3bet-big':
      return '3-Bet Big';
    case '4bet':
      return '4-Bet';
    case '4bet-big':
      return '4-Bet Big';
    case '5bet':
      return '5-Bet';
    case '3bet-shove':
      return '3-Bet Shove';
    case '4bet-shove':
      return '4-Bet Shove';
    case '5bet-shove':
      return '5-Bet Shove';
    case 'shove':
      return 'Shove';
    default:
      return label;
  }
}
