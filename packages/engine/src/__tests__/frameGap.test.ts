import { describe, expect, it } from 'vitest';
import { HoldTimer } from '../state/holdTimer.js';
import { RepMachine } from '../state/repMachine.js';
import { OneEuroFilter } from '../filter/oneEuro.js';
import { MAX_FRAME_GAP_MS, isFrameGap } from '../time.js';
import type { MetricFrame } from '../types.js';

/**
 * Frames stop for ordinary reasons — the phone locks, a call arrives, the tab is
 * hidden — and resume with a timestamp far in the future. None of the time in
 * between was watched, and nothing in the engine may count it as if it were.
 */

function frame(timestampMs: number, value: number, stability = 0.5): MetricFrame {
  return {
    timestampMs,
    poseConfidence: 1,
    samples: { m: { value, velocity: 0, stability, confidence: 1, fromImageSpace: false } },
  };
}

describe('isFrameGap', () => {
  it('lets a slow frame through and stops an absence', () => {
    expect(isFrameGap(200, 0)).toBe(false);
    expect(isFrameGap(MAX_FRAME_GAP_MS, 0)).toBe(false);
    expect(isFrameGap(MAX_FRAME_GAP_MS + 1, 0)).toBe(true);
    expect(isFrameGap(60_000, null)).toBe(false);
  });
});

describe('the hold timer', () => {
  const config = {
    primaryMetric: 'm',
    band: { min: 160, max: 200 },
    stabilityToleranceDeg: 4,
    targetMs: 30_000,
  };

  it('does not finish a plank out of a minute it never saw', () => {
    const timer = new HoldTimer(config);
    timer.update(frame(0, 180));
    timer.update(frame(33, 180));
    timer.update(frame(66, 180));
    expect(timer.state.heldMs).toBe(66);

    // The screen locks for a minute; one frame arrives on the way back.
    const events = timer.update(frame(66 + 60_000, 180));
    expect(timer.state.heldMs).toBeLessThanOrEqual(66 + MAX_FRAME_GAP_MS);
    expect(timer.state.complete).toBe(false);
    expect(events.map((event) => event.type)).not.toContain('holdComplete');
  });

  it('still counts a slow frame, because that time was watched', () => {
    const timer = new HoldTimer(config);
    timer.update(frame(0, 180));
    timer.update(frame(200, 180));
    timer.update(frame(400, 180));
    expect(timer.state.heldMs).toBe(400);
  });

  it('completes a hold that was actually held', () => {
    const timer = new HoldTimer(config);
    for (let t = 0; t <= 31_000; t += 100) timer.update(frame(t, 180));
    expect(timer.state.complete).toBe(true);
  });
});

describe('the repetition machine', () => {
  const config = {
    primaryMetric: 'm',
    phases: [
      { id: 'rest', when: { below: 140 }, minDwellMs: 200 },
      { id: 'top', when: { above: 148 }, minDwellMs: 500 },
    ],
    targets: { direction: 'increase' as const, band: { min: 165, max: 185 } },
  };

  it('does not grant a dwell out of the time it was away', () => {
    const machine = new RepMachine(config);
    machine.update(frame(0, 120));
    machine.update(frame(100, 120));
    machine.update(frame(200, 120));
    expect(machine.state.phaseId).toBe('rest');

    // One frame above the threshold, then a long absence, then one more. The
    // 500 ms dwell must not be satisfied by the gap.
    machine.update(frame(300, 170));
    const events = machine.update(frame(300 + 30_000, 170));
    expect(events.map((event) => event.type)).not.toContain('phase');
    expect(machine.state.phaseId).toBe('rest');
  });

  it('still counts a repetition that was watched throughout', () => {
    const machine = new RepMachine(config);
    const run = (from: number, to: number, value: number): void => {
      for (let t = from; t <= to; t += 50) machine.update(frame(t, value));
    };
    run(0, 300, 120);
    run(350, 1000, 170);
    run(1050, 1400, 120);
    expect(machine.state.reps).toBe(1);
  });
});

describe('the One Euro filter', () => {
  it('does not invent a speed across a gap it did not watch', () => {
    const filter = new OneEuroFilter();
    filter.filter(100, 0);
    filter.filter(100, 33);
    expect(filter.derivative).toBeCloseTo(0, 5);

    // Away for ten seconds; the body is somewhere else when we look again.
    filter.filter(160, 10_000);
    expect(filter.derivative).toBe(0);
    // And the value is taken as a fresh start rather than dragged from the old one.
    expect(filter.filter(160, 10_033)).toBeCloseTo(160, 0);
  });

  it('still measures the speed of movement it did watch', () => {
    const filter = new OneEuroFilter();
    for (let t = 0; t <= 1000; t += 33) filter.filter(100 + t * 0.05, t);
    expect(filter.derivative).toBeGreaterThan(20);
  });
});
