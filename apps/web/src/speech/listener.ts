/**
 * Microphone capture for voice commands.
 *
 * The microphone is always open while the session runs, but the recogniser is
 * not: running Whisper four times a second on an empty room would drain the
 * battery and invent words. Instead the audio goes into a rolling two second
 * ring buffer, a cheap energy gate decides when somebody has spoken, and only
 * then is the window handed to the worker.
 *
 * The coach's own voice is the other thing that must not be transcribed, so
 * nothing is sent while the browser is speaking a cue or just after.
 *
 * Audio is never stored and never leaves the device.
 */

import { SpeechGate } from './speechGate.js';
import {
  WHISPER_MODELS,
  type WhisperRequest,
  type WhisperResponse,
  type WhisperVariant,
} from './whisperModel.js';

export type ListenerStatus = 'idle' | 'unsupported' | 'denied' | 'loading' | 'listening' | 'error';

export interface ListenerEvents {
  onStatus: (status: ListenerStatus, detail?: string) => void;
  /** Download progress of the voice model, `[0, 1]`. */
  onProgress: (fraction: number) => void;
  /** A transcript worth matching against the grammar. */
  onTranscript: (text: string, timestampMs: number) => void;
  /** Microphone level, `[0, 1]`, for the listening indicator. */
  onLevel?: (level: number) => void;
}

export interface ListenerOptions extends ListenerEvents {
  variant?: WhisperVariant;
  /** Language given to Whisper, as a name or a two letter code. */
  language: string;
}

/** Whisper wants 16 kHz mono. */
const TARGET_RATE = 16000;
/** How much audio a command is allowed to span. */
const WINDOW_SECONDS = 2;
/** How often the energy gate looks at the buffer. */
const TICK_MS = 250;
/** Quiet after a spoken cue before the microphone is trusted again, in ms. */
const SPEAKER_TAIL_MS = 400;
/**
 * How long to wait for the worker before giving up on a window. A recogniser
 * that stopped answering must not leave the indicator showing a cheerful dot
 * over a microphone nothing is listening to.
 */
const TRANSCRIBE_TIMEOUT_MS = 8000;

/**
 * Posts fixed blocks instead of one message per 128 sample render quantum,
 * which would be a thousand messages a minute for nothing.
 */
const WORKLET_SOURCE = `
class KinetraceCollector extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(2048);
    this.filled = 0;
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i += 1) {
      this.buffer[this.filled] = channel[i];
      this.filled += 1;
      if (this.filled === this.buffer.length) {
        this.port.postMessage(this.buffer.slice(0));
        this.filled = 0;
      }
    }
    return true;
  }
}
registerProcessor('kinetrace-collector', KinetraceCollector);
`;

export function voiceCommandsSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices?.getUserMedia !== undefined &&
    typeof Worker !== 'undefined' &&
    typeof AudioContext !== 'undefined' &&
    'gpu' in navigator
  );
}

export function whisperModel(variant: WhisperVariant): { id: string; sizeMb: number } {
  return WHISPER_MODELS[variant];
}

/** Linear resampling. Good enough for speech at these ratios. */
/** Exported for its test: the rest of the app goes through the listener. */
export function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const length = Math.floor(input.length / ratio);
  const output = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    const position = index * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, input.length - 1);
    const fraction = position - left;
    output[index] = input[left]! * (1 - fraction) + input[right]! * fraction;
  }
  return output;
}

export class VoiceListener {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private worker: Worker | null = null;
  private timer: number | undefined;

  /** Rolling window of the last `WINDOW_SECONDS`, oldest sample after `head`. */
  private ring: Float32Array = new Float32Array(0);
  private head = 0;
  private written = 0;

  private readonly gate = new SpeechGate({
    windowTicks: (WINDOW_SECONDS * 1000) / TICK_MS,
  });
  private speakerBusyUntil = 0;
  /** Id of the window the worker is busy with, or null when it is free. */
  private pendingId: number | null = null;
  private pendingSince = 0;
  private requestId = 0;
  private status: ListenerStatus = 'idle';
  private stopped = false;

  constructor(private options: ListenerOptions) {}

  setLanguage(language: string): void {
    this.options = { ...this.options, language };
  }

  private setStatus(status: ListenerStatus, detail?: string): void {
    if (this.status === status) return;
    this.status = status;
    this.options.onStatus(status, detail);
  }

