import { describe, expect, it } from 'vitest';
import { getExercise } from '../index.js';
import { guidedScript, holdMarks, repSeconds, restScript } from '../guided.js';

const bridge = getExercise('glute-bridge')!;
const plank = getExercise('front-plank')!;
const catCamel = getExercise('cat-camel')!;

const keys = (lines: Array<{ key: string }>): string[] => lines.map((line) => line.key);

describe('repSeconds', () => {
  it('takes the reference motion cycle when nobody prescribed a pace', () => {
    // The pace the exercise's own demo animates at, chosen by its author.
    expect(catCamel.tempo).toBeUndefined();
    expect(repSeconds({ exercise: catCamel })).toBe(catCamel.reference.cycleSeconds);
    expect(repSeconds({ exercise: catCamel })).toBe(6);
  });

  it('adds up a prescribed tempo instead', () => {
    // Rest 1.5 s plus top 2 s is a three and a half second repetition.
    expect(
      repSeconds({
        exercise: bridge,
        tempo: [
          { phase: 'rest', seconds: 1.5 },
          { phase: 'top', seconds: 2 },
        ],
      }),
    ).toBe(3.5);
  });

  it('uses the library tempo when the routine prescribes none', () => {
    expect(bridge.tempo).toBeDefined();
    expect(repSeconds({ exercise: bridge })).toBe(3.5);
  });

  it('falls back to the reference cycle when a prescribed tempo is unusable', () => {
    // Not to the library's own tempo: the routine deliberately replaced it, so
    // going back to it would speak a pace nobody chose. The reference cycle is
    // the exercise author's pace, which is the honest default.
    expect(repSeconds({ exercise: bridge, tempo: [] })).toBe(4);
    expect(repSeconds({ exercise: bridge, tempo: [{ phase: 'rest', seconds: 0 }] })).toBe(4);
    expect(repSeconds({ exercise: bridge, tempo: [] })).toBe(bridge.reference.cycleSeconds);
  });
});

describe('holdMarks', () => {
  it('counts the last five seconds one by one', () => {
    expect(holdMarks(30)).toContain(5);
    expect(holdMarks(30)).toContain(1);
    expect(holdMarks(30)).not.toContain(6);
  });

  it('warns ten seconds out on a hold long enough for it to help', () => {
    expect(holdMarks(30)).toContain(10);
    expect(holdMarks(12)).not.toContain(10);
  });

  it('marks the midpoint of a hold long enough to lose somebody', () => {
    // Thirty seconds is the longest hold the library prescribes, so the
    // midpoint threshold has to be below it or it never fires at all.
    expect(holdMarks(60)[0]).toBe(30);
    expect(holdMarks(30)[0]).toBe(15);
    expect(holdMarks(20)).not.toContain(15);
  });

  it('never speaks a mark at or past the end of the hold', () => {
    for (const seconds of [1, 2, 3, 4, 5, 8, 15, 30, 60, 90]) {
      for (const mark of holdMarks(seconds)) {
        expect(mark, `hold ${seconds}`).toBeGreaterThan(0);
        expect(mark, `hold ${seconds}`).toBeLessThan(seconds);
      }
    }
  });

  it('says nothing at all during a hold too short to narrate', () => {
    expect(holdMarks(1)).toEqual([]);
  });

  it('counts down, never up', () => {
    const marks = holdMarks(60);
    expect([...marks].sort((a, b) => b - a)).toEqual(marks);
  });
});

