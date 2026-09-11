/**
 * Whisper worker.
 *
 * Speech recognition runs here because pose inference already owns the main
 * thread: a transcription that took 300 ms there would drop frames and lose
 * repetitions. The worker holds the pipeline and answers with plain text.
 *
 * The weights come from Hugging Face the first time and are then served by the
 * browser's cache. Nothing is uploaded: the audio never leaves this worker.
 */

import {
  WHISPER_MODELS,
  type WhisperRequest,
  type WhisperResponse,
  type WhisperVariant,
} from './whisperModel.js';

type Transcriber = (
  audio: Float32Array,
  options: Record<string, unknown>,
) => Promise<{ text: string } | Array<{ text: string }>>;

let transcriber: Transcriber | null = null;
let loading: Promise<void> | null = null;

function post(message: WhisperResponse): void {
  (self as unknown as Worker).postMessage(message);
}

/**
 * Download progress is reported per file. Weighting by bytes would be more
 * honest, but the files arrive out of order and the encoder dominates, so the
 * mean of what each file reports is close enough for a progress bar.
 */
function trackProgress(): (info: Record<string, unknown>) => void {
  const files = new Map<string, number>();
  return (info) => {
    const status = info['status'];
    const file = String(info['file'] ?? '');
    if (status === 'progress' && typeof info['progress'] === 'number') {
      files.set(file, Math.min(100, info['progress']) / 100);
    } else if (status === 'done') {
      files.set(file, 1);
    } else if (status === 'initiate') {
      files.set(file, 0);
    } else {
      return;
    }
    const total = [...files.values()].reduce((sum, value) => sum + value, 0);
    post({ type: 'progress', fraction: files.size === 0 ? 0 : total / files.size });
  };
}

async function load(variant: WhisperVariant): Promise<void> {
  const { env, pipeline } = await import('@huggingface/transformers');
  // Kinetrace serves its own pose models from `/models/`; without this the
  // library would look for Whisper there first and log a 404 on every file.
  env.allowLocalModels = false;

  const built = await pipeline('automatic-speech-recognition', WHISPER_MODELS[variant].id, {
    device: 'webgpu',
    // The encoder is small and wants the accuracy; the decoder is the slow part
    // and runs happily quantised.
    dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
    progress_callback: trackProgress() as never,
  });
  transcriber = built as unknown as Transcriber;
  post({ type: 'ready' });
}

self.onmessage = (event: MessageEvent<WhisperRequest>): void => {
  const message = event.data;

  if (message.type === 'load') {
    loading ??= load(message.variant).catch((error: unknown) => {
      loading = null;
      post({
        type: 'error',
        message: error instanceof Error ? error.message : 'the voice model failed to load',
      });
    });
    return;
  }

  if (message.type === 'dispose') {
    transcriber = null;
    self.close();
    return;
  }

  if (message.type === 'audio') {
    const audio = new Float32Array(message.buffer);
    if (!transcriber) return;
    void transcriber(audio, {
      language: message.language,
      task: 'transcribe',
      // A command is a word or two: capping the answer bounds both the latency
      // and how much the model can invent when it hears nothing.
      max_new_tokens: 16,
      do_sample: false,
      return_timestamps: false,
    })
      .then((output) => {
        const text = Array.isArray(output) ? (output[0]?.text ?? '') : output.text;
        post({ type: 'transcript', text, id: message.id });
      })
      .catch((error: unknown) => {
        post({
          type: 'error',
          message: error instanceof Error ? error.message : 'transcription failed',
        });
      });
  }
};
