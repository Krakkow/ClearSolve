// Domain Core — CFR+ solver over the HU preflop bet tree (betTree.ts).
//
// =========================== THE GAME & ABSTRACTION ===========================
// We solve at the 169-CLASS abstraction: an information set is
//   (acting player's hand class 0..168, decision-node id).
// Both players are dealt a class from the 169 classes; the joint prior over
// (SB class, BB class) is the card-removal-aware co-occurrence weight
// PAIR_WEIGHTS[i][j] (pairWeights.ts), normalised to a probability distribution.
// This makes range-vs-range reach and payoffs card-removal aware at class level.
//
// =============================== TERMINAL EV ==================================
// All EVs are CHIP EV in big blinds, expressed as each player's NET delta
// (final stack - starting stack). Since both start with `stack`, net delta_i =
// (chips player i ends with) - stack. We compute SB's net delta; BB = -SB only
// when the pot is fully contested... but folds are NOT zero contribution, so we
// compute each player's net directly from contributions + who wins the pot.
//
// Let c0, c1 = contributions of SB, BB at the leaf; pot = c0 + c1.
//   net_i = (chips won from pot) - c_i.
//
//  (1) FOLD by player f: the OTHER player wins the whole pot.
//        winner gets `pot`, so net_winner = pot - c_winner = c_folder;
//        net_folder = 0   - c_folder = -c_folder.   (zero-sum: c_folder + (-c_folder)=0)
//
//  (2) ALL-IN that is CALLED (showdown-allin): both at risk for their contribution
//      (equal here, both = stack at a true all-in call, but we keep it general).
//      Over the full 5-card runout, SB wins with prob eqSB, ties split:
//        E[chips SB wins] = eqSB*pot + 0.5*tieProb*pot ... we fold ties into eqSB
//        by defining eqSB := P(SB wins) + 0.5*P(tie) (our equity matrix already
//        does this). Then E[net_SB] = eqSB*pot - c0;  E[net_BB] = (1-eqSB)*pot - c1.
//
//  (3) NON-all-in CALL that closes the action (showdown-preflop): the standard
//      PREFLOP-ONLY approximation — treat it as "checked down to showdown with no
//      further betting". Same formula as (2): E[net_i] = eq_i*pot - c_i, with the
//      BEHIND stacks (stack - c_i) simply retained (already part of `stack`, so they
//      cancel in net delta). An optional equity-realization factor R (default 1.0)
//      could tilt IP/OOP realisation; v1 keeps R=1.0. This is explicitly an
//      ESTIMATE (no postflop solving) — consistent with our "estimate, not exact
//      GTO" stance.
//
// Cases (2) and (3) use the SAME equity numbers (equity is equity at showdown);
// they differ only conceptually. Both are card-removal weighted via PAIR_WEIGHTS.
//
// =============================== ALGORITHM ====================================
// Vanilla CFR+ (regret-matching+, non-negative regret floor, linear-averaged
// strategy). The tree is tiny (a few dozen decision nodes), so we run many
// iterations cheaply. Deterministic: no randomness in the CFR loop; the only
// stochastic input is the (seeded) Monte-Carlo equity matrix, passed in.
//
// We run a full-tree traversal per iteration carrying, for each of the 169 hand
// classes the acting player could hold, the reach probability of the OPPONENT's
// range (a 169-vector) into this node. Counterfactual values are computed by
// summing over opponent classes weighted by (opponent reach * pair weight).

import { buildBetTree, type BetTreeConfig, type DecisionNode, type TreeNode } from './betTree';
import { PAIR_WEIGHTS } from './pairWeights';

const N = 169;