describe('guidedScript · repetitions', () => {
  const script = guidedScript({
    exercise: bridge,
    name: 'Puente de glúteos',
    setNumber: 2,
    totalSets: 3,
    reps: 12,
  });

  it('announces and doses, then hands over to the clock', () => {
    expect(keys(script.preamble)).toEqual([
      'guided.exercise',
      'guided.doseReps',
      'guided.getReady',
    ]);
    expect(script.preamble[1]?.params).toMatchObject({ set: 2, sets: 3, reps: 12 });
  });

  it('counts in against a clock, a second a number', () => {
    // It used to live at the end of the preamble, which is spoken as fast as
    // the voice manages: "three, two, one" took about a second and a half.
    expect(script.leadIn).toEqual([
      { atMs: 0, key: 'guided.count', params: { n: 3 } },
      { atMs: 1000, key: 'guided.count', params: { n: 2 } },
      { atMs: 2000, key: 'guided.count', params: { n: 1 } },
      { atMs: 3000, key: 'guided.begin' },
    ]);
    expect(script.leadInMs).toBe(3000);
  });

  it('counts every repetition, at the prescribed pace', () => {
    const counts = script.rhythm.filter((beat) => beat.key === 'guided.rep');
    expect(counts).toHaveLength(12);
    expect(counts[0]).toEqual({ atMs: 3500, key: 'guided.rep', params: { n: 1 } });
    expect(counts[11]).toEqual({ atMs: 42_000, key: 'guided.rep', params: { n: 12 } });
  });

  it('counts a repetition when it is finished, not when it starts', () => {
    // Which is what somebody on a mat wants to know: how many are done.
    expect(script.rhythm.find((beat) => beat.key === 'guided.rep')?.atMs).toBeGreaterThan(0);
  });

  it('calls the movement inside each repetition, not only the number', () => {
    // A count says how many are left. It does not say what to do, and somebody
    // who has not done a bridge before needs the other half.
    expect(keys(script.rhythm).slice(0, 6)).toEqual([
      'phaseCue.top',
      'phaseCue.glute-bridge.rest',
      'guided.rep',
      'phaseCue.top',
      'phaseCue.glute-bridge.rest',
      'guided.rep',
    ]);
  });

  it('paces the movement by the prescribed tempo, not the reference cycle', () => {
    // The bridge's own cycle is four seconds; its tempo makes it three and a
    // half, and every cue inside the repetition moves with it.
    const [up, down] = script.rhythm;
    expect(up?.atMs).toBeGreaterThan(0);
    expect(up?.atMs).toBeLessThan(3500 * 0.25);
    expect(down?.atMs).toBeGreaterThan(3500 * 0.5);
    expect(down?.atMs).toBeLessThan(3500 * 0.85);
  });

  it('never lets two beats land close enough to swallow each other', () => {
    // The bug this exists for: a repetition that begins on the instant the
    // last one is counted put both on the same millisecond, and speaking the
    // second cancelled the first — losing the count, which is the one number
    // the person was waiting for.
    const times = script.rhythm.map((beat) => beat.atMs);
    for (const [index, at] of times.slice(1).entries()) {
      expect(at - (times[index] ?? 0)).toBeGreaterThanOrEqual(700);
    }
  });

  it('keeps every count on the repetition it closes, and moves the cue instead', () => {
    const counts = script.rhythm.filter((beat) => beat.key === 'guided.rep');
    for (const [index, count] of counts.entries()) {
      expect(count.atMs).toBe((index + 1) * 3500);
    }
  });

  it('says nothing about phases it has no words for', () => {
    // Better silent than reading an internal id out loud.
    for (const beat of script.rhythm) expect(beat.key).not.toMatch(/^phaseCue\.undefined/);
  });

  it('ends when the last repetition is counted', () => {
    expect(script.workMs).toBe(script.rhythm.at(-1)?.atMs);
    expect(script.rhythm.at(-1)?.key).toBe('guided.rep');
    expect(keys(script.epilogue)).toEqual(['guided.setDone']);
  });

  it('names the side of a unilateral exercise', () => {
    const squat = guidedScript({
      exercise: getExercise('split-squat')!,
      name: 'Zancada',
      setNumber: 1,
      totalSets: 3,
      reps: 10,
      side: 'right',
    });
    expect(squat.preamble[0]).toEqual({
      key: 'guided.exerciseSide',
      params: { name: 'Zancada', side: 'right' },
    });
  });

  it('reads the note the professional left for this set', () => {
    const withNote = guidedScript({
      exercise: bridge,
      name: 'Puente de glúteos',
      setNumber: 1,
      totalSets: 3,
      reps: 12,
      physioNote: 'Sin arquear la espalda',
    });
    expect(withNote.preamble[1]).toEqual({
      key: 'guided.note',
      params: { note: 'Sin arquear la espalda' },
    });
  });

  it('ignores a note that is only whitespace', () => {
    const blank = guidedScript({
      exercise: bridge,
      name: 'Puente',
      setNumber: 1,
      totalSets: 1,
      reps: 8,
      physioNote: '   ',
    });
    expect(keys(blank.preamble)).not.toContain('guided.note');
  });
});

