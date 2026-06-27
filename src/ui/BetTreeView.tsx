// Primary result view (E1): trust badge + node navigator + multi-action grid +
// node summary + per-hand side panel. Consumes the generalized SolveResultV2.

import { useMemo, useState } from 'react';
import { useStore } from '../app/store';
import { HAND_CLASSES } from '../domain/handClasses';
import { prettyLabel } from '../domain/actionLabels';
import { NodeNavigator } from './NodeNavigator';
import { MultiActionGrid } from './MultiActionGrid';
import { actionColor } from './colors';
import { describeNode } from './nodeLabels';
import type { NodeStrategyV2, SeatPosition, SolveResultV2 } from '../domain/spotV2';
import './BetTreeView.css';

export function BetTreeView({ result }: Readonly<{ result: SolveResultV2 }>) {
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const selectNode = useStore((s) => s.selectNode);
  const [hoverClass, setHoverClass] = useState<number | null>(null);

  // All inspectable nodes = hero node + downstream subtree, ordered by raiseDepth.
  const allNodes = useMemo(() => {
    const ns = [result.heroNode, ...(result.subtree ?? [])];
    return [...ns].sort((a, b) => a.raiseDepth - b.raiseDepth || a.nodeId - b.nodeId);
  }, [result]);

  const node = useMemo(
    () => allNodes.find((n) => n.nodeId === selectedNodeId) ?? result.heroNode,
    [allNodes, selectedNodeId, result.heroNode],
  );

  const expl = result.trust.exploitability;
  // Three fidelity tiers, driven by the trust label (not table size): a multiway TABLE
  // that folds to a single raiser is still a trustworthy heads-up-resolved solve.
  let tier: 'predefined' | 'live' | 'estimate' = 'estimate';
  if (result.trust.label === 'predefined') tier = 'predefined';
  else if (result.trust.label === 'live-solve') tier = 'live';
  const isEstimate = tier === 'estimate';
  const badgeText = { predefined: 'PREDEFINED CHART', live: 'LIVE SOLVE', estimate: 'ESTIMATE' }[tier];

  return (
    <section className="result">
      {/* Trust banner — prominent, honest. */}
      <div className={`trust-banner trust-${tier}`}>
        <span className={`badge badge-${tier}`}>{badgeText}</span>
        <span className="trust-caption">{result.trust.caption}</span>
      </div>

      <div className="result-header">
        <div className="badges">
          <span className="badge badge-depth">{result.spot.effectiveStackBb} bb</span>
          <span className="badge badge-mode">
            {result.spot.tableSize === 2 ? 'Heads-Up' : `${result.spot.tableSize}-handed`} ·{' '}
            {result.spot.heroPosition}
          </span>
        </div>
        <div className="metrics">
          {expl && (
            <Metric
              label="Exploitability (est.)"
              value={`${(expl.valueBbPerGame * 1000).toFixed(1)} mbb/g`}
              title="Best-response exploitability of the converged 2-player model. An estimate, not exact GTO."
            />
          )}
          {result.ev?.heroBb != null && (
            <Metric label="Hero EV" value={`${result.ev.heroBb.toFixed(3)} bb`} />
          )}
          <Metric label="Iterations" value={String(result.iterations)} />
          <Metric label="Solve time" value={`${Math.round(result.solveTimeMs)} ms`} />
        </div>
      </div>

      <NodeNavigator
        nodes={allNodes}
        heroNodeId={result.heroNode.nodeId}
        heroRaiseDepth={result.heroNode.raiseDepth}
        heroPosition={result.spot.heroPosition}
        selectedNodeId={node.nodeId}
        onSelect={selectNode}
      />

      <NodeSummary
        node={node}
        heroRaiseDepth={result.heroNode.raiseDepth}
        heroPosition={result.spot.heroPosition}
        stack={result.spot.effectiveStackBb}
      />
      <ActionLegend node={node} />

      <div className="tree-body">
        <div className="grid-col">
          <MultiActionGrid node={node} onHoverClass={setHoverClass} selectedClass={hoverClass} />
        </div>
        <HandPanel node={node} classIndex={hoverClass} />
      </div>

      {tier === 'predefined' ? (
        <p className="disclaimer">
          Served instantly from the bundled <strong>predefined library</strong> (~100bb).
          The badge caption above says whether this entry is a curated reference range or
          a solved-offline engine result. Off-grid spots (other depths, deeper nodes,
          custom ranges) fall back to a live solve.
        </p>
      ) : (
        <p className="disclaimer">
          Live CFR+ solve over the preflop raise tree (no postflop; "see-flop" terminals
          use the standard preflop-equity model with a positional realization edge).
          Equities from seeded Monte-Carlo (seed {result.seed}). Exploitability is an{' '}
          <em>estimate</em> of best-response gain on the 2-player model — not a claim of
          exact GTO{isEstimate ? ', and the multiway field is collapsed to one composite opponent' : ''}.
          {isEstimate && result.heroNode.raiseDepth === 0 && (
            <>
              {' '}
              <strong>Note:</strong> multiway opens are <em>position-calibrated</em>{' '}
              estimates — tightened for the number of players still to act behind you
              (a heuristic, not chart-exact). Facing-action spots (defense, cold-call,
              squeeze) use correct pot odds.
            </>
          )}
        </p>
      )}
    </section>
  );
}

