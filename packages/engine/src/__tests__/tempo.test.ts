import { describe, expect, it } from 'vitest';
import { TempoMonitor } from '../state/tempoMonitor.js';

describe('TempoMonitor', () => {
  const targets = [{ phase: 'down', seconds: 3 }];

  it('says nothing without a tempo to hold somebody to', () => {
    const monitor = new TempoMonitor();
    expect(monitor.active).toBe(false);
    monitor.enter('down', 0);
    expect(monitor.enter('up', 100)).toEqual([]);
  });

  it('flags a phase done far faster than asked for', () => {
    const monitor = new TempoMonitor(targets);
    monitor.enter('down', 0);
    const events = monitor.enter('up', 1200);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'rushed', phase: 'down', targetSeconds: 3 });
    expect(events[0]?.seconds).toBeCloseTo(1.2, 1);
  });

  it('says nothing about a phase taken at the asked pace', () => {
    const monitor = new TempoMonitor(targets);
    monitor.enter('down', 0);
    expect(monitor.enter('up', 3000)).toEqual([]);
  });

  it('never complains about going slowly', () => {
    const monitor = new TempoMonitor(targets);
    monitor.enter('down', 0);
    expect(monitor.enter('up', 9000)).toEqual([]);
  });

  it('ignores phases with no tempo of their own', () => {
    const monitor = new TempoMonitor(targets);
    monitor.enter('up', 0);
    expect(monitor.enter('down', 50)).toEqual([]);
  });

  it('does not nag: once, then quiet', () => {
    const monitor = new TempoMonitor(targets, { cooldownMs: 8000 });
    monitor.enter('down', 0);
    expect(monitor.enter('up', 1000)).toHaveLength(1);
    monitor.enter('down', 2000);
    expect(monitor.enter('up', 3000)).toEqual([]);
    monitor.enter('down', 12_000);
    expect(monitor.enter('up', 13_000)).toHaveLength(1);
  });

  it('leaves very short phases alone, where the noise is bigger than the signal', () => {
    const monitor = new TempoMonitor([{ phase: 'down', seconds: 0.4 }]);
    monitor.enter('down', 0);
    expect(monitor.enter('up', 10)).toEqual([]);
  });
});
