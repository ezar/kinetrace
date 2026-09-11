/**
 * Which Whisper the voice commands use, and what it costs to fetch.
 *
 * Kept out of the worker module so the listener can name a model without
 * pulling the recogniser — and its megabytes — into the main bundle.
 */

export type WhisperVariant = 'tiny' | 'base';

export interface WhisperModelInfo {
  id: string;
  /** Rough download size of the ONNX weights, in megabytes. */
  sizeMb: number;
}

/** Multilingual, so one model covers Spanish and English. */
export const WHISPER_MODELS: Record<WhisperVariant, WhisperModelInfo> = {
  tiny: { id: 'onnx-community/whisper-tiny', sizeMb: 75 },
  base: { id: 'onnx-community/whisper-base', sizeMb: 150 },
};

export type WhisperRequest =
  | { type: 'load'; variant: WhisperVariant }
  | { type: 'audio'; buffer: ArrayBuffer; language: string; id: number }
  | { type: 'dispose' };

export type WhisperResponse =
  | { type: 'progress'; fraction: number }
  | { type: 'ready' }
  | { type: 'transcript'; text: string; id: number }
  | { type: 'error'; message: string };
