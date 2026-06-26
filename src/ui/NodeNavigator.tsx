// Betting-tree node navigator: a line of buttons to pick which decision node to
// inspect. Nodes are labeled RELATIVE TO THE HERO (not the internal SB/BB tree names).
// The hero's own decision node is highlighted distinctly.

import { describeNode } from './nodeLabels';
import type { NodeStrategyV2, SeatPosition } from '../domain/spotV2';

interface Props {
  nodes: NodeStrategyV2[];
  heroNodeId: number;
  heroRaiseDepth: number;
  heroPosition: SeatPosition;
  selectedNodeId: number | null;
  onSelect: (id: number) => void;
}

export function NodeNavigator({
  nodes,
  heroNodeId,
  heroRaiseDepth,
  heroPosition,
  selectedNodeId,
  onSelect,
}: Props) {
  return (
    <div className="node-nav" role="tablist" aria-label="Betting-tree nodes">
      {nodes.map((n) => {
        const d = describeNode(n, heroRaiseDepth, heroPosition);
        const active = n.nodeId === selectedNodeId;
        const isHero = n.nodeId === heroNodeId;
        return (
          <button
            key={n.nodeId}
            role="tab"
            aria-selected={active}
            className={`node-btn${active ? ' node-btn-active' : ''} ${d.isHero ? 'node-side-hero' : 'node-side-opp'}`}
            onClick={() => onSelect(n.nodeId)}
            title={`${d.title} (pot ${(n.contrib[0] + n.contrib[1]).toFixed(1)}bb)`}
          >
            <span className="node-side">{d.isHero ? 'YOU' : 'OPP'}</span>
            <span className="node-label">{d.phase}</span>
            {isHero && <span className="node-hero" title="Your decision">★</span>}
          </button>
        );
      })}
    </div>
  );
}
