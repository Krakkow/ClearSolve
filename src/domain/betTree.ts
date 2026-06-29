// Domain Core — Heads-Up preflop BET TREE (no postflop).
//
// Players: SB (= button, acts FIRST preflop in HU) and BB (responds).
// Blinds: SB posts smallBlind (0.5), BB posts bigBlind (1.0). Each player starts
// with `stack` chips (the effective stack S in bb) and the blinds come OUT of that
// stack, so a player's remaining stack = stack - contributed.
//
// "Raise TO x" means the raiser's TOTAL contribution becomes x bb. Clamp rule:
// if a raise-to size would meet/exceed a player's effective stack (stack), the
// action becomes ALL-IN instead. This makes deep trees full and short stacks
// degenerate naturally to jam/fold.
//
// v1 action tree (sizes are named constants, easy to tune later):
//   SB (open):          FOLD / OPEN to 2.5 / ALL-IN
//   BB vs open:         FOLD / CALL / 3BET to 11 / ALL-IN
//   SB vs 3bet:         FOLD / CALL / 4BET to 24 / ALL-IN
//   BB vs 4bet:         FOLD / CALL / ALL-IN (5-bet jam)
//   SB vs 5bet jam:     FOLD / CALL
//
// Terminal EV model (documented in detail in preflopCfr.ts):
//   - FOLD: folder loses chips contributed so far; opponent takes the pot.
//   - ALL-IN called: showdown over the full 5-card runout (equity matrix), at-risk
//     = effective stack; pot split on ties.
//   - non-all-in CALL that closes action: "checked down to showdown" preflop-equity
//     model — EV_i = equity_i * pot - contributed_i, behind stacks retained.

export type Player = 0 | 1; // 0 = SB, 1 = BB

export type ActionKind = 'fold' | 'call' | 'raise' | 'allin';

/** Default v1 raise-TO sizes (total contribution by the raiser), in bb. */
export interface BetTreeConfig {
  smallBlind: number; // 0.5
  bigBlind: number; // 1.0
  stack: number; // effective stack S (bb)
  openTo: number; // SB open raise-to (2.5)
  threeBetTo: number; // BB 3-bet raise-to (11)
  fourBetTo: number; // SB 4-bet raise-to (24)
}

export const DEFAULT_SIZES = {
  smallBlind: 0.5,
  bigBlind: 1.0,
  openTo: 2.5,
  threeBetTo: 11,
  fourBetTo: 24,
} as const;

/**
 * Max effective stack (bb) at which OPEN-JAMMING is offered as a distinct action at the
 * root. Open-shoving is part of GTO only when short (push/fold territory); deep, nobody
 * open-jams, so offering it there is a pure bet-abstraction artifact (the see-flop
 * terminal undervalues the small-open line, so the solver leaks frequency into a jam that
 * real GTO never makes). Above this depth the open node is just Fold / Open. Note the
 * deeper jam lines (3-bet/4-bet) are already only reachable via the short-stack clamp, so
 * this single gate removes the whole deep over-jam. 5-bet jam (the committed, low-SPR
 * node) is unaffected. Short-stack jam behavior (<=20bb) and push/fold parity are kept.
 */
export const OPEN_JAM_MAX_BB = 20;

export interface Action {
  kind: ActionKind;
  label: string; // UI label, e.g. "Open 2.5", "3-Bet 11", "All-in", "Call", "Fold"
  /** The acting player's TOTAL contribution AFTER taking this action (bb). */
  contribTo: number;
}

/** A terminal outcome of the tree. */
export interface TerminalNode {
  kind: 'terminal';
  /** total chips each player has contributed at this leaf. */
  contrib: [number, number];
  /** how the hand ended: a fold (by whom) or a showdown. */
  outcome:
    | { type: 'fold'; folder: Player } // opponent wins the pot
    | { type: 'showdown-allin' } // all-in called: equity over full runout, at-risk = stacks
    | { type: 'showdown-preflop' }; // non-all-in call closes action: preflop-equity model
}

