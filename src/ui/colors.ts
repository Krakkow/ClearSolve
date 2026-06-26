// Color scale for strategy-frequency cells.
// freq 1.0 -> hot (red/orange), freq 0.0 -> cool/neutral (slate). Linear blend.

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const COLD: Rgb = { r: 42, g: 52, b: 66 }; // slate (fold)
const HOT: Rgb = { r: 220, g: 64, b: 52 }; // red (action 100%)
const MID: Rgb = { r: 224, g: 158, b: 50 }; // amber (mixed)

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function blend(a: Rgb, b: Rgb, t: number): Rgb {
  return { r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t) };
}

/** Frequency (0..1) -> CSS rgb string. Cold -> amber -> hot. */
export function freqColor(freq: number): string {
  const f = Math.max(0, Math.min(1, freq));
  let c: Rgb;
  if (f < 0.5) {
    c = blend(COLD, MID, f / 0.5);
  } else {
    c = blend(MID, HOT, (f - 0.5) / 0.5);
  }
  return `rgb(${c.r}, ${c.g}, ${c.b})`;
}

/** Pick readable text color (white on dark cells, near-black on bright ones). */
export function freqTextColor(freq: number): string {
  return freq > 0.55 ? '#1a1010' : '#e8eef5';
}

// ---------------------------------------------------------------------------
// Multi-action colors (GTO-Wizard-style stacked bars). Each action category gets
// a stable color so the same color always means the same kind of action.
//   Fold  = gray, Call = green, Raise/3bet/4bet = amber/orange, All-in = red.
// We map by the action LABEL text (which encodes its kind from betTree.ts).
// ---------------------------------------------------------------------------

const ACTION_FOLD = '#4b5563'; // gray
const ACTION_CHECK = '#3a7d8c'; // teal (check)
const ACTION_CALL = '#2f9e5e'; // green
const ACTION_RAISE = '#e0922e'; // amber/orange (open / raise)
const ACTION_3BET = '#e3781f'; // deeper orange (3-bet)
const ACTION_4BET = '#d85a1a'; // burnt orange (4-bet)
const ACTION_5BET = '#c94a2a'; // red-orange (5-bet)
const ACTION_ALLIN = '#dc4034'; // red (shove)

/**
 * Color for an action by its V2 poker label (ActionLabel) — e.g. "fold","check",
 * "call","raise","3bet","4bet","5bet","3bet-shove","shove". Falls back to matching
 * legacy bet-tree labels ("Open 2.5","All-in") for older views.
 */
export function actionColor(label: string): string {
  const l = label.toLowerCase();
  if (l.startsWith('fold')) return ACTION_FOLD;
  if (l.startsWith('check')) return ACTION_CHECK;
  if (l.startsWith('call')) return ACTION_CALL;
  if (l.includes('shove') || l.startsWith('all-in') || l === 'allin') return ACTION_ALLIN;
  if (l.startsWith('5bet') || l.startsWith('5-bet')) return ACTION_5BET;
  if (l.startsWith('4bet') || l.startsWith('4-bet')) return ACTION_4BET;
  if (l.startsWith('3bet') || l.startsWith('3-bet')) return ACTION_3BET;
  // open / raise / raise-big -> amber
  return ACTION_RAISE;
}