function NodeSummary({
  node,
  heroRaiseDepth,
  heroPosition,
  stack,
}: Readonly<{ node: NodeStrategyV2; heroRaiseDepth: number; heroPosition: SeatPosition; stack: number }>) {
  const d = describeNode(node, heroRaiseDepth, heroPosition);
  const pot = node.contrib[0] + node.contrib[1];
  return (
    <div className="node-summary">
      <div className="ns-title">
        <strong>{d.title}</strong>
        {d.isHero && <span className="ns-your-turn"> — your decision</span>}
      </div>
      <div className="ns-context">
        Pot {pot.toFixed(1)}bb · stack {stack}bb
      </div>
      <div className="ns-freqs">
        {node.actions.map((ca, a) => (
          <span key={a} className="ns-chip">
            <span className="ns-swatch" style={{ background: actionColor(node.actionLabels[a]) }} />
            {prettyLabel(node.actionLabels[a])}{' '}
            <strong>{((node.nodeActionFreq[ca] ?? 0) * 100).toFixed(1)}%</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

function ActionLegend({ node }: Readonly<{ node: NodeStrategyV2 }>) {
  return (
    <div className="legend">
      <span className="legend-label">Actions:</span>
      {node.actions.map((_, a) => (
        <span key={a} className="legend-item">
          <span className="ns-swatch" style={{ background: actionColor(node.actionLabels[a]) }} />
          {prettyLabel(node.actionLabels[a])}
        </span>
      ))}
    </div>
  );
}

function HandPanel({
  node,
  classIndex,
}: Readonly<{ node: NodeStrategyV2; classIndex: number | null }>) {
  if (classIndex == null) {
    return (
      <aside className="hand-panel">
        <p className="hand-panel-hint">Hover a hand to see its exact mixed strategy.</p>
      </aside>
    );
  }
  const hc = HAND_CLASSES[classIndex];
  const hand = node.hands[classIndex];
  return (
    <aside className="hand-panel">
      <div className="hp-hand">{hc.label}</div>
      <div className="hp-kind">{hc.kind}</div>
      <div className="hp-rows">
        {node.actions.map((ca, a) => {
          const f = hand?.freqs[ca] ?? 0;
          const color = actionColor(node.actionLabels[a]);
          return (
            <div key={a} className="hp-row">
              <span className="ns-swatch" style={{ background: color }} />
              <span className="hp-action">{prettyLabel(node.actionLabels[a])}</span>
              <span className="hp-bar-track">
                <span className="hp-bar" style={{ width: `${f * 100}%`, background: color }} />
              </span>
              <span className="hp-pct">{(f * 100).toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function Metric({
  label,
  value,
  title,
}: Readonly<{ label: string; value: string; title?: string }>) {
  return (
    <div className="metric" title={title}>
      <span className="metric-value">{value}</span>
      <span className="metric-label">{label}</span>
    </div>
  );
}