describe('guidedScript · holds', () => {
  const script = guidedScript({
    exercise: plank,
    name: 'Plancha frontal',
    setNumber: 1,
    totalSets: 3,
    holdSeconds: 30,
  });

  it('says hold rather than begin, and doses in seconds', () => {
    expect(keys(script.leadIn).at(-1)).toBe('guided.hold');
    expect(script.preamble[1]).toMatchObject({
      key: 'guided.doseHold',
      params: { set: 1, sets: 3, seconds: 30 },
    });
  });

  it('lasts exactly the hold it was given', () => {
    expect(script.workMs).toBe(30_000);
  });

  it('speaks the time remaining, in order, inside the hold', () => {
    // Halfway first, because thirty seconds of nothing is how somebody with
    // the phone across the room concludes the app has stopped.
    expect(script.rhythm[0]).toEqual({
      atMs: 15_000,
      key: 'guided.remaining',
      params: { seconds: 15 },
    });
    const times = script.rhythm.map((beat) => beat.atMs);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(new Set(times).size).toBe(times.length);
  });

  it('never leaves a long stretch of a library hold unspoken', () => {
    // The library's holds run from 20 to 30 seconds. Beyond that a
    // hand-edited dose gets one midpoint and the countdown, which is the
    // shape, not a promise about the gap.
    for (const seconds of [15, 20, 25, 30]) {
      const held = guidedScript({
        exercise: plank,
        name: 'Plancha frontal',
        setNumber: 1,
        totalSets: 1,
        holdSeconds: seconds,
      });
      const times = [0, ...held.rhythm.map((beat) => beat.atMs)];
      const gaps = times.slice(1).map((at, index) => at - (times[index] ?? 0));
      expect(Math.max(...gaps)).toBeLessThanOrEqual(15_000);
    }
  });

  it('says when the hold is over, on the instant it is over', () => {
    // Otherwise the last word is "one", a second early, and a thirty second
    // stretch gets held for twenty-nine.
    expect(script.rhythm.at(-1)).toEqual({ atMs: 30_000, key: 'guided.release' });
  });

  it('counts nothing during a hold too short to narrate, but still calls the end', () => {
    const brief = guidedScript({
      exercise: plank,
      name: 'Plancha frontal',
      setNumber: 1,
      totalSets: 1,
      holdSeconds: 1,
    });
    expect(brief.rhythm).toEqual([{ atMs: 1000, key: 'guided.release' }]);
    expect(brief.workMs).toBe(1000);
  });
});

describe('restScript', () => {
  it('says how long the rest is, and calls everybody back before it ends', () => {
    const rest = restScript(45);
    expect(rest.preamble[0]).toEqual({ key: 'guided.rest', params: { seconds: 45 } });
    expect(rest.rhythm).toEqual([{ atMs: 42_000, key: 'guided.back' }]);
  });

  it('does not call anybody back from a rest too short to leave', () => {
    expect(restScript(4).rhythm).toEqual([]);
    expect(restScript(4).preamble).toHaveLength(1);
  });

  it('says nothing at all when there is no rest', () => {
    expect(restScript(0)).toEqual({ preamble: [], rhythm: [] });
  });
});

describe('guidedScript · the whole library', () => {
  it('produces a usable script for every exercise', () => {
    for (const id of [
      'glute-bridge',
      'front-plank',
      'cat-camel',
      'side-plank-full',
      'split-squat',
      'wall-angels',
      'childs-pose',
    ]) {
      const exercise = getExercise(id)!;
      const script = guidedScript({
        exercise,
        name: id,
        setNumber: 1,
        totalSets: exercise.defaults.sets,
        ...(exercise.defaults.reps ? { reps: exercise.defaults.reps } : {}),
        ...(exercise.defaults.holdSeconds ? { holdSeconds: exercise.defaults.holdSeconds } : {}),
      });
      expect(script.workMs, id).toBeGreaterThan(0);
      expect(script.preamble.length, id).toBeGreaterThanOrEqual(3);
      expect(script.leadIn.length, id).toBeGreaterThan(3);
      expect(
        script.rhythm.every((beat) => beat.atMs <= script.workMs),
        id,
      ).toBe(true);
    }
  });
});
