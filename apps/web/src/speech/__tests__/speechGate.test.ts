import { describe, expect, it } from 'vitest';
import { SpeechGate } from '../speechGate.js';
import { resample } from '../listener.js';

/** Loud enough to be speech against the default floor. */
const LOUD = 0.2;
const QUIET = 0.002;

function feed(gate: SpeechGate, values: number[]): boolean[] {
  return values.map((value) => gate.push(value));
}

describe('SpeechGate', () => {
  it('says nothing about a silent room', () => {
    const gate = new SpeechGate();
    expect(
      feed(
        gate,
        Array.from({ length: 40 }, () => QUIET),
      ),
    ).not.toContain(true);
  });

  it('transcribes once when a short utterance ends', () => {
    const gate = new SpeechGate();
    const fired = feed(gate, [QUIET, QUIET, LOUD, LOUD, QUIET, QUIET, QUIET, QUIET]);
    expect(fired.filter(Boolean)).toHaveLength(1);
    // Two quiet ticks after the speech, not on the first one.
    expect(fired[5]).toBe(true);
  });

  it('waits out a pause in the middle of a word', () => {
    const gate = new SpeechGate();
    const fired = feed(gate, [LOUD, QUIET, LOUD, LOUD, QUIET, QUIET]);
    expect(fired.filter(Boolean)).toHaveLength(1);
    expect(fired[5]).toBe(true);
  });

  it('transcribes anyway when somebody keeps talking', () => {
    const gate = new SpeechGate({ windowTicks: 8 });
    const fired = feed(
      gate,
      Array.from({ length: 17 }, () => LOUD),
    );
    expect(fired.filter(Boolean)).toHaveLength(2);
  });

  it('raises its threshold in a noisy room', () => {
    const gate = new SpeechGate();
    const quiet = gate.threshold;
    for (let tick = 0; tick < 60; tick += 1) gate.push(0.05);
    expect(gate.threshold).toBeGreaterThan(quiet);
    // The same hum is now the floor, so it no longer reads as speech.
    expect(gate.push(0.05)).toBe(false);
  });

  it('drops the utterance in progress while the coach is speaking', () => {
    const gate = new SpeechGate();
    gate.push(LOUD);
    gate.suspend();
    // Without the suspend this would close the utterance and transcribe.
    expect(feed(gate, [QUIET, QUIET, QUIET])).not.toContain(true);
  });
});

describe('resample', () => {
  it('returns the same samples when the rate already matches', () => {
    const input = Float32Array.from([0, 0.5, -0.5, 1]);
    expect(resample(input, 16000, 16000)).toBe(input);
  });

  it('halves the length going from 32 kHz to 16 kHz', () => {
    const input = Float32Array.from({ length: 320 }, (_, index) => index / 320);
    const output = resample(input, 32000, 16000);
    expect(output).toHaveLength(160);
    expect(output[0]).toBeCloseTo(0);
    expect(output[159]).toBeCloseTo(318 / 320, 5);
  });

  it('keeps a sine recognisable across the rate change', () => {
    const from = 48000;
    const seconds = 0.05;
    const input = Float32Array.from({ length: from * seconds }, (_, index) =>
      Math.sin((2 * Math.PI * 220 * index) / from),
    );
    const output = resample(input, from, 16000);
    expect(output).toHaveLength(16000 * seconds);
    const rms = Math.sqrt(
      [...output].reduce((sum, value) => sum + value * value, 0) / output.length,
    );
    expect(rms).toBeCloseTo(Math.SQRT1_2, 1);
  });
});
