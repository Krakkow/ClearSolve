// Config panel — game type, table size, hero position, stack depth, and the full
// PREFLOP SCENARIO editor: assign each seat acting before the hero an action
// (fold / limp / call / raise-to-X / all-in) to recreate the exact spot. The hero's
// decision node and the opponents' (default) entering ranges follow from the scenario.

import { useState } from 'react';
import {
  useStore,
  scenarioSeats,
  buildSpot,
  positionsAfterHero,
  QUALITY_PRESETS,
  type ScenarioSeat,
  type SolveQuality,
} from '../app/store';
import { validPositions } from '../domain/seatLayout';
import { defaultRangeForSeat } from '../domain/projectSpot';
import { RangeEditor } from './RangeEditor';
import type { PriorActionKind, SeatPosition, SpotConfigV2, TableSize } from '../domain/spotV2';

const TABLE_SIZES: TableSize[] = [2, 3, 4, 5, 6, 7, 8, 9];

/** Outstanding bet (bb) faced at each seat, walking the authored actions in order. */
function withBetContext(seats: ScenarioSeat[]): { seat: ScenarioSeat; currentBet: number }[] {
  let bet = 1; // big blind
  const out: { seat: ScenarioSeat; currentBet: number }[] = [];
  for (const seat of seats) {
    out.push({ seat, currentBet: bet });
    if (seat.role === 'before' && (seat.action.kind === 'raise' || seat.action.kind === 'allin')) {
      bet = Math.max(bet, seat.action.toBb ?? bet);
    }
  }
  return out;
}

function postedBlind(position: SeatPosition): number {
  if (position === 'SB') return 0.5;
  if (position === 'BB') return 1;
  return 0;
}

