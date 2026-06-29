// Engine adapter — pure-TypeScript HU preflop solver implementing the SolverEngine
// port (engine/types.ts). It dispatches on SolveRequest.mode:
//   - 'push-fold'   : the original jam/fold fictitious-play solver (fast, degenerate).
//   - 'bet-tree'    : CFR+ over the configurable HU raise tree (v1 slice).
//   - 'preflop-spot': E1 — generalized SpotConfigV2 (2-9 players cash) PROJECTED to a
//     2-player BetTreeConfig (DATA_MODEL 13.9) and solved with the SAME CFR+ core.
//
// All modes share the SAME heavy step — building the 169x169 all-in equity matrix
// (reused) — and the SAME worker wiring. This is the INTERIM engine; a future
// Rust->WASM engine implements the same interface and replaces it without UI/worker
// changes.

import { getEquityBuilder } from './equityProvider';
import { solvePushFold } from '../domain/pushfold';
import { getCfrSolver } from './cfrProvider';
import { DEFAULT_SIZES } from '../domain/betTree';
import { projectToBetTreeConfig } from '../domain/projectSpot';
import { classStrength, skewByField, classPlayability, penalizeHeroRealization } from '../domain/multiway';
import { toNodeStrategyV2, buildTrustInfo } from './resultV2';

/**
 * Strength-skew exponent for the multiway composite opponent. Calibrated so a multiway BB
 * cold-call (open + callers, 200bb) folds the weak OFFSUIT instead of continuing ~all —
 * see domain/multiway.ts and DEC-008. Effective power = exponent * (fieldSize - 1).
 */
const FIELD_SKEW_EXPONENT = 4.0;

/**
 * See-flop realization haircut per extra opponent for multiway DEFENSE (on top of the
 * skew). Effective k = this * (fieldSize - 1); calibrated so weak SUITED hands fold in a
 * 3-way pot while genuinely playable hands keep calling. See DEC-008.
 */
const FIELD_REALIZATION_PENALTY_PER_OPP = 0.02;
import type {
  AnySolveResult,
  EngineInfo,
  PreflopTreeSolveResult,
  PushFoldSolveResult,
  SolveProgress,
  SolveRequest,
  SolverEngine,
  SolveResultV2,
  SolveSettings,
  SpotConfigV2,
} from './types';

export const ENGINE_VERSION = 'ts-preflop-0.3.0';

