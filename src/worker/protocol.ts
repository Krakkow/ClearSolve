// Web Worker message protocol (main thread <-> solver worker).
// Aligned with API_SPEC Sec 3: every message has a `type` and correlation `id`,
// and the protocol is versioned for mismatch detection.

import type {
  AnySolveResult,
  EngineInfo,
  SolveProgress,
  SolveRequest,
} from '../engine/types';

// v3 (API_SPEC Sec 7.4): SolveRequest gains the 'preflop-spot' mode (SpotConfigV2)
// and the result union widens to include SolveResultV2. (v2 added push-fold|bet-tree;
// v1 was push-fold only.) Bumping forces clean rejection of a stale worker/client pair.
export const PROTOCOL_VERSION = 3;

// Main -> Worker
export type WorkerRequest =
  | { type: 'init'; id: string; protocolVersion: number }
  | { type: 'solve'; id: string; protocolVersion: number; req: SolveRequest };

// Worker -> Main
export type WorkerMessage =
  | { type: 'ready'; id: string; info: EngineInfo }
  | { type: 'progress'; id: string; progress: SolveProgress }
  | { type: 'solved'; id: string; result: AnySolveResult }
  | { type: 'error'; id: string; error: WorkerError };

export interface WorkerError {
  code: 'invalid-input' | 'internal' | 'protocol-mismatch';
  message: string;
  recoverable: boolean;
}