// --- Positional equity-realization edge (documented approximation) ---------------
// The pure preflop-equity model (cases 2/3) gives a CALLER full showdown equity with
// no further betting, which over-rewards calling and shrinks the opener's range to
// unrealistic levels (button "folding" too much). Real solvers price in postflop
// POSITION: the in-position player (the button / last aggressor) realizes MORE than
// raw equity, the out-of-position player LESS. We model this for NON-all-in
// "see-flop" terminals as a fixed equity-edge transfer toward the in-position player
// (here always player 0 = SB/button in the HU tree): eqSB_eff = eqSB + edge, which is
// zero-sum (BB loses the same). All-in terminals are NOT adjusted (no postflop play —
// equity is realized in full at showdown). Default chosen so HU ranges match known
// solver output (button opens a large majority); tune via solver options. This is an
// explicit, labeled approximation consistent with our "estimate, not exact GTO" stance.
export const DEFAULT_REALIZATION_EDGE = 0.085;

/** Shared terminal SB-net evaluator used by CFR, root-EV, and best-response. */
function terminalSbNetEx(
  leaf: Extract<TreeNode, { kind: 'terminal' }>,
  sbClass: number,
  bbClass: number,
  equity: Float64Array,
  realizationEdge: number,
): number {
  const c0 = leaf.contrib[0];
  const c1 = leaf.contrib[1];
  const pot = c0 + c1;
  if (leaf.outcome.type === 'fold') {
    // folder loses its contribution; winner nets the folder's contribution.
    return leaf.outcome.folder === 0 ? -c0 : c1; // SB net
  }
  const eqSB = equity[sbClass * N + bbClass];
  if (leaf.outcome.type === 'showdown-allin') {
    // all-in: equity realized in full at showdown, no positional adjustment.
    return eqSB * pot - c0;
  }
  // showdown-preflop (see-flop, stacks behind): transfer a fixed fraction of the pot
  // to the in-position player (player 0 / button). Zero-sum (BB loses edge*pot). This
  // is a flat positional premium, not hand-specific, which is the standard simple
  // realization model and avoids equity-clamping artifacts.
  return eqSB * pot - c0 + realizationEdge * pot;
}

export interface NodeStrategy {
  nodeId: number;
  label: string;
  toAct: 0 | 1;
  actionLabels: string[];
  /** strategy[classIndex][actionIndex] = frequency (sums to 1 over actions). */
  strategy: number[][];
  /** combo-weighted overall action frequency at this node (reach-weighted). */
  nodeActionFreq: number[];
  contrib: [number, number];
}

export interface PreflopCfrResult {
  nodes: NodeStrategy[];
  iterations: number;
  exploitabilityBbPerGame: number;
  exploitabilityMbbPer100: number;
  /** EV per player at the root (combo-weighted), in bb. Should be ~zero-sum. */
  evSb: number;
  evBb: number;
}

/** Per-decision-node CFR accumulators. */
interface NodeCfr {
  node: DecisionNode;
  nActions: number;
  // regret[class*nActions + a], strategySum[class*nActions + a]
  regret: Float64Array;
  strategySum: Float64Array;
}

/**
 * Normalised joint prior P(SB=i, BB=j) using card-removal-aware pair weights, times
 * optional per-side ENTERING-RANGE weights (the ranges that ARRIVE at the subgame).
 * `sbW[i]`/`bbW[j]` default to all-ones (full range). The PAIR_WEIGHTS factor keeps
 * proper combo/blocker weighting BETWEEN the two specific hands. Row-major [i*169+j].
 */
function buildJointPrior(sbW?: Float64Array, bbW?: Float64Array): Float64Array {
  const joint = new Float64Array(N * N);
  let total = 0;
  for (let i = 0; i < N; i++) {
    const wi = sbW ? sbW[i] : 1;
    if (wi <= 0) continue;
    for (let j = 0; j < N; j++) {
      const wj = bbW ? bbW[j] : 1;
      if (wj <= 0) continue;
      const v = PAIR_WEIGHTS[i * N + j] * wi * wj;
      joint[i * N + j] = v;
      total += v;
    }
  }
  if (total > 0) {
    for (let k = 0; k < N * N; k++) joint[k] /= total;
  }
  return joint;
}

