// Engine helper — convert a solved bet-tree node (preflopCfr NodeStrategy) into a
// generalized NodeStrategyV2 with the CANONICAL action set + poker labels derived
// from raiseDepth (DATA_MODEL 13.4). Also builds the TrustInfo per the labeling
// rules (13.7 / coordinator honesty requirement).

import { labelFor } from '../domain/actionLabels';
import type { NodeStrategy } from '../domain/preflopCfr';
import type {
  ActionLabel,
  CanonicalAction,
  HandStrategyV2,
  NodeStrategyV2,
  SpotConfigV2,
  TrustInfo,
} from '../domain/spotV2';

/**
 * Map a bet-tree action LABEL (e.g. "Fold","Call","Open 2.5","3-Bet 11","All-in")
 * to a CanonicalAction. The tree offers at most one non-all-in raise per node in v1,
 * so every raise maps to 'raise-small' (no phantom 'raise-big').
 */
export function canonicalForTreeLabel(treeLabel: string): CanonicalAction {
  const l = treeLabel.toLowerCase();
  if (l.startsWith('fold')) return 'fold';
  if (l.startsWith('call')) return 'call';
  if (l.startsWith('all-in')) return 'allin';
  // open / 3-bet / 4-bet / raise -> the single non-all-in raise size
  return 'raise-small';
}

/**
 * Build a NodeStrategyV2 from a solved bet-tree node + the raiseDepth that node
 * represents for hero. `amountToCallBb` lets `call` render as `check` at 0.
 */
export function toNodeStrategyV2(
  node: NodeStrategy,
  raiseDepth: number,
  heroSeatIndex: number,
  amountToCallBb: number,
): NodeStrategyV2 {
  const canonicalActions: CanonicalAction[] = node.actionLabels.map(canonicalForTreeLabel);
  const labels: ActionLabel[] = canonicalActions.map((ca) =>
    labelFor(ca, raiseDepth, { amountToCallBb }),
  );

  const hands: HandStrategyV2[] = [];
  for (let k = 0; k < node.strategy.length; k++) {
    const freqs: Partial<Record<CanonicalAction, number>> = {};
    const labelMap: Partial<Record<CanonicalAction, ActionLabel>> = {};
    for (let a = 0; a < canonicalActions.length; a++) {
      const ca = canonicalActions[a];
      freqs[ca] = (freqs[ca] ?? 0) + node.strategy[k][a];
      labelMap[ca] = labels[a];
    }
    hands.push({ handClass: k, freqs, labels: labelMap });
  }

  const nodeActionFreq: Partial<Record<CanonicalAction, number>> = {};
  for (let a = 0; a < canonicalActions.length; a++) {
    const ca = canonicalActions[a];
    nodeActionFreq[ca] = (nodeActionFreq[ca] ?? 0) + node.nodeActionFreq[a];
  }

  // De-duplicate the canonical action order for display (preserve first occurrence).
  const seen = new Set<CanonicalAction>();
  const orderedActions: CanonicalAction[] = [];
  const orderedLabels: ActionLabel[] = [];
  for (let a = 0; a < canonicalActions.length; a++) {
    const ca = canonicalActions[a];
    if (seen.has(ca)) continue;
    seen.add(ca);
    orderedActions.push(ca);
    orderedLabels.push(labels[a]);
  }

  return {
    nodeId: node.nodeId,
    label: node.label,
    heroSeatIndex,
    raiseDepth,
    actions: orderedActions,
    actionLabels: orderedLabels,
    hands,
    nodeActionFreq,
    contrib: node.contrib,
  };
}

/** Context for the trust decision derived from the scenario projection. */
export interface TrustContext {
  /** live opponents hero contends with (in-pot + still-to-act behind). */
  liveOppCount: number;
  /** whether the opponent range was an ASSUMED default range (authored scenario). */
  assumedRanges: boolean;
}

/**
 * Build the first-class TrustInfo for a preflop-spot result. The fidelity tier is keyed
 * on how many live opponents hero actually faces (DATA_MODEL 13.7 / honesty rule):
 *  - exactly 1 live opponent: a trustworthy live solve of the genuine 2-player subgame.
 *    If that opponent's range was ASSUMED from the scenario defaults, the caption says
 *    so ("vs assumed range") — it's best play vs those ranges, not co-solved from scratch.
 *  - >=2 live opponents (genuine multiway): the field is collapsed to ONE composite
 *    opponent, so the result is an ESTIMATE — never "exact multiway GTO".
 * Never emits the words "exact GTO".
 */
export function buildTrustInfo(
  spot: SpotConfigV2,
  exploitabilityBbPerGame: number,
  ctx?: TrustContext,
): TrustInfo {
  const exploitability = {
    valueBbPerGame: exploitabilityBbPerGame,
    valueMbbPer100: exploitabilityBbPerGame * 1000 * 100,
    unit: 'bb/g' as const,
    measuredAtIteration: 0,
    label: 'estimate' as const,
  };
  const explStr = `${(exploitabilityBbPerGame * 1000).toFixed(1)} mbb/g`;
  // Fall back to the table-size heuristic if no scenario context is supplied.
  const liveOpps = ctx?.liveOppCount ?? (spot.tableSize === 2 ? 1 : spot.tableSize - 1);
  const assumed = ctx?.assumedRanges ?? false;

  if (liveOpps <= 1) {
    const vsAssumed = assumed ? ' vs assumed opponent range' : '';
    return {
      label: 'live-solve',
      caption: `Live solve — heads-up CFR+ equilibrium${vsAssumed} (exploitability estimate ${explStr}).`,
      exploitability,
      fieldModel: 'collapsed-2p',
      zeroSumValid: true,
    };
  }

  // Genuine multiway: collapsed to one composite opponent — labeled honestly as an
  // ESTIMATE (not exact multiway GTO).
  return {
    label: 'estimate-composite',
    caption:
      `Estimate — ${liveOpps} opponents collapsed to one composite range; ` +
      `not exact multiway GTO. Exploitability of the 2-player model: ${explStr}.`,
    exploitability,
    fieldModel: 'composite-field',
    zeroSumValid: true,
  };
}
