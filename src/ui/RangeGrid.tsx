// 13x13 strategy grid (FEAT-004). Standard poker layout: pairs on the diagonal,
// suited upper-right, offsuit lower-left, A top-left .. 2 bottom-right.

import { HAND_CLASSES } from '../domain/handClasses';
import { freqColor, freqTextColor } from './colors';
import './RangeGrid.css';

interface Props {
  title: string;
  /** length 169, indexed by classIndex (row*13+col). */
  freqs: number[];
  /** action verb shown in tooltips, e.g. "Jam" or "Call". */
  actionLabel: string;
}

export function RangeGrid({ title, freqs, actionLabel }: Props) {
  return (
    <div className="grid-wrap">
      <h3 className="grid-title">{title}</h3>
      <div className="grid" role="grid" aria-label={title}>
        {HAND_CLASSES.map((hc) => {
          const f = freqs[hc.index] ?? 0;
          const pct = Math.round(f * 100);
          return (
            <div
              key={hc.index}
              className="cell"
              role="gridcell"
              style={{ backgroundColor: freqColor(f), color: freqTextColor(f) }}
              title={`${hc.label} — ${actionLabel} ${pct}%`}
            >
              <span className="cell-label">{hc.label}</span>
              <span className="cell-freq">{pct}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