export interface PreflopSolveOptions {
  /** positional equity-realization edge for see-flop terminals (see DEFAULT_REALIZATION_EDGE). */
  realizationEdge?: number;
  /**
   * Entering-range weight vectors (length 169, each in [0,1]) for the SB-side (player
   * 0) and BB-side (player 1) of the tree. These are the ranges that ARRIVE at the
   * subgame's root (the scenario builder's composite/entering ranges). Omit for the
   * full-range solve (E1 behavior). The hero side is full-range by default; the
   * composite-opponent side carries the combined assigned ranges.
   */
  sbRangeWeights?: Float64Array;
  bbRangeWeights?: Float64Array;
}

export function solvePreflopTree(
  config: BetTreeConfig,
  equity: Float64Array, // 169x169 SB-equity (row = hero), reused from equityMatrix
  iterations: number,
  options: PreflopSolveOptions = {},
): PreflopCfrResult {
  const realizationEdge = options.realizationEdge ?? DEFAULT_REALIZATION_EDGE;
  const tree = buildBetTree(config);
  const cfr: NodeCfr[] = tree.decisionNodes.map((node) => ({
    node,
    nActions: node.actions.length,
    regret: new Float64Array(N * node.actions.length),
    strategySum: new Float64Array(N * node.actions.length),
  }));
  // Map node id -> its array index in `cfr` (stable, fast; no indexOf in the hot loop).
  const idxById = new Map<number, number>();
  cfr.forEach((c, idx) => idxById.set(c.node.id, idx));

  const joint = buildJointPrior(options.sbRangeWeights, options.bbRangeWeights);

  // Scratch current-strategy buffer per node (recomputed each iter via regret-matching+).
  const curStrategy: Float64Array[] = cfr.map((c) => new Float64Array(N * c.nActions));

  // --- terminal value: SB net delta for (sbClass i, bbClass j) at a terminal leaf ---
  function terminalSbNet(leaf: Extract<TreeNode, { kind: 'terminal' }>, i: number, j: number): number {
    return terminalSbNetEx(leaf, i, j, equity, realizationEdge);
  }

  /**
   * Recursive CFR traversal.
   * @param node      current tree node
   * @param i, j      SB class, BB class (we fix both and integrate by reach outside? )
   *
   * To keep CFR correct AND fast over the 169-class game, we run the standard
   * "vector CFR" but here we instead iterate the OUTER product explicitly:
   * for each pair (i, j) weighted by the joint prior we walk the tree once,
   * propagating reach probabilities. Because the tree is tiny this is fast enough
   * and avoids subtle vectorisation bugs.
   *
   * Returns SB's expected net delta for this (i, j) under current strategies,
   * and accumulates regrets/strategySums weighted by the opponent's reach.
   *
   * reach0 = SB's reach prob to this node (product of SB action probs so far)
   * reach1 = BB's reach prob to this node.
   */
  function traverse(node: TreeNode, i: number, j: number, reach0: number, reach1: number): number {
    if (node.kind === 'terminal') {
      return terminalSbNet(node, i, j);
    }
    const ci = idxById.get(node.id)!;
    const c = cfr[ci];
    const sBuf = curStrategy[ci];
    const n = c.nActions;
    const isSb = node.toAct === 0;
    const myClass = isSb ? i : j;
    const myReach = isSb ? reach0 : reach1;
    const oppReach = isSb ? reach1 : reach0; // counterfactual reach (chance prior already folded in)
    const base = myClass * n;

    // child values for each action (SB net delta).
    const childVals = new Array<number>(n);
    let nodeVal = 0;
    for (let a = 0; a < n; a++) {
      const p = sBuf[base + a];
      const nr0 = isSb ? reach0 * p : reach0;
      const nr1 = isSb ? reach1 : reach1 * p;
      const v = traverse(node.children[a], i, j, nr0, nr1);
      childVals[a] = v;
      nodeVal += p * v;
    }

    // Accumulate regret (acting player's perspective) and strategy sum.
    // Acting player's utility of an action = SB-net if SB acts, else -SB-net.
    const sign = isSb ? 1 : -1;
    const nodeUtil = sign * nodeVal;
    for (let a = 0; a < n; a++) {
      const util = sign * childVals[a];
      // CFR+ : floor cumulative regret at 0.
      let r = c.regret[base + a] + oppReach * (util - nodeUtil);
      if (r < 0) r = 0;
      c.regret[base + a] = r;
      // strategy averaging weighted by this player's own reach to the info set.
      c.strategySum[base + a] += myReach * sBuf[base + a];
    }

    return nodeVal;
  }

  // Recompute current strategy for every node via regret-matching+.
  function computeStrategies() {
    for (let ci = 0; ci < cfr.length; ci++) {
      const c = cfr[ci];
      const n = c.nActions;
      const sBuf = curStrategy[ci];
      for (let k = 0; k < N; k++) {
        const base = k * n;
        let sum = 0;
        for (let a = 0; a < n; a++) sum += c.regret[base + a];
        if (sum > 0) {
          for (let a = 0; a < n; a++) sBuf[base + a] = c.regret[base + a] / sum;
        } else {
          const u = 1 / n;
          for (let a = 0; a < n; a++) sBuf[base + a] = u;
        }
      }
    }
  }

  // ---------------------------- CFR ITERATIONS ----------------------------
  // Each iteration: recompute current strategies (regret-matching+), then walk the
  // tree once per (SB class i, BB class j) pair, with the chance reach = joint prior
  // weight w folded into BOTH players' reach. The counterfactual reach used for
  // regret is the opponent's reach (which therefore already includes w). Strategy
  // sums are reach-weighted (vanilla averaging) — correct; CFR+ linear averaging
  // would only accelerate convergence and the tree is tiny.
  for (let t = 0; t < iterations; t++) {
    computeStrategies();
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const w = joint[i * N + j];
        if (w === 0) continue;
        traverse(tree.root, i, j, w, w);
      }
    }
  }

  return finalize(tree, cfr, equity, joint, iterations, realizationEdge);
}

