// Color-scale legend explaining the frequency gradient (NFR-008, AC-014).

import { freqColor } from './colors';

export function Legend() {
  const stops = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div className="legend">
      <span className="legend-label">Fold</span>
      <div className="legend-bar" aria-hidden>
        {Array.from({ length: 40 }, (_, i) => i / 39).map((f, i) => (
          <span
            key={i}
            className="legend-tick"
            style={{ backgroundColor: freqColor(f) }}
          />
        ))}
      </div>
      <span className="legend-label">Action</span>
      <div className="legend-scale">
        {stops.map((s) => (
          <span key={s}>{Math.round(s * 100)}%</span>
        ))}
      </div>
    </div>
  );
}
