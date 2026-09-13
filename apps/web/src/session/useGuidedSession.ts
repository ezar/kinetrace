/**
 * A session run by voice, with no camera.
 *
 * Everything the measured session does with landmarks, this does with a clock.
 * The script comes from the library — `guidedScript` decides what to say and
 * when — and this hook is the part that owns time: it speaks the preamble line
 * by line, runs the rhythm against a clock, and writes the set.
 *
 * Pausing abandons the set and resuming starts it again from the top, count-in
 * and all. That is a choice, not an oversight: there is no camera here, so the
 * app cannot know what was done before the interruption, and carrying on at
 * repetition eight would be counting repetitions nobody can vouch for. The
 * screen says so, and Repeat does the same thing deliberately.
 *
 * Every set it writes carries `measured: false`. That flag is the whole reason
 * this mode is allowed to exist: it records that somebody turned up and did the
 * work, and it claims nothing whatsoever about how well.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { guidedScript, restScript, type GuidedBeat, type GuidedLine } from '@kinetrace/exercises';
import { finishSession, saveSet, startSession } from '../db/repositories.js';
import { Speaker } from '../speech/speech.js';
import { EarconPlayer } from '../speech/earcons.js';
import { ScreenWakeLock, browserWakeLock } from './wakeLock.js';
import { useSettingsStore } from '../store/useSettingsStore.js';
import { useTranslation } from '../i18n/useTranslation.js';
import type { PlanItem } from './plan.js';

export type GuidedStage = 'ready' | 'working' | 'resting' | 'paused' | 'finished';

/**
 * What the big number on screen is counting.
 *
 * It comes from the hook rather than from the plan item so that the screen and
 * the voice can never disagree — `guidedScript` decides a hold from
 * `exercise.mode`, and a routine edited by hand can carry `holdSeconds` on a
 * repetition exercise — and so that it survives a pause, which used to flip a
 * rest clock into the previous set's repetition tally.
 */
export type GuidedCount = 'reps' | 'seconds';

export interface GuidedSessionState {
  stage: GuidedStage;
  item: PlanItem | undefined;
  index: number;
  total: number;
  /** The line being said right now, for the people who can see the screen. */
  spoken: string;
  /** Seconds left in the current set or rest. */
  remaining: number;
  /** Repetitions counted out so far in this set. */
  repsDone: number;
  /** Whether the big number is repetitions done or seconds left. */
  counting: GuidedCount;
  /**
   * The clock the figure on screen animates to, while there is one.
   *
   * Absent during the count-in, a rest or a pause, when the figure should be
   * holding the starting position rather than moving through a repetition
   * nobody is doing.
   */
  motion: { startedAt: number; cycleMs: number } | undefined;
  sessionId: number | undefined;
  begin: () => void;
  togglePause: () => void;
  skip: () => void;
  redo: () => void;
  finish: () => void;
}

/** How long a spoken line is given before the next one starts, if the voice
 *  cannot tell us it has finished. Speech synthesis fires `end` on every real
 *  browser; this is the fallback so a missing event cannot stall the session. */
const LINE_TIMEOUT_MS = 6000;

/**
 * Breath between the last beat of a set and "set done".
 *
 * Speaking a line cancels whatever is still being said, so without this the
 * closing line cut off the final repetition count — the one number the person
 * was waiting to hear.
 */
const EPILOGUE_GAP_MS = 1200;

/** Beats the screen is already showing as its big number. */
const NUMBER_BEATS = new Set(['guided.rep', 'guided.count', 'guided.remaining']);