  async start(): Promise<void> {
    if (!voiceCommandsSupported()) {
      this.setStatus('unsupported');
      return;
    }
    this.stopped = false;
    this.setStatus('loading');

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (error) {
      const denied = error instanceof DOMException && error.name === 'NotAllowedError';
      this.setStatus(
        denied ? 'denied' : 'error',
        error instanceof Error ? error.message : undefined,
      );
      return;
    }
    if (this.stopped) return this.stop();

    this.context = new AudioContext({ sampleRate: TARGET_RATE });
    const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'text/javascript' }));
    try {
      await this.context.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    if (this.stopped) return this.stop();

    this.ring = new Float32Array(Math.ceil(this.context.sampleRate * WINDOW_SECONDS));
    this.node = new AudioWorkletNode(this.context, 'kinetrace-collector');
    this.node.port.onmessage = (event: MessageEvent<Float32Array>) => this.write(event.data);
    this.context.createMediaStreamSource(this.stream).connect(this.node);
    // The worklet produces no output; connecting it to the destination keeps it
    // pulled by the graph without adding anything audible.
    this.node.connect(this.context.destination);

    this.worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<WhisperResponse>) => this.receive(event.data);
    this.post({ type: 'load', variant: this.options.variant ?? 'tiny' });

    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    this.stopped = true;
    window.clearInterval(this.timer);
    this.timer = undefined;
    this.node?.port.close();
    this.node?.disconnect();
    this.node = null;
    void this.context?.close();
    this.context = null;
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    if (this.worker) {
      this.post({ type: 'dispose' });
      this.worker.terminate();
      this.worker = null;
    }
    this.ring = new Float32Array(0);
    this.head = 0;
    this.written = 0;
    this.gate.reset();
    this.pendingId = null;
    this.setStatus('idle');
  }

  private post(message: WhisperRequest, transfer?: Transferable[]): void {
    this.worker?.postMessage(message, transfer ?? []);
  }

  private receive(message: WhisperResponse): void {
    switch (message.type) {
      case 'progress':
        this.options.onProgress(message.fraction);
        break;
      case 'ready':
        this.setStatus('listening');
        break;
      case 'transcript': {
        // A late answer to a window that already timed out is stale audio.
        const stale = message.id !== this.pendingId;
        this.pendingId = null;
        if (!stale && message.text.trim()) this.options.onTranscript(message.text, Date.now());
        break;
      }
      case 'error':
        this.pendingId = null;
        this.setStatus('error', message.message);
        break;
    }
  }

  private write(block: Float32Array): void {
    if (this.ring.length === 0) return;
    for (let index = 0; index < block.length; index += 1) {
      this.ring[this.head] = block[index]!;
      this.head = (this.head + 1) % this.ring.length;
    }
    this.written = Math.min(this.written + block.length, this.ring.length);
  }

  /** The whole window, oldest sample first. */
  private snapshot(): Float32Array {
    const out = new Float32Array(this.ring.length);
    const tail = this.ring.length - this.head;
    out.set(this.ring.subarray(this.head), 0);
    out.set(this.ring.subarray(0, this.head), tail);
    return out;
  }

  /** Loudness of the most recent `TICK_MS` of audio. */
  private recentRms(): number {
    if (this.ring.length === 0) return 0;
    const count = Math.min(
      this.written,
      Math.floor(((this.context?.sampleRate ?? TARGET_RATE) * TICK_MS) / 1000),
    );
    let sum = 0;
    for (let step = 1; step <= count; step += 1) {
      const index = (this.head - step + this.ring.length) % this.ring.length;
      const sample = this.ring[index]!;
      sum += sample * sample;
    }
    return count === 0 ? 0 : Math.sqrt(sum / count);
  }

  private tick(): void {
    const now = Date.now();
    const rms = this.recentRms();
    this.options.onLevel?.(Math.min(1, rms * 12));

    // Do not listen to the coach: the cue would come straight back in.
    if (typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking) {
      this.speakerBusyUntil = now + SPEAKER_TAIL_MS;
    }
    if (now < this.speakerBusyUntil) {
      this.gate.suspend();
      return;
    }

    if (this.gate.push(rms)) this.transcribe();
  }

  private transcribe(): void {
    if (this.status !== 'listening') return;
    if (this.pendingId !== null) {
      if (Date.now() - this.pendingSince < TRANSCRIBE_TIMEOUT_MS) return;
      // The worker is wedged or hopelessly behind; drop that window and go on.
      this.pendingId = null;
    }
    if (this.written < this.ring.length / 4) return;
    const rate = this.context?.sampleRate ?? TARGET_RATE;
    const audio = resample(this.snapshot(), rate, TARGET_RATE);
    this.requestId += 1;
    this.pendingId = this.requestId;
    this.pendingSince = Date.now();
    const buffer = audio.buffer as ArrayBuffer;
    this.post(
      {
        type: 'audio',
        buffer,
        language: this.options.language,
        id: this.requestId,
      },
      [buffer],
    );
  }
}
