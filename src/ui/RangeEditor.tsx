// Inline 13x13 range editor — lets the user override an opponent's assumed range.
// Cell (row r, col c) maps to handClass r*13+c: diagonal = pairs, upper-right = suited,
// lower-left = offsuit (the standard poker matrix). Click toggles a hand in/out.

import { HAND_CLASSES } from '../domain/handClasses';
import { rangeComboFraction } from '../domain/range169';
import './RangeEditor.css';

interface Props {
  /** 169 weights, each 0..1. */
  value: number[];
  onChange: (next: number[]) => void;
  onReset: () => void;
  onClose: () => void;
  title: string;
}

export function RangeEditor({ value, onChange, onReset, onClose, title }: Readonly<Props>) {
  const frac = rangeComboFraction(Float64Array.from(value));

  const toggle = (idx: number) => {
    const next = value.slice();
    next[idx] = next[idx] > 0 ? 0 : 1;
    onChange(next);
  };

  return (
    <div className="range-editor">
      <div className="re-head">
        <span className="re-title">{title}</span>
        <span className="re-frac">{(frac * 100).toFixed(1)}% of hands</span>
      </div>
      <div className="re-grid">
        {Array.from({ length: 13 }, (_, r) =>
          Array.from({ length: 13 }, (_, c) => {
            const idx = r * 13 + c;
            const w = value[idx] ?? 0;
            const on = w > 0;
            return (
              <button
                key={idx}
                type="button"
                className={`re-cell${on ? ' re-cell-on' : ''}`}
                style={on ? { opacity: 0.45 + 0.55 * w } : undefined}
                onClick={() => toggle(idx)}
                title={HAND_CLASSES[idx].label}
              >
                {HAND_CLASSES[idx].label}
              </button>
            );
          }),
        )}
      </div>
      <div className="re-actions">
        <button type="button" className="link-btn" onClick={onReset}>
          reset to default
        </button>
        <button type="button" className="re-done" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