export function useGuidedSession(
  plan: PlanItem[],
  routineId: number,
  profileId: number | undefined,
): GuidedSessionState {
  const { t, language } = useTranslation();
  const settings = useSettingsStore();
  const [stage, setStage] = useState<GuidedStage>('ready');
  const [index, setIndex] = useState(0);
  const [spoken, setSpoken] = useState('');
  const [remaining, setRemaining] = useState(0);
  const [repsDone, setRepsDone] = useState(0);
  const [motion, setMotion] = useState<{ startedAt: number; cycleMs: number } | undefined>();
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [attempt, setAttempt] = useState(0);

  const speakerRef = useRef<Speaker | null>(null);
  const earconRef = useRef<EarconPlayer | null>(null);
  const wakeLockRef = useRef<ScreenWakeLock | null>(null);
  const startedAtRef = useRef(Date.now());

  const item = plan[index];
  const [counting, setCounting] = useState<GuidedCount>('seconds');
  /** What to go back to when the pause ends. Resuming used to always land in
   *  the next set, which ate whatever was left of a rest. */
  const [pausedFrom, setPausedFrom] = useState<'working' | 'resting'>('working');

  useEffect(() => {
    // Guided mode is a voice; cue speech being off would leave it mute, so it
    // speaks regardless of the cue setting and only the earcons follow it.
    speakerRef.current ??= new Speaker(language, true);
    speakerRef.current.setLanguage(language);
    earconRef.current ??= new EarconPlayer(settings.earcons);
    earconRef.current.setEnabled(settings.earcons);
    wakeLockRef.current ??= new ScreenWakeLock(browserWakeLock());
  }, [language, settings.earcons]);

  /**
   * The phone is across the room here too, and nobody is going to touch it.
   *
   * Keyed on one boolean rather than on the stage: stage flips between working
   * and resting on every set, and releasing and re-requesting the lock twenty
   * odd times a routine only creates chances for one refusal to lose it.
   */
  const running = stage !== 'finished' && stage !== 'ready';
  useEffect(() => {
    const lock = wakeLockRef.current;
    if (!lock || !running) return;
    void lock.acquire();
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void lock.refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void lock.release();
    };
  }, [running]);

  /** Resolve a scripted line into the sentence to say. */
  const render = useCallback(
    (line: GuidedLine): string => {
      const params = { ...(line.params ?? {}) };
      if (typeof params['side'] === 'string') params['side'] = t(`side.${params['side']}`);
      return t(line.key, params as Record<string, string | number>);
    },
    [t],
  );

  /**
   * A routine can carry text from an imported sheet that matched no exercise.
   * There is nothing to pace and nothing to record, but it is still part of
   * what the physiotherapist wrote, so it is read out and then stepped past —
   * rather than leaving the session sitting on it in silence, which is what a
   * null script used to do.
   */
  const untracked = item !== undefined && item.exercise === undefined;

  useEffect(() => {
    if (stage !== 'working' || !untracked) return;
    const text = item?.customNote?.trim() ?? '';
    setSpoken(text);
    setRemaining(0);
    setRepsDone(0);
    let done = false;
    const step = (): void => {
      if (done) return;
      done = true;
      completeSetRef.current();
    };
    // The speaker says when it has finished; the timeout is only the guard
    // against a browser that never fires it.
    const guard = window.setTimeout(step, text ? LINE_TIMEOUT_MS : 500);
    if (text) speakerRef.current?.say(text, step);
    return () => {
      done = true;
      window.clearTimeout(guard);
    };
  }, [stage, untracked, item, attempt]);

  const script = useMemo(() => {
    if (!item?.exercise) return null;
    // The first set on the second leg: same exercise, other side. Everything
    // else about the announcement is identical, so the switch gets said.
    const previous = plan[index - 1];
    const switchSide =
      item.side !== undefined &&
      previous?.exerciseId === item.exerciseId &&
      previous.side !== undefined &&
      previous.side !== item.side;
    return guidedScript({
      exercise: item.exercise,
      ...(switchSide ? { switchSide: true as const } : {}),
      name: item.exercise.names[language],
      setNumber: item.setNumber,
      totalSets: item.totalSets,
      ...(item.reps !== undefined ? { reps: item.reps } : {}),
      ...(item.holdSeconds !== undefined ? { holdSeconds: item.holdSeconds } : {}),
      ...(item.side ? { side: item.side } : {}),
      ...(item.tempo ? { tempo: item.tempo } : {}),
      ...(item.physioNote ? { physioNote: item.physioNote } : {}),
    });
  }, [item, index, plan, language]);

  const completeSetRef = useRef<() => void>(() => undefined);
  const completeSet = useCallback(() => completeSetRef.current(), []);

  /**
   * Run a set: speak the preamble line by line, then the rhythm against a
   * clock, then the epilogue. Returns a function that abandons it, so pausing
   * and skipping stop the voice instead of talking over the next thing.
   */
  const runSet = useCallback(() => {
    if (!script) return () => undefined;
    let abandoned = false;
    const timers: number[] = [];
    const intervals: number[] = [];
    const speaker = speakerRef.current;

    const say = (line: GuidedLine, caption = true): Promise<void> =>
      new Promise((resolve) => {
        if (abandoned) return resolve();
        const text = render(line);
        if (caption) setSpoken(text);
        let settled = false;
        const done = (): void => {
          if (settled) return;
          settled = true;
          resolve();
        };
        timers.push(window.setTimeout(done, LINE_TIMEOUT_MS));
        if (speaker) speaker.say(text, done);
        else timers.push(window.setTimeout(done, 900));
      });

    const run = async (): Promise<void> => {
      // What the set is, before a word of it is spoken: the big number used to
      // read a giant "0" through the whole announcement and count in.
      const reps = script.rhythm.filter((beat) => beat.key === 'guided.rep').length;
      setCounting(reps > 0 ? 'reps' : 'seconds');
      setRepsDone(0);
      setRemaining(reps > 0 ? 0 : Math.round(script.workMs / 1000));

      for (const line of script.preamble) {
        if (abandoned) return;
        await say(line);
      }
      if (abandoned) return;

      // The count in, on a clock. Waiting for it is what makes three seconds
      // three seconds rather than as long as the voice takes to say it.
      await new Promise<void>((resolve) => {
        for (const beat of script.leadIn) {
          timers.push(
            window.setTimeout(() => {
              if (!abandoned) void say(beat);
            }, beat.atMs),
          );
        }
        timers.push(window.setTimeout(resolve, script.leadInMs));
      });
      if (abandoned) return;

      const startedAt = Date.now();
      startedAtRef.current = startedAt;
      setRepsDone(0);
      // The figure moves to the same clock the voice counts on, so what it
      // shows is the repetition being called and not a loop of its own.
      setMotion(reps > 0 ? { startedAt, cycleMs: script.workMs / reps } : undefined);
      const schedule = (beat: GuidedBeat): void => {
        timers.push(
          window.setTimeout(() => {
            if (abandoned) return;
            if (beat.key === 'guided.rep') {
              const n = beat.params?.['n'];
              if (typeof n === 'number') setRepsDone(n);
            }
            // A number is already the big number on screen, and captioning it
            // twice is noise. A movement — "round your back", "and down" — is
            // the one thing somebody looking at the phone needs to read, and
            // the caption used to sit on "begin" for the whole set.
            const isNumber = NUMBER_BEATS.has(beat.key);
            void say(beat, !isNumber);
          }, beat.atMs),
        );
      };
      for (const beat of script.rhythm) schedule(beat);

      const tick = window.setInterval(() => {
        const left = Math.ceil((script.workMs - (Date.now() - startedAt)) / 1000);
        setRemaining(Math.max(0, left));
      }, 250);
      intervals.push(tick);

      timers.push(
        window.setTimeout(() => {
          window.clearInterval(tick);
          if (abandoned) return;
          void (async () => {
            earconRef.current?.play('setComplete');
            for (const line of script.epilogue) {
              if (abandoned) return;
              await say(line);
            }
            if (!abandoned) void completeSet();
          })();
        }, script.workMs + EPILOGUE_GAP_MS),
      );
    };

    void run();
    return () => {
      abandoned = true;
      for (const timer of timers) window.clearTimeout(timer);
      for (const interval of intervals) window.clearInterval(interval);
      setMotion(undefined);
      speaker?.cancel();
    };
    // `completeSet` is stable: it only ever calls through its own ref.
  }, [script, render, completeSet]);

  completeSetRef.current = () => {
    const current = plan[index];
    if (sessionId !== undefined && current?.tracked) {
      void saveSet({
        sessionId,
        exerciseId: current.exerciseId,
        index: current.index,
        // The prescription, recorded as asked for. `measured: false` is what
        // stops anything downstream reading these as an observation.
        reps: current.reps ?? 0,
        partials: 0,
        holdMs: (current.holdSeconds ?? 0) * 1000,
        romMax: 0,
        romMean: 0,
        goodRepPct: 0,
        issues: {},
        peaks: [],
        ...(current.side ? { side: current.side } : {}),
        measured: false,
        startedAt: startedAtRef.current,
      });
    }
    const next = index + 1;
    if (next >= plan.length) {
      // Stamp it done here rather than leaving it to the summary screen. The
      // measured session does the same, and without it somebody who finishes
      // the work and puts the phone down has a session the streak, the progress
      // chart and the report all step over: they turned up and the app says
      // they did not.
      if (sessionId !== undefined) void finishSession(sessionId, {});
      setSpoken(t('guided.finished'));
      speakerRef.current?.say(t('guided.finished'));
      setStage('finished');
      return;
    }
    setIndex(next);
    const rest = plan[index]?.restSeconds ?? 0;
    if (rest > 0) {
      setRemaining(rest);
      setStage('resting');
    } else {
      setStage('working');
      setAttempt((value) => value + 1);
    }
  };

  // The working stage owns the set.
  useEffect(() => {
    if (stage !== 'working') return;
    const cancel = runSet();
    return cancel;
  }, [stage, index, attempt, runSet]);

  // The resting stage is a countdown with two things to say.
  useEffect(() => {
    if (stage !== 'resting') return;
    setCounting('seconds');
    const seconds = plan[Math.max(0, index - 1)]?.restSeconds ?? 0;
    const { preamble, rhythm } = restScript(seconds);
    const timers: number[] = [];
    for (const line of preamble) {
      const text = render(line);
      setSpoken(text);
      speakerRef.current?.say(text);
    }
    for (const beat of rhythm) {
      timers.push(
        window.setTimeout(() => {
          const text = render(beat);
          setSpoken(text);
          speakerRef.current?.say(text);
        }, beat.atMs),
      );
    }
    // The end of the rest is decided from a clock rather than inside the
    // `setRemaining` updater: an updater React re-invokes would bump `attempt`
    // twice and restart the set it had just begun.
    const endsAt = Date.now() + seconds * 1000;
    const interval = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        window.clearInterval(interval);
        setStage('working');
        setAttempt((value) => value + 1);
      }
    }, 250);
    return () => {
      window.clearInterval(interval);
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [stage, index, plan, render]);

  const begin = useCallback(() => {
    if (profileId === undefined) {
      // Reloading a deep link, or a profile deleted in another tab. The button
      // used to do nothing at all, which reads as a broken app.
      setSpoken(t('guided.noProfile'));
      return;
    }
    // Browsers only start an AudioContext from a user gesture, and this is the
    // only one the guided session gets. Without it the set-complete tone stays
    // silent for the whole routine — and on iOS the voice never starts either,
    // which in this mode is the whole session.
    earconRef.current?.unlock();
    speakerRef.current?.unlock();
    void startSession(profileId, routineId).then(setSessionId);
    setStage('working');
    setAttempt((value) => value + 1);
  }, [profileId, routineId, t]);

  const togglePause = useCallback(() => {
    earconRef.current?.play('pause');
    if (stage === 'paused') {
      setStage(pausedFrom);
      setAttempt((value) => value + 1);
      return;
    }
    if (stage !== 'working' && stage !== 'resting') return;
    speakerRef.current?.cancel();
    setPausedFrom(stage);
    setStage('paused');
    setAttempt((value) => value + 1);
  }, [stage, pausedFrom]);

  /**
   * Move on without recording anything: the set did not happen.
   *
   * The decision is taken here rather than inside the `setIndex` updater — a
   * state updater that also sets other state runs twice under StrictMode, and
   * the stage it chose used to be overwritten by the one set after it, so
   * skipping the last set replayed it instead of ending the session.
   */
  const skip = useCallback(() => {
    speakerRef.current?.cancel();
    const next = index + 1;
    if (next >= plan.length) {
      setStage('finished');
      return;
    }
    setIndex(next);
    setStage('working');
    setAttempt((value) => value + 1);
  }, [index, plan.length]);

  /**
   * Do the set again. During a rest the index has already moved on, so this
   * steps back to the set that was just finished — otherwise Repeat silently
   * started the next one and ate the rest.
   */
  const redo = useCallback(() => {
    speakerRef.current?.cancel();
    if (stage === 'resting' && index > 0) setIndex(index - 1);
    setStage('working');
    setAttempt((value) => value + 1);
  }, [stage, index]);

  const finish = useCallback(() => {
    speakerRef.current?.cancel();
    setStage('finished');
  }, []);

  return {
    stage,
    item,
    index,
    total: plan.length,
    spoken,
    remaining,
    repsDone,
    counting,
    motion,
    sessionId,
    begin,
    togglePause,
    skip,
    redo,
    finish,
  };
}