function ScenarioRow({
  seat,
  currentBet,
  spot,
}: Readonly<{ seat: ScenarioSeat; currentBet: number; spot: SpotConfigV2 }>) {
  const setSeatAction = useStore((s) => s.setSeatAction);
  const setSeatRaiseTo = useStore((s) => s.setSeatRaiseTo);
  const setSeatRange = useStore((s) => s.setSeatRange);
  const solving = useStore((s) => s.status === 'solving');
  const [editing, setEditing] = useState(false);

  if (seat.role === 'hero') {
    return (
      <div className="scn-row scn-row-hero">
        <span className="scn-pos">{seat.position}</span>
        <span className="scn-hero-tag">HERO — you decide{currentBet > 1 ? ` (facing ${currentBet}bb)` : ''}</span>
      </div>
    );
  }
  if (seat.role === 'behind') {
    return (
      <div className="scn-row scn-row-behind">
        <span className="scn-pos">{seat.position}</span>
        <span className="scn-behind-tag">yet to act</span>
      </div>
    );
  }

  // role 'before': an authorable action.
  const facingBet = currentBet > 1;
  const kind = seat.action.kind;
  const isLive = kind !== 'fold';
  const hasOverride = Array.isArray(seat.action.range);
  const opts: { value: PriorActionKind; label: string }[] = [
    { value: 'fold', label: 'Fold' },
    facingBet ? { value: 'call', label: `Call ${currentBet}` } : { value: 'limp', label: 'Limp' },
    { value: 'raise', label: 'Raise to' },
    { value: 'allin', label: 'All-in' },
  ];

  const editorValue =
    seat.action.range ??
    Array.from(defaultRangeForSeat(spot, seat.seatIndex) ?? new Float64Array(169).fill(1));

  return (
    <div className={`scn-row-wrap${isLive ? ' scn-live-wrap' : ''}`}>
      <div className={`scn-row scn-row-${kind === 'fold' ? 'fold' : 'live'}`}>
        <span className="scn-pos">{seat.position}</span>
        <select
          className="scn-action"
          value={kind}
          disabled={solving}
          onChange={(e) => setSeatAction(seat.seatIndex, e.target.value as PriorActionKind)}
        >
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {kind === 'raise' && (
          <input
            className="scn-raise-to"
            type="number"
            min={Math.ceil(currentBet * 2)}
            step={0.5}
            value={seat.action.toBb ?? ''}
            disabled={solving}
            onChange={(e) => setSeatRaiseTo(seat.seatIndex, Number(e.target.value))}
          />
        )}
        {kind === 'raise' && <span className="scn-bb">bb</span>}
        {isLive && (
          <button
            type="button"
            className="scn-range-btn"
            disabled={solving}
            onClick={() => setEditing((v) => !v)}
            title="Edit this player's assumed range"
          >
            range{hasOverride ? ' ✎' : ''}
          </button>
        )}
      </div>
      {isLive && editing && (
        <RangeEditor
          title={`${seat.position} ${kind} range`}
          value={editorValue}
          onChange={(next) => setSeatRange(seat.seatIndex, next)}
          onReset={() => {
            setSeatRange(seat.seatIndex, undefined);
            setEditing(false);
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

export function SpotConfig() {
  const gameMode = useStore((s) => s.gameMode);
  const setGameMode = useStore((s) => s.setGameMode);
  const tableSize = useStore((s) => s.tableSize);
  const setTableSize = useStore((s) => s.setTableSize);
  const heroPosition = useStore((s) => s.heroPosition);
  const setHeroPosition = useStore((s) => s.setHeroPosition);
  const stackBb = useStore((s) => s.stackBb);
  const setStackBb = useStore((s) => s.setStackBb);
  const seatActions = useStore((s) => s.seatActions);
  const resetScenario = useStore((s) => s.resetScenario);
  const heroMode = useStore((s) => s.heroMode);
  const setHeroMode = useStore((s) => s.setHeroMode);
  const threeBettor = useStore((s) => s.threeBettor);
  const setThreeBettor = useStore((s) => s.setThreeBettor);
  const quality = useStore((s) => s.quality);
  const setQuality = useStore((s) => s.setQuality);
  const solve = useStore((s) => s.solve);
  const status = useStore((s) => s.status);
  const solving = status === 'solving';
  const tbOptions = positionsAfterHero(tableSize, heroPosition);

  const positions = validPositions(tableSize);
  const seats = scenarioSeats(tableSize, heroPosition, seatActions);
  const rows = withBetContext(seats);
  // Current spot (cheap to build) — used to seed each opponent's default range editor.
  const spot = buildSpot(gameMode, tableSize, heroPosition, stackBb, seatActions);

  // Live pot + how many opponents hero contends with (in-pot live + still to act).
  let pot = 0;
  let liveOpps = 0;
  for (const { seat, currentBet } of rows) {
    pot += postedBlind(seat.position);
    if (seat.role === 'behind') liveOpps++;
    if (seat.role !== 'before') continue;
    const a = seat.action;
    if (a.kind === 'fold') continue;
    liveOpps++;
    if (a.kind === 'raise' || a.kind === 'allin') pot += (a.toBb ?? currentBet) - postedBlind(seat.position);
    else if (a.kind === 'call') pot += currentBet - postedBlind(seat.position);
    else pot += 1 - postedBlind(seat.position); // limp
  }
  const heroRow = rows.find((r) => r.seat.role === 'hero');
  const heroFacing = heroRow ? heroRow.currentBet : 1;
  const heroToCall = Math.max(0, heroFacing - postedBlind(heroPosition));

  return (
    <section className="panel config-panel">
      <h2 className="panel-title">Spot</h2>

      <div className="field-row">
        <div className="field">
          <label htmlFor="gameType">Game type</label>
          <select
            id="gameType"
            value={gameMode}
            disabled={solving}
            onChange={(e) => setGameMode(e.target.value as 'cash' | 'tournament')}
          >
            <option value="cash">Cash (chip-EV)</option>
            <option value="tournament" disabled>
              Tournament / ICM — coming soon
            </option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="tableSize">Table size</label>
          <select
            id="tableSize"
            value={tableSize}
            disabled={solving}
            onChange={(e) => setTableSize(Number(e.target.value) as TableSize)}
          >
            {TABLE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n === 2 ? '2 (Heads-Up)' : `${n}-handed`}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="heroPos">Hero position</label>
          <select
            id="heroPos"
            value={heroPosition}
            disabled={solving}
            onChange={(e) => setHeroPosition(e.target.value as SeatPosition)}
          >
            {positions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="stack-control">
        <label htmlFor="stack">
          Effective stack: <strong>{stackBb} bb</strong>
        </label>
        <input
          id="stack"
          type="range"
          min={2}
          max={1000}
          step={1}
          value={stackBb}
          disabled={solving}
          onChange={(e) => setStackBb(Number(e.target.value))}
        />
        <div className="stack-presets">
          {[10, 20, 40, 100, 200, 500].map((d) => (
            <button
              key={d}
              type="button"
              className={`chip-btn${stackBb === d ? ' chip-btn-active' : ''}`}
              disabled={solving}
              onClick={() => setStackBb(d)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="mode-toggle">
        <button
          type="button"
          className={`mode-btn${heroMode === 'respond' ? ' mode-btn-active' : ''}`}
          disabled={solving}
          onClick={() => setHeroMode('respond')}
        >
          Respond to action
        </button>
        <button
          type="button"
          className={`mode-btn${heroMode === 'open-vs-3bet' ? ' mode-btn-active' : ''}`}
          disabled={solving}
          onClick={() => setHeroMode('open-vs-3bet')}
        >
          Hero opened, vs 3-bet
        </button>
      </div>

      {heroMode === 'respond' ? (
        <div className="scenario">
          <div className="scenario-head">
            <span className="scenario-title">Action before hero</span>
            <button type="button" className="link-btn" disabled={solving} onClick={resetScenario}>
              reset (fold to hero)
            </button>
          </div>
          <p className="scenario-note">
            Set what each seat did. Opponents use sensible default ranges for their action
            (editable later). Seats acting after the hero are still to act.
          </p>
          <div className="scenario-list">
            {rows.map(({ seat, currentBet }) => (
              <ScenarioRow key={seat.seatIndex} seat={seat} currentBet={currentBet} spot={spot} />
            ))}
          </div>
          <div className="scenario-summary">
            <span>Pot: <strong>{pot.toFixed(1)}bb</strong></span>
            <span>Hero to call: <strong>{heroToCall.toFixed(1)}bb</strong></span>
            <span>Live opponents: <strong>{liveOpps}</strong></span>
          </div>
        </div>
      ) : (
        <div className="scenario">
          <p className="scenario-note">
            Hero ({heroPosition}) opens, folds around, then a 3-bet comes back. Pick who
            3-bet — hero's response (fold / call / 4-bet) is solved.
          </p>
          {tbOptions.length === 0 ? (
            <p className="field-note">
              {heroPosition} acts last, so no one can 3-bet it. Pick an earlier hero position.
            </p>
          ) : (
            <div className="field">
              <label htmlFor="threeBettor">3-bet from</label>
              <select
                id="threeBettor"
                value={threeBettor}
                disabled={solving}
                onChange={(e) => setThreeBettor(e.target.value as SeatPosition)}
              >
                {tbOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <div className="field quality-field">
        <label htmlFor="quality">
          <span>Solve quality</span>{' '}
          <button
            type="button"
            className="info-badge"
            aria-label="About solve quality"
            title={
              'How hard the solver works on this spot.\n\n' +
              `Fast — ${QUALITY_PRESETS.fast.blurb}\n` +
              `Balanced — ${QUALITY_PRESETS.balanced.blurb}\n` +
              `Max — ${QUALITY_PRESETS.max.blurb}\n\n` +
              'It does NOT add more hands — every solve already covers all 169 starting ' +
              "hands at once. It only sets how precise this spot's answer is: more " +
              'iterations get closer to equilibrium, more equity samples reduce noise. ' +
              'Predefined chart spots load instantly and ignore this.'
            }
          >
            ⓘ
          </button>
        </label>
        <select
          id="quality"
          value={quality}
          disabled={solving}
          onChange={(e) => setQuality(e.target.value as SolveQuality)}
        >
          {(Object.keys(QUALITY_PRESETS) as SolveQuality[]).map((q) => (
            <option key={q} value={q}>
              {QUALITY_PRESETS[q].label} — {QUALITY_PRESETS[q].blurb}
            </option>
          ))}
        </select>
      </div>

      <button
        className="solve-btn"
        onClick={() => void solve()}
        disabled={solving || (heroMode === 'open-vs-3bet' && tbOptions.length === 0)}
      >
        {solving ? 'Solving…' : 'Solve'}
      </button>
    </section>
  );
}
