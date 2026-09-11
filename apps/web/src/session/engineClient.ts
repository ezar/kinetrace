/**
 * Client for the engine worker.
 *
 * Falls back to running the engine inline when workers are unavailable, so the
 * session still works rather than failing.
 */

import {
  ExerciseRunner,
  type ExerciseRunnerConfig,
  type PoseFrame,
  type RunnerUpdate,
} from '@kinetrace/engine';
import { packFrame } from './frameCodec.js';
import type { WorkerRequest, WorkerResponse } from './engine.worker.js';

export interface EngineClient {
  update(frame: PoseFrame): void;
  reset(): void;
  dispose(): void;
}

export function createEngineClient(
  config: ExerciseRunnerConfig,
  onUpdate: (update: RunnerUpdate) => void,
  onError?: (message: string) => void,
): EngineClient {
  if (typeof Worker === 'undefined') {
    const runner = new ExerciseRunner(config);
    return {
      update: (frame) => onUpdate(runner.update(frame)),
      reset: () => runner.reset(),
      dispose: () => {},
    };
  }

  const worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    if (event.data.type === 'update') onUpdate(event.data.update);
    if (event.data.type === 'error') onError?.(event.data.message);
  };
  const post = (message: WorkerRequest, transfer?: Transferable[]): void => {
    worker.postMessage(message, transfer ?? []);
  };
  post({ type: 'init', config });

  return {
    update: (frame) => {
      const buffer = packFrame(frame).buffer as ArrayBuffer;
      post({ type: 'frame', buffer }, [buffer]);
    },
    reset: () => post({ type: 'reset' }),
    dispose: () => {
      post({ type: 'dispose' });
      worker.terminate();
    },
  };
}