export class PreflopEngine implements SolverEngine {
  info(): EngineInfo {
    const coi =
      typeof globalThis !== 'undefined' &&
      (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated === true;
    return {
      engineVersion: ENGINE_VERSION,
      engineKind: 'ts',
      threading: 'single',
      crossOriginIsolated: coi,
      deterministic: true,
    };
  }

  async solve(
    req: SolveRequest,
    onProgress: (p: SolveProgress) => void,
  ): Promise<AnySolveResult> {
    const start = nowMs();
    const { settings } = req;

    // Shared heavy step: build the 169x169 all-in equity matrix (deterministic). Uses
    // the injected builder — Rust/WASM in the worker, TS elsewhere (equityProvider).
    onProgress({ phase: 'building-equity', fraction: 0 });
    const equity = await getEquityBuilder()(settings.equitySamples, settings.seed, (p) => {
      onProgress({ phase: 'building-equity', fraction: p.done / p.total });
    });

    if (req.mode === 'push-fold') {
      return this.solvePushFoldMode(req.spot, settings, equity, start, onProgress);
    }
    if (req.mode === 'bet-tree') {
      return this.solveBetTreeMode(req.spot, settings, equity, start, onProgress);
    }
    return this.solvePreflopSpotMode(req.spot, settings, equity, start, onProgress);
  }

  private solvePushFoldMode(
    spot: PushFoldSolveResult['spot'],
    settings: PushFoldSolveResult['settings'],
    equity: Float64Array,
    start: number,
    onProgress: (p: SolveProgress) => void,
  ): PushFoldSolveResult {
    onProgress({ phase: 'solving', fraction: 0 });
    const solved = solvePushFold(spot.effectiveStackBb, equity, settings.iterations);
    onProgress({ phase: 'solving', fraction: 1, iterations: solved.iterations });
    onProgress({ phase: 'computing-exploitability', fraction: 1 });

    return {
      mode: 'push-fold',
      source: 'live',
      spot,
      settings,
      strategy: {
        sbJam: Array.from(solved.sbJam),
        bbCall: Array.from(solved.bbCall),
      },
      sbJamFraction: solved.sbJamFraction,
      bbCallFraction: solved.bbCallFraction,
      exploitability: {
        valueBbPerGame: solved.exploitabilityBbPerGame,
        valueMbbPer100: solved.exploitabilityMbbPer100,
        unit: 'bb/g',
        measuredAtIteration: solved.iterations,
        label: 'estimate',
      },
      iterations: solved.iterations,
      converged: true,
      seed: settings.seed,
      generatedAt: new Date().toISOString(),
      engineVersion: ENGINE_VERSION,
      solveTimeMs: nowMs() - start,
    };
  }

  private async solveBetTreeMode(
    spot: PreflopTreeSolveResult['spot'],
    settings: PreflopTreeSolveResult['settings'],
    equity: Float64Array,
    start: number,
    onProgress: (p: SolveProgress) => void,
  ): Promise<PreflopTreeSolveResult> {
    onProgress({ phase: 'solving', fraction: 0 });
    const sizes = spot.sizes ?? DEFAULT_SIZES;
    const result = await getCfrSolver()(
      {
        smallBlind: spot.smallBlindBb,
        bigBlind: spot.bigBlindBb,
        stack: spot.effectiveStackBb,
        openTo: sizes.openTo,
        threeBetTo: sizes.threeBetTo,
        fourBetTo: sizes.fourBetTo,
      },
      equity,
      settings.iterations,
    );
    onProgress({ phase: 'solving', fraction: 1, iterations: result.iterations });
    onProgress({ phase: 'computing-exploitability', fraction: 1 });

    return {
      mode: 'bet-tree',
      source: 'live',
      spot,
      settings,
      nodes: result.nodes,
      exploitability: {
        valueBbPerGame: result.exploitabilityBbPerGame,
        valueMbbPer100: result.exploitabilityMbbPer100,
        unit: 'bb/g',
        measuredAtIteration: result.iterations,
        label: 'estimate',
      },
      evSb: result.evSb,
      evBb: result.evBb,
      iterations: result.iterations,
      converged: true,
      seed: settings.seed,
      generatedAt: new Date().toISOString(),
      engineVersion: ENGINE_VERSION,
      solveTimeMs: nowMs() - start,
    };
  }

  /**
   * E1 — solve a generalized SpotConfigV2 by projecting it to a 2-player
   * BetTreeConfig (DATA_MODEL 13.9), running the SAME CFR+ core, then emitting a
   * SolveResultV2 with first-class trust labeling.
   */
  private async solvePreflopSpotMode(
    spot: SpotConfigV2,
    settings: SolveSettings,
    equity: Float64Array,
    start: number,
    onProgress: (p: SolveProgress) => void,
  ): Promise<SolveResultV2> {
    onProgress({ phase: 'building-tree', fraction: 1 });
    const proj = projectToBetTreeConfig(spot);

    onProgress({ phase: 'solving', fraction: 0 });
    // Feed the composite opponent's entering range into the correct tree side so the
    // solve is conditioned on the authored scenario (the ranges arriving at the node).
    // For a MULTIWAY pot (>=2 in-pot opponents), skew that composite toward stronger hands
    // — an approximation of the "best of N" hero must beat — so multiway cold-call/defense
    // ranges fold the bottom instead of continuing ~everything (see domain/multiway.ts).
    const rangeOpts: {
      sbRangeWeights?: Float64Array;
      bbRangeWeights?: Float64Array;
      realizationEdge?: number;
    } = {};
    const multiway = proj.compositeOppCount >= 2;
    if (proj.oppRangeWeights !== undefined) {
      const oppRange = multiway
        ? skewByField(proj.oppRangeWeights, classStrength(equity), proj.compositeOppCount, FIELD_SKEW_EXPONENT)
        : proj.oppRangeWeights;
      if (proj.oppSide === 0) rangeOpts.sbRangeWeights = oppRange;
      else rangeOpts.bbRangeWeights = oppRange;
    }
    if (proj.realizationEdge !== undefined) rangeOpts.realizationEdge = proj.realizationEdge;

    // Multiway DEFENSE (hero = BB responder) also over-realizes weak SUITED hands (the
    // see-flop terminal credits their full flush/straight equity, which they don't get OOP
    // multiway). Give those a per-hand realization haircut, scaled by the field size, so
    // they fold too — not just the weak offsuit. Responder-only (penalty is on the BB col);
    // opens are untouched.
    let solveEquity = equity;
    if (multiway && proj.heroSide === 'responder') {
      const k = FIELD_REALIZATION_PENALTY_PER_OPP * (proj.compositeOppCount - 1);
      solveEquity = penalizeHeroRealization(equity, classPlayability(), k);
    }
    const result = await getCfrSolver()(proj.config, solveEquity, settings.iterations, rangeOpts);
    onProgress({ phase: 'solving', fraction: 1, iterations: result.iterations });
    onProgress({ phase: 'computing-exploitability', fraction: 1 });

    // Select hero's decision node from the solved tree by its raiseDepth/label.
    const heroNodeRaw =
      result.nodes.find((n) => n.label === proj.heroNodeLabel) ?? result.nodes[0];

    // amount hero must call at this node = (max contribution so far) - hero's contribution.
    const heroContrib = proj.heroSide === 'aggressor'
      ? heroNodeRaw.contrib[0]
      : heroNodeRaw.contrib[1];
    const maxContrib = Math.max(heroNodeRaw.contrib[0], heroNodeRaw.contrib[1]);
    const amountToCallBb = Math.max(0, maxContrib - heroContrib);

    const heroNode = toNodeStrategyV2(
      heroNodeRaw,
      proj.heroRaiseDepth,
      proj.heroSeatIndex,
      amountToCallBb,
    );

    // Downstream nodes (continuations) for the navigator — labeled by their depth.
    const depthByLabel: Record<string, number> = {
      'SB Open': 0,
      'BB vs Open': 1,
      'SB vs 3-bet': 2,
      'BB vs 4-bet': 3,
      'SB vs 5-bet jam': 4,
    };
    // Continuation navigator: only meaningful for an OPEN (hero opens, then we can show
    // "if you get 3-bet…" etc.). For a RESPONDER spot the other tree nodes are artifacts
    // of the 2-player reduction (the opponent's "open" is really the bet hero faces), so
    // showing them mislabels the line — collapse to just hero's decision.
    const subtree =
      proj.heroSide === 'aggressor'
        ? result.nodes
            .filter((n) => n.nodeId !== heroNodeRaw.nodeId)
            .map((n) => {
              const d = depthByLabel[n.label] ?? 0;
              const hc = d % 2 === 0 ? n.contrib[0] : n.contrib[1];
              const mc = Math.max(n.contrib[0], n.contrib[1]);
              return toNodeStrategyV2(n, d, proj.heroSeatIndex, Math.max(0, mc - hc));
            })
        : [];

    const trust = buildTrustInfo(spot, result.exploitabilityBbPerGame, {
      liveOppCount: proj.liveOppCount,
      assumedRanges: proj.assumedRanges,
    });
    trust.exploitability!.measuredAtIteration = result.iterations;

    return {
      schemaVersion: 2,
      mode: 'preflop-spot',
      source: 'live',
      trust,
      spot,
      settings,
      heroNode,
      subtree,
      ev: { heroBb: proj.heroSide === 'aggressor' ? result.evSb : result.evBb, unit: 'bb' },
      iterations: result.iterations,
      converged: true,
      seed: settings.seed,
      generatedAt: new Date().toISOString(),
      engineVersion: ENGINE_VERSION,
      solveTimeMs: nowMs() - start,
    };
  }
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
