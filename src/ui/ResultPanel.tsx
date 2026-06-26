// Result panel: dispatches on solve status; renders the bet-tree view on success.

import { useStore } from '../app/store';
import { BetTreeView } from './BetTreeView';

export function ResultPanel() {
  const status = useStore((s) => s.status);
  const result = useStore((s) => s.result);
  const progress = useStore((s) => s.progress);
  const error = useStore((s) => s.error);

  if (status === 'error') {
    return (
      <section className="panel">
        <p className="error">Solve failed: {error}</p>
      </section>
    );
  }

  if (status === 'solving') {
    const pct = progress ? Math.round(progress.fraction * 100) : 0;
    let phaseLabel = 'Estimating exploitability';
    if (progress?.phase === 'building-equity') phaseLabel = 'Computing all-in equities (Monte Carlo)';
    else if (progress?.phase === 'building-tree') phaseLabel = 'Projecting spot & building tree';
    else if (progress?.phase === 'solving') phaseLabel = 'Solving preflop tree (CFR+)';
    return (
      <section className="panel">
        <p className="solving-label">{phaseLabel}…</p>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </section>
    );
  }

  if (status === 'idle' || !result) {
    return (
      <section className="panel">
        <p className="hint">
          Configure the table (size, hero position, stack depth, decision node) and
          press <strong>Solve</strong>. Heads-up is a trustworthy live solve; multiway
          is a clearly-labeled 2-player estimate (field collapsed to one opponent).
        </p>
      </section>
    );
  }

  return <BetTreeView result={result} />;
}
