import { describe, expect, it } from 'vitest';
import { RepMachine, type PhaseDef, type RepTargets } from '../state/repMachine.js';
import { HoldTimer } from '../state/holdTimer.js';
import { ConfidenceGate } from '../session/confidenceGate.js';
import type { MetricFrame } from '../types.js';

function frame(value: number, timestampMs: number, stability = 0): MetricFrame {
  return {
    timestampMs,
    poseConfidence: 0.9,
    samples: {
      primary: { value, velocity: 0, stability, confidence: 0.9, fromImageSpace: false },
    },
  };
}

const PHASES: PhaseDef[] = [
  { id: 'rest', when: { below: 140 }, minDwellMs: 200 },
  { id: 'top', when: { above: 150 }, minDwellMs: 500 },
];

const TARGETS: RepTargets = { direction: 'increase', band: { min: 165, max: 185 } };

/** Feed a ramp between two values, one frame every 33 ms. */
function ramp(
  machine: RepMachine,
  from: number,
  to: number,
  seconds: number,
  startMs: number,
): { events: ReturnType<RepMachine['update']>; endMs: number } {
  const frames = Math.max(1, Math.round((seconds * 1000) / 33));
  const events: ReturnType<RepMachine['update']> = [];
  let timestampMs = startMs;
  for (let index = 1; index <= frames; index += 1) {
    timestampMs = startMs + index * 33;
    events.push(...machine.update(frame(from + ((to - from) * index) / frames, timestampMs)));
  }
  return { events, endMs: timestampMs };
}

describe('RepMachine', () => {
  it('counts a repetition once the cycle returns to the resting phase', () => {
    const machine = new RepMachine({ phases: PHASES, primaryMetric: 'primary', targets: TARGETS });
    let now = 0;
    machine.update(frame(120, now));
    for (let rep = 0; rep < 3; rep += 1) {
      now = ramp(machine, 120, 175, 1.5, now).endMs;
      now = ramp(machine, 175, 175, 0.7, now).endMs;
      now = ramp(machine, 175, 120, 1.5, now).endMs;
      now = ramp(machine, 120, 120, 0.4, now).endMs;
    }
    expect(machine.state.reps).toBe(3);
    expect(machine.state.partials).toBe(0);
  });

  it('does not count jitter around a threshold', () => {
    const machine = new RepMachine({ phases: PHASES, primaryMetric: 'primary', targets: TARGETS });
    let now = 0;
    for (let index = 0; index < 300; index += 1) {
      now += 33;
      machine.update(frame(index % 2 === 0 ? 139 : 151, now));
    }
    expect(machine.state.reps).toBe(0);
  });

  it('counts a repetition that falls short of the band as a partial', () => {
    const machine = new RepMachine({ phases: PHASES, primaryMetric: 'primary', targets: TARGETS });
    let now = 0;
    machine.update(frame(120, now));
    now = ramp(machine, 120, 158, 1.5, now).endMs;
    now = ramp(machine, 158, 158, 0.7, now).endMs;
    const back = ramp(machine, 158, 120, 1.5, now);
    const repEvent = back.events.find((event) => event.type === 'rep');
    expect(repEvent).toMatchObject({ good: false });
    expect(machine.state.partials).toBe(1);
    expect(machine.state.reps).toBe(0);
  });

  it('requires the dwell time before entering a phase', () => {
    const machine = new RepMachine({
      phases: [
        { id: 'rest', when: { below: 140 }, minDwellMs: 200 },
        { id: 'top', when: { above: 150 }, minDwellMs: 2000 },
      ],
      primaryMetric: 'primary',
      targets: TARGETS,
    });
    let now = 0;
    machine.update(frame(120, now));
    now = ramp(machine, 120, 175, 0.5, now).endMs;
    // The top is reached but not held long enough, so the cycle never completes.
    now = ramp(machine, 175, 120, 0.5, now).endMs;
    ramp(machine, 120, 120, 1, now);
    expect(machine.state.reps).toBe(0);
  });

  it('tracks the peak in the direction the exercise moves', () => {
    const machine = new RepMachine({
      phases: [
        { id: 'stand', when: { above: 160 }, minDwellMs: 200 },
        { id: 'bottom', when: { below: 120 }, minDwellMs: 200 },
      ],
      primaryMetric: 'primary',
      targets: { direction: 'decrease', band: { min: 70, max: 100 } },
    });
    let now = 0;
    machine.update(frame(175, now));
    now = ramp(machine, 175, 85, 1.2, now).endMs;
    const back = ramp(machine, 85, 175, 1.2, now);
    back.events.push(...ramp(machine, 175, 175, 0.5, back.endMs).events);
    const repEvent = back.events.find((event) => event.type === 'rep');
    expect(repEvent).toMatchObject({ good: true });
    expect(machine.state.peaks[0]).toBeLessThan(90);
  });
});

describe('HoldTimer', () => {
  const config = {
    primaryMetric: 'primary',
    band: { min: -8, max: 8 },
    stabilityToleranceDeg: 4,
    targetMs: 3000,
  };

  it('accumulates time only inside the band', () => {
    const timer = new HoldTimer(config);
    for (let index = 0; index <= 60; index += 1) timer.update(frame(2, index * 33));
    expect(timer.state.heldMs).toBeGreaterThan(1800);
    expect(timer.state.heldMs).toBeLessThan(2050);
  });

  it('pauses the timer and reports the lapse after the grace period', () => {
    const timer = new HoldTimer(config);
    let now = 0;
    for (let index = 0; index < 30; index += 1) timer.update(frame(2, (now += 33)));
    const held = timer.state.heldMs;
    const events = [];
    for (let index = 0; index < 60; index += 1)
      events.push(...timer.update(frame(20, (now += 33))));
    expect(timer.state.heldMs).toBe(held);
    expect(events.some((event) => event.type === 'holdLost')).toBe(true);
  });

  it('does not accumulate while the position is unsteady', () => {
    const timer = new HoldTimer(config);
    for (let index = 0; index <= 60; index += 1) timer.update(frame(2, index * 33, 9));
    expect(timer.state.heldMs).toBe(0);
  });

  it('completes when the target time is reached', () => {
    const timer = new HoldTimer(config);
    const events = [];
    for (let index = 0; index <= 120; index += 1)
      events.push(...timer.update(frame(0, index * 33)));
    expect(events.some((event) => event.type === 'holdComplete')).toBe(true);
    expect(timer.state.complete).toBe(true);
  });
});

describe('ConfidenceGate', () => {
  it('declares tracking lost after a second below the threshold', () => {
    const gate = new ConfidenceGate();
    expect(gate.update(0.3, 0)).toBeNull();
    expect(gate.update(0.3, 500)).toBeNull();
    expect(gate.update(0.3, 1000)?.type).toBe('trackingLost');
    expect(gate.isLost).toBe(true);
  });

  it('ignores a short dropout', () => {
    const gate = new ConfidenceGate();
    gate.update(0.9, 0);
    gate.update(0.2, 200);
    gate.update(0.9, 600);
    expect(gate.isLost).toBe(false);
  });

  it('recovers once the body is visible again', () => {
    const gate = new ConfidenceGate();
    gate.update(0.2, 0);
    gate.update(0.2, 1100);
    gate.update(0.9, 1200);
    expect(gate.update(0.9, 1600)?.type).toBe('trackingRecovered');
    expect(gate.isLost).toBe(false);
  });
});
