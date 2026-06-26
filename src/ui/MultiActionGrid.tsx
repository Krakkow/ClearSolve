// 13x13 multi-action strategy grid (GTO-Wizard-style). For the selected node, each
// of the 169 cells shows the hand's mixed strategy as a stacked color bar by action
// (using the V2 canonical actions + poker labels), proportional to frequency.

import { HAND_CLASSES } from '../domain/handClasses';
import { prettyLabel } from '../domain/actionLabels';
import { actionColor } from './colors';
import type { NodeStrategyV2 } from '../domain/spotV2';
import './MultiActionGrid.css';

type Hand = NodeStrategyV2['hands'][number];

interface Props {
  node: NodeStrategyV2;
  onHoverClass: (classIndex: number | null) => void;
  selectedClass: number | null;
}

export function MultiActionGrid({ node, onHoverClass, selectedClass }: Props) {
  return (
    <div
      className="ma-grid"
      role="grid"
      aria-label={`Strategy grid for ${node.label}`}
      onMouseLeave={() => onHoverClass(null)}
    >
      {HAND_CLASSES.map((hc) => {
        const hand = node.hands[hc.index];
        const selected = selectedClass === hc.index;
        return (
          <div
            key={hc.index}
            className={`ma-cell${selected ? ' ma-cell-selected' : ''}`}
            role="gridcell"
            title={tooltip(node, hc.label, hand)}
            onMouseEnter={() => onHoverClass(hc.index)}
          >
            <div className="ma-bars" aria-hidden>
              {node.actions.map((ca, a) => {
                const f = hand?.freqs[ca] ?? 0;
                if (f <= 0.0005) return null;
                return (
                  <span
                    key={a}
                    className="ma-bar"
                    style={{ width: `${f * 100}%`, backgroundColor: actionColor(node.actionLabels[a]) }}
                  />
                );
              })}
            </div>
            <span className="ma-label">{hc.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function tooltip(node: NodeStrategyV2, hand: string, h: Hand | undefined): string {
  const parts = node.actions
    .map((ca, a) => ({ label: prettyLabel(node.actionLabels[a]), f: h?.freqs[ca] ?? 0 }))
    .filter((p) => p.f > 0.0005)
    .map((p) => `${p.label} ${Math.round(p.f * 100)}%`);
  return `${hand} — ${parts.join('  ·  ')}`;
}
