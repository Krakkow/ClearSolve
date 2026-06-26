// UI helper — translate the internal 2-player tree node (whose labels are heads-up
// "SB Open / BB vs Open / SB vs 3-bet …" plumbing) into a SCENARIO-RELATIVE label
// expressed in terms of the HERO and the (collapsed) OPPONENT. The internal solver
// names the first-to-act side "SB" and the responder "BB"; those are NOT the real
// blinds, so we never surface them to the user.

import type { NodeStrategyV2, SeatPosition } from '../domain/spotV2';

// What the player acting AT this node is doing, by betting depth.
const PHASE: Record<number, string> = {
  0: 'opens (first in)',
  1: 'vs the open',
  2: 'vs a 3-bet',
  3: 'vs a 4-bet',
  4: 'vs a 5-bet jam',
};

export interface NodeDescription {
  isHero: boolean;
  who: string; // "Hero (CO)" or "Opponent"
  phase: string; // "opens (first in)", "vs a 3-bet", …
  title: string; // combined, e.g. "Hero (CO) — opens (first in)"
  short: string; // compact label for the navigator chip
}

/**
 * Describe a node relative to the hero. A node is a HERO decision when its betting
 * depth has the same parity as the hero's own decision node (the 2-player tree
 * alternates aggressor/responder by depth).
 */
export function describeNode(
  node: NodeStrategyV2,
  heroRaiseDepth: number,
  heroPosition: SeatPosition,
): NodeDescription {
  const isHero = node.raiseDepth % 2 === heroRaiseDepth % 2;
  const who = isHero ? `Hero (${heroPosition})` : 'Opponent';
  const phase = PHASE[node.raiseDepth] ?? `depth ${node.raiseDepth}`;
  return {
    isHero,
    who,
    phase,
    title: `${who} — ${phase}`,
    short: `${isHero ? heroPosition : 'Opp'} ${phase.replace(' (first in)', '')}`,
  };
}
