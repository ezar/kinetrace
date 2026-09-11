/**
 * Engine worker.
 *
 * Metrics, the repetition machine, the form rules and the cue scheduler run
 * here, so a slow frame never stutters the session screen. Pose inference stays
 * on the main thread, where the GPU delegate needs to be.
 */

import { ExerciseRunner, type ExerciseRunnerConfig, type RunnerUpdate } from '@kinetrace/engine';
import { unpackFrame } from './frameCodec.js';

export type WorkerRequest =
  | { type: 'init'; config: ExerciseRunnerConfig }
  | { type: 'frame'; buffer: ArrayBuffer }
  | { type: 'reset' }
  | { type: 'dispose' };

export type WorkerResponse =
  { type: 'ready' } | { type: 'update'; update: RunnerUpdate } | { type: 'error'; message: string };

let runner: ExerciseRunner | null = null;

self.onmessage = (event: MessageEvent<WorkerRequest>): void => {
  const message = event.data;
  try {
    switch (message.type) {
      case 'init':
        runner = new ExerciseRunner(message.config);
        (self as unknown as Worker).postMessage({ type: 'ready' } satisfies WorkerResponse);
        break;
      case 'frame': {
        if (!runner) return;
        const update = runner.update(unpackFrame(new Float32Array(message.buffer)));
        (self as unknown as Worker).postMessage({
          type: 'update',
          update,
        } satisfies WorkerResponse);
        break;
      }
      case 'reset':
        runner?.reset();
        break;
      case 'dispose':
        runner = null;
        self.close();
        break;
    }
  } catch (error) {
    (self as unknown as Worker).postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown engine error',
    } satisfies WorkerResponse);
  }
};