/** Build the final averaged strategies + metrics. */
function finalize(
  tree: ReturnType<typeof buildBetTree>,
  cfr: NodeCfr[],
  equity: Float64Array,
  joint: Float64Array,
  iterations: number,
  realizationEdge: number,
): PreflopCfrResult {
  const nodes: NodeStrategy[] = [];
  // Average strategy per node from strategySum.
  const avg: Float64Array[] = cfr.map((c) => {
    const n = c.nActions;
    const a = new Float64Array(N * n);
    for (let k = 0; k < N; k++) {
      const base = k * n;
      let sum = 0;
      for (let x = 0; x < n; x++) sum += c.strategySum[base + x];
      if (sum > 0) {
        for (let x = 0; x < n; x++) a[base + x] = c.strategySum[base + x] / sum;
      } else {
        const u = 1 / n;
        for (let x = 0; x < n; x++) a[base + x] = u;
      }
    }
    return a;
  });

  // Map node id -> averaged data for tree walks.
  const avgById = new Map<number, { c: NodeCfr; avg: Float64Array; idx: number }>();
  cfr.forEach((c, idx) => avgById.set(c.node.id, { c, avg: avg[idx], idx }));

  // Compute, per node, the acting player's reach probability to that node BY CLASS,
  // under the final average strategy (integrating over the opponent's range via the
  // joint prior). This gives honest "how often does this range take each action"
  // node summaries, weighted by how often each class actually reaches the node.
  const reachByNodeClass = new Map<number, Float64Array>();
  for (const c of cfr) reachByNodeClass.set(c.node.id, new Float64Array(N));

  function accumulateReach(node: TreeNode, i: number, j: number, reachActing: number, w: number): void {
    if (node.kind === 'terminal') return;
    const entry = avgById.get(node.id)!;
    const n = entry.c.nActions;
    const isSb = node.toAct === 0;
    const myClass = isSb ? i : j;
    // The acting player reaches this node (with their class myClass) with prob
    // reachActing (their own action-prob product) times the opponent prior w.
    reachByNodeClass.get(node.id)![myClass] += w * reachActing;
    const base = myClass * n;
    for (let a = 0; a < n; a++) {
      const p = entry.avg[base + a];
      // descend: only the acting player's reach is multiplied by p.
      accumulateReach(node.children[a], i, j, reachActing * p, w);
    }
  }
  // Integrate over all (i, j): opponent prior handled by summing the joint over the
  // non-acting player. We pass reachActing=1 and weight by joint, so reachByNodeClass
  // ends up = sum_j P(i,j) * (acting reach), i.e. combo-weighted reach by acting class.
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const w = joint[i * N + j];
      if (w) accumulateReach(tree.root, i, j, 1, w);
    }

  for (let ci = 0; ci < cfr.length; ci++) {
    const c = cfr[ci];
    const n = c.nActions;
    const strategy: number[][] = [];
    const reach = reachByNodeClass.get(c.node.id)!;
    const nodeActionFreq = new Array<number>(n).fill(0);
    let reachTotal = 0;
    for (let k = 0; k < N; k++) {
      const base = k * n;
      const row: number[] = [];
      for (let a = 0; a < n; a++) row.push(avg[ci][base + a]);
      strategy.push(row);
      const rw = reach[k];
      reachTotal += rw;
      for (let a = 0; a < n; a++) nodeActionFreq[a] += rw * avg[ci][base + a];
    }
    if (reachTotal > 0) for (let a = 0; a < n; a++) nodeActionFreq[a] /= reachTotal;
    nodes.push({
      nodeId: c.node.id,
      label: c.node.label,
      toAct: c.node.toAct,
      actionLabels: c.node.actions.map((x) => x.label),
      strategy,
      nodeActionFreq,
      contrib: c.node.contrib,
    });
  }

  const evSb = computeRootEv(tree, avgById, equity, joint, realizationEdge);
  const expl = computeExploitability(tree, avgById, equity, joint, realizationEdge);

  return {
    nodes,
    iterations,
    exploitabilityBbPerGame: expl,
    exploitabilityMbbPer100: expl * 1000 * 100,
    evSb,
    evBb: -evSb, // fully contested zero-sum chip game: BB net = -SB net in expectation
  };
}

