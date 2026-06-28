// Solver Web Worker entry. Runs the TS preflop engine off the main thread so
// the UI stays responsive during the (CPU-heavy) Monte Carlo equity build + CFR.
// Throttles progress events to protect the main thread (API_SPEC Sec 3 rule).

import { PreflopEngine } from '../engine/preflopEngine';
import { setEquityBuilder } from '../engine/equityProvider';
import { buildEquityMatrix } from '../domain/equityMatrix';
import { buildEquityMatrixWasm } from '../wasm/wasmEngine';
import {
  PROTOCOL_VERSION,
  type WorkerMessage,
  type WorkerRequest,
} from './protocol';

// Prefer the Rust/WASM equity build (bit-identical to TS, faster); fall back to the TS
// build if the wasm fails to load for any reason. Keeps the heavy step robust.
setEquityBuilder(async (samples, seed, onProgress) => {
  try {
    return await buildEquityMatrixWasm(samples, seed, onProgress);
  } catch (e) {
    console.warn('[worker] wasm equity unavailable, using TS build:', e);
    return buildEquityMatrix(samples, seed, onProgress);
  }
});

const engine = new PreflopEngine();

function post(msg: WorkerMessage) {
  (self as unknown as Worker).postMessage(msg);
}

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;

  if (msg.protocolVersion !== PROTOCOL_VERSION) {
    post({
      type: 'error',
      id: msg.id,
      error: {
        code: 'protocol-mismatch',
        message: `Worker protocol v${PROTOCOL_VERSION}, client v${msg.protocolVersion}`,
        recoverable: false,
      },
    });
    return;
  }

  if (msg.type === 'init') {
    post({ type: 'ready', id: msg.id, info: engine.info() });
    return;
  }

  if (msg.type === 'solve') {
    try {
      // Throttle progress to ~10 Hz to avoid flooding the main thread.
      let lastPost = 0;
      const result = await engine.solve(msg.req, (p) => {
        const t = Date.now();
        if (t - lastPost >= 100 || p.fraction >= 1) {
          lastPost = t;
          post({ type: 'progress', id: msg.id, progress: p });
        }
      });
      post({ type: 'solved', id: msg.id, result });
    } catch (err) {
      post({
        type: 'error',
        id: msg.id,
        error: {
          code: 'internal',
          message: err instanceof Error ? err.message : String(err),
          recoverable: true,
        },
      });
    }
  }
};
