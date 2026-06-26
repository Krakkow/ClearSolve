// Main-thread Worker Client — the adapter implementing the SolverEngine port
// across the postMessage boundary (ARCHITECTURE Sec 4.5). It serializes requests,
// correlates responses by id, and surfaces progress. The UI talks to this, never
// to the worker directly.

import type {
  AnySolveResult,
  EngineInfo,
  SolveProgress,
  SolveRequest,
  SolverEngine,
} from '../engine/types';
import {
  PROTOCOL_VERSION,
  type WorkerMessage,
  type WorkerRequest,
} from './protocol';

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export class SolverWorkerClient implements SolverEngine {
  private worker: Worker;
  private cachedInfo: EngineInfo | null = null;

  constructor() {
    // Vite worker pattern: a real module Worker. This URL is statically analyzed
    // by Vite and bundled as a separate chunk.
    this.worker = new Worker(new URL('./solver.worker.ts', import.meta.url), {
      type: 'module',
    });
  }

  info(): EngineInfo {
    return (
      this.cachedInfo ?? {
        engineVersion: 'unknown',
        engineKind: 'ts',
        threading: 'single',
        crossOriginIsolated:
          typeof crossOriginIsolated !== 'undefined' ? crossOriginIsolated : false,
        deterministic: true,
      }
    );
  }

  /** Lazy init: confirm the worker is alive and capture EngineInfo. */
  init(): Promise<EngineInfo> {
    const id = nextId('init');
    return new Promise<EngineInfo>((resolve, reject) => {
      const onMsg = (ev: MessageEvent<WorkerMessage>) => {
        const m = ev.data;
        if (m.id !== id) return;
        this.worker.removeEventListener('message', onMsg);
        if (m.type === 'ready') {
          this.cachedInfo = m.info;
          resolve(m.info);
        } else if (m.type === 'error') {
          reject(new Error(m.error.message));
        }
      };
      this.worker.addEventListener('message', onMsg);
      const req: WorkerRequest = { type: 'init', id, protocolVersion: PROTOCOL_VERSION };
      this.worker.postMessage(req);
    });
  }

  solve(
    req: SolveRequest,
    onProgress: (p: SolveProgress) => void,
  ): Promise<AnySolveResult> {
    const id = nextId('solve');
    return new Promise<AnySolveResult>((resolve, reject) => {
      const onMsg = (ev: MessageEvent<WorkerMessage>) => {
        const m = ev.data;
        if (m.id !== id) return;
        if (m.type === 'progress') {
          onProgress(m.progress);
        } else if (m.type === 'solved') {
          this.worker.removeEventListener('message', onMsg);
          resolve(m.result);
        } else if (m.type === 'error') {
          this.worker.removeEventListener('message', onMsg);
          reject(new Error(`${m.error.code}: ${m.error.message}`));
        }
      };
      this.worker.addEventListener('message', onMsg);
      const wreq: WorkerRequest = {
        type: 'solve',
        id,
        protocolVersion: PROTOCOL_VERSION,
        req,
      };
      this.worker.postMessage(wreq);
    });
  }

  dispose(): void {
    this.worker.terminate();
  }
}