// --- Evaluate SB net EV at root under fixed average strategies (for zero-sum check). ---
function computeRootEv(
  tree: ReturnType<typeof buildBetTree>,
  avgById: Map<number, { c: NodeCfr; avg: Float64Array; idx: number }>,
  equity: Float64Array,
  joint: Float64Array,
  realizationEdge: number,
): number {
  function val(node: TreeNode, i: number, j: number): number {
    if (node.kind === 'terminal') {
      return terminalSbNetEx(node, i, j, equity, realizationEdge);
    }
    const entry = avgById.get(node.id)!;
    const n = entry.c.nActions;
    const myClass = node.toAct === 0 ? i : j;
    const base = myClass * n;
    let v = 0;
    for (let a = 0; a < n; a++) v += entry.avg[base + a] * val(node.children[a], i, j);
    return v;
  }
  let ev = 0;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const w = joint[i * N + j];
      if (w) ev += w * val(tree.root, i, j);
    }
  return ev;
}

/**
 * Exploitability = (SB best-response value) + (BB best-response value) measured as
 * each player's best-response gain over the value of the game, in bb/game.
 * We compute, for each player, the maximum achievable SB-net (or -SB-net) when that
 * player best-responds to the opponent's fixed average strategy. The sum of the two
 * best-response game values is >= 0; at equilibrium it is ~0.
 */