/** A decision node where `toAct` chooses among `actions`. */
export interface DecisionNode {
  kind: 'decision';
  id: number; // unique node id (assigned in build order)
  toAct: Player;
  /** human label for the node navigator, e.g. "SB Open", "BB vs Open". */
  label: string;
  /** contributions so far when arriving at this node. */
  contrib: [number, number];
  actions: Action[];
  children: TreeNode[]; // parallel to actions
}

export type TreeNode = DecisionNode | TerminalNode;

export interface BetTree {
  root: DecisionNode;
  /** all decision nodes in id order (for CFR info-set indexing & UI navigation). */
  decisionNodes: DecisionNode[];
  config: BetTreeConfig;
}

/**
 * Build the v1 HU preflop bet tree for the given config.
 *
 * Chip model: contributions accumulate; a player's max total contribution is
 * `stack`. A "raise TO `target`" is clamped to ALL-IN when `target >= stack` OR
 * when it does not strictly exceed the current amount-to-match (degenerate).
 */
export function buildBetTree(config: BetTreeConfig): BetTree {
  const { smallBlind, bigBlind, stack } = config;
  const decisionNodes: DecisionNode[] = [];
  let nextId = 0;

  // Helper: make a raise/allin action, applying the clamp rule.
  // currentMax = the largest contribution so far (the amount to at least match to raise).
  function raiseOrAllin(target: number, currentMax: number, label: string): Action {
    // A legal raise must strictly exceed currentMax and stay below stack; otherwise all-in.
    if (target >= stack || target <= currentMax) {
      return { kind: 'allin', label: 'All-in', contribTo: stack };
    }
    return { kind: 'raise', label, contribTo: target };
  }

  function terminalFold(contrib: [number, number], folder: Player): TerminalNode {
    return { kind: 'terminal', contrib: [...contrib], outcome: { type: 'fold', folder } };
  }

  function terminalShowdown(
    contrib: [number, number],
    type: 'showdown-allin' | 'showdown-preflop',
  ): TerminalNode {
    return { kind: 'terminal', contrib: [...contrib], outcome: { type } };
  }

  function makeDecision(
    toAct: Player,
    label: string,
    contrib: [number, number],
    build: (node: DecisionNode) => void,
  ): DecisionNode {
    const node: DecisionNode = {
      kind: 'decision',
      id: nextId++,
      toAct,
      label,
      contrib: [...contrib],
      actions: [],
      children: [],
    };
    decisionNodes.push(node);
    build(node);
    return node;
  }

  // ---- Node: SB vs BB 5-bet jam (BB all-in). SB: FOLD / CALL ----
  // contrib here: SB has contributed sbPrev, BB is all-in (= stack).
  function sbVs5betJam(contrib: [number, number]): DecisionNode {
    return makeDecision(0, 'SB vs 5-bet jam', contrib, (node) => {
      // FOLD: SB folds, loses sbPrev.
      node.actions.push({ kind: 'fold', label: 'Fold', contribTo: contrib[0] });
      node.children.push(terminalFold(contrib, 0));
      // CALL: SB calls all-in -> showdown all-in.
      node.actions.push({ kind: 'call', label: 'Call', contribTo: stack });
      node.children.push(terminalShowdown([stack, stack], 'showdown-allin'));
    });
  }

  // ---- Node: BB vs SB 4-bet. BB: FOLD / CALL / ALL-IN(5-bet jam) ----
  // contrib: SB has 4-bet to fourBetTo (or all-in), BB has 3-bet amount.
  function bbVs4bet(contrib: [number, number], sbContrib: number): DecisionNode {
    return makeDecision(1, 'BB vs 4-bet', contrib, (node) => {
      // FOLD: BB loses its 3-bet contribution.
      node.actions.push({ kind: 'fold', label: 'Fold', contribTo: contrib[1] });
      node.children.push(terminalFold(contrib, 1));
      // CALL: BB matches SB's 4-bet contribution.
      // If SB is all-in this is an all-in call; otherwise stacks remain -> preflop showdown.
      const callTo = sbContrib;
      const isAllinCall = sbContrib >= stack;
      node.actions.push({ kind: 'call', label: 'Call', contribTo: callTo });
      node.children.push(
        terminalShowdown(
          [sbContrib, callTo],
          isAllinCall ? 'showdown-allin' : 'showdown-preflop',
        ),
      );
      // ALL-IN (5-bet jam): BB jams to stack. SB then faces SB-vs-5bet-jam decision.
      const bbAllin: Action = { kind: 'allin', label: 'All-in', contribTo: stack };
      node.actions.push(bbAllin);
      node.children.push(sbVs5betJam([sbContrib, stack]));
    });
  }

  // ---- Node: SB vs BB 3-bet. SB: FOLD / CALL / 4BET to 24 / ALL-IN ----
  // contrib: SB opened (openContrib), BB 3-bet to bbContrib.
  function sbVs3bet(contrib: [number, number], bbContrib: number): DecisionNode {
    return makeDecision(0, 'SB vs 3-bet', contrib, (node) => {
      // FOLD: SB loses its open contribution.
      node.actions.push({ kind: 'fold', label: 'Fold', contribTo: contrib[0] });
      node.children.push(terminalFold(contrib, 0));
      // CALL: SB matches BB's 3-bet -> stacks remain -> preflop showdown.
      const callTo = bbContrib;
      const isAllinCall = bbContrib >= stack;
      node.actions.push({ kind: 'call', label: 'Call', contribTo: callTo });
      node.children.push(
        terminalShowdown(
          [callTo, bbContrib],
          isAllinCall ? 'showdown-allin' : 'showdown-preflop',
        ),
      );
      // 4-BET to fourBetTo (clamp to all-in). SB raises; BB then faces vs-4bet.
      const fourBet = raiseOrAllin(config.fourBetTo, bbContrib, `4-Bet ${config.fourBetTo}`);
      node.actions.push(fourBet);
      node.children.push(bbVs4bet([fourBet.contribTo, bbContrib], fourBet.contribTo));
    });
  }

  // ---- Node: BB vs SB open. BB: FOLD / CALL / 3BET to 11 / ALL-IN ----
  // contrib: SB opened (openContrib), BB posted bigBlind.
  function bbVsOpen(contrib: [number, number], openContrib: number): DecisionNode {
    return makeDecision(1, 'BB vs Open', contrib, (node) => {
      // FOLD: BB loses its big-blind post.
      node.actions.push({ kind: 'fold', label: 'Fold', contribTo: contrib[1] });
      node.children.push(terminalFold(contrib, 1));
      // CALL: BB matches SB's open -> stacks remain -> preflop showdown.
      const callTo = openContrib;
      const isAllinCall = openContrib >= stack;
      node.actions.push({ kind: 'call', label: 'Call', contribTo: callTo });
      node.children.push(
        terminalShowdown(
          [openContrib, callTo],
          isAllinCall ? 'showdown-allin' : 'showdown-preflop',
        ),
      );
      // 3-BET to threeBetTo (clamp to all-in). SB then faces vs-3bet.
      const threeBet = raiseOrAllin(config.threeBetTo, openContrib, `3-Bet ${config.threeBetTo}`);
      node.actions.push(threeBet);
      node.children.push(sbVs3bet([openContrib, threeBet.contribTo], threeBet.contribTo));
    });
  }

  // ---- Root: SB open. SB: FOLD / OPEN to 2.5 / ALL-IN ----
  const root = makeDecision(0, 'SB Open', [smallBlind, bigBlind], (node) => {
    // FOLD: SB folds the button, loses its small-blind post.
    node.actions.push({ kind: 'fold', label: 'Fold', contribTo: smallBlind });
    node.children.push(terminalFold([smallBlind, bigBlind], 0));
    // OPEN to openTo (clamp to all-in if openTo >= stack, e.g. very short stacks).
    const open = raiseOrAllin(config.openTo, bigBlind, `Open ${config.openTo}`);
    node.actions.push(open);
    node.children.push(bbVsOpen([open.contribTo, bigBlind], open.contribTo));
    // ALL-IN (open-jam): only a real action when short. Deep, this is an abstraction
    // artifact (real GTO never open-jams 100bb), so omit it — see OPEN_JAM_MAX_BB.
    if (open.kind !== 'allin' && stack <= OPEN_JAM_MAX_BB) {
      node.actions.push({ kind: 'allin', label: 'All-in', contribTo: stack });
      node.children.push(bbVsOpen([stack, bigBlind], stack));
    }
  });

  return { root, decisionNodes, config };
}