function computeExploitability(
  tree: ReturnType<typeof buildBetTree>,
  avgById: Map<number, { c: NodeCfr; avg: Float64Array; idx: number }>,
  equity: Float64Array,
  joint: Float64Array,
  realizationEdge: number,
): number {
  // exploitability = brValueSB + brValueBB. For a zero-sum game with value v, SB's
  // best response yields >= v and BB's yields >= -v; the sum of the two BR values is
  // the total exploitability (the game value cancels), ~0 at equilibrium.
  const brSB = bestResponseValue(tree, avgById, equity, joint, 0, realizationEdge);
  const brBB = bestResponseValue(tree, avgById, equity, joint, 1, realizationEdge);
  return Math.max(0, brSB + brBB);
}

/**
 * Best-response value for `hero` (0=SB,1=BB) against the opponent's average strategy.
 *
 * CRITICAL: the best response is an INFORMATION-SET best response — hero may only
 * condition on its OWN class + the public history, NEVER on the opponent's hidden
 * class. We therefore fix hero's class `i`, carry a VECTOR of opponent weights
 * oppW[j] = (joint prior for (i,j)) * (opponent reach to this node under avg), and:
 *   - at a HERO node: compute, for each action, the scalar value = sum_j oppW[j] *
 *     childValue, then pick the MAX action (a single choice for the whole info set).
 *   - at an OPPONENT node: split oppW[j] by the opponent's avg action prob for class
 *     j and sum the child contributions.
 *   - at a TERMINAL: return sum_j oppW[j] * heroNet(i, j).
 * Summing the root value over all hero classes i gives hero's best-response value.
 *
 * (A clairvoyant per-(i,j) max would wildly overestimate exploitability — that was a
 * bug; this info-set version is the correct CFR exploitability computation.)
 */
function bestResponseValue(
  tree: ReturnType<typeof buildBetTree>,
  avgById: Map<number, { c: NodeCfr; avg: Float64Array; idx: number }>,
  equity: Float64Array,
  joint: Float64Array,
  hero: 0 | 1,
  realizationEdge: number,
): number {
  const sign = hero === 0 ? 1 : -1; // hero net relative to SB-net

  // Returns hero's best-response value contribution at `node` for fixed hero class
  // `i`, given opponent-weight vector oppW (indexed by opponent class j).
  function val(node: TreeNode, i: number, oppW: Float64Array): number {
    if (node.kind === 'terminal') {
      let total = 0;
      for (let j = 0; j < N; j++) {
        const w = oppW[j];
        if (w === 0) continue;
        // map (hero class i, opp class j) -> (sbClass, bbClass) for the terminal eval.
        const sbClass = hero === 0 ? i : j;
        const bbClass = hero === 0 ? j : i;
        const sbNet = terminalSbNetEx(node, sbClass, bbClass, equity, realizationEdge);
        total += w * sign * sbNet;
      }
      return total;
    }

    const entry = avgById.get(node.id)!;
    const n = entry.c.nActions;

    if (node.toAct === hero) {
      // Hero picks ONE action for the whole info set: the max-value action.
      let best = -Infinity;
      for (let a = 0; a < n; a++) {
        const v = val(node.children[a], i, oppW);
        if (v > best) best = v;
      }
      return best;
    }

    // Opponent node: split oppW[j] by the opponent's avg action prob for class j.
    // Fresh vector per action (tree is tiny & BR runs once -> allocation is cheap).
    let total = 0;
    for (let a = 0; a < n; a++) {
      const childW = new Float64Array(N);
      for (let j = 0; j < N; j++) {
        const w = oppW[j];
        childW[j] = w === 0 ? 0 : w * entry.avg[j * n + a];
      }
      total += val(node.children[a], i, childW);
    }
    return total;
  }

  let total = 0;
  for (let i = 0; i < N; i++) {
    // opponent weight = joint prior P(i, j) (opponent reach at root = 1).
    const rootW = new Float64Array(N);
    for (let j = 0; j < N; j++) {
      rootW[j] = hero === 0 ? joint[i * N + j] : joint[j * N + i];
    }
    total += val(tree.root, i, rootW);
  }
  return total;
}
