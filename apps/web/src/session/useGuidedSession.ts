/**
 * A session run by voice, with no camera.
 *
 * Everything the measured session does with landmarks, this does with a clock.
 * The script comes from the library — `guidedScript` decides what to say and
 * when — and this hook is the part that owns time: it speaks the preamble line
 * by line, runs the rhythm against a clock that pause actually stops, and
 * writes the set.
 *
 * Every set it writes carries `measured: false`. That flag is the whole reason
 * this mode is allowed to exist: it records that somebody turned up and did the
 * work, and it claims nothing whatsoever about how well.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { guidedScript, restScript, type GuidedBeat, type GuidedLine } from '@kinetrace/exercises';
import { saveSet, startSession } from '../db/repositories.js';
import { Speaker } from '../speech/speech.js';
import { EarconPlayer } from '../speech/earcons.js';
import { ScreenWakeLock, browserWakeLock } from './wakeLock.js';
import { useSettingsStore } from '../store/useSettingsStore.js';
import { useTranslation } from '../i18n/useTranslation.js';
import type { PlanItem } from './plan.js';

export type GuidedStage = 'ready' | 'working' | 'resting' | 'paused' | 'finished';

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
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [attempt, setAttempt] = useState(0);

  const speakerRef = useRef<Speaker | null>(null);
  const earconRef = useRef<EarconPlayer | null>(null);
  const wakeLockRef = useRef<ScreenWakeLock | null>(null);
  const startedAtRef = useRef(Date.now());

  const item = plan[index];

  useEffect(() => {
    // Guided mode is a voice; cue speech being off would leave it mute, so it
    // speaks regardless of the cue setting and only the earcons follow it.
    speakerRef.current ??= new Speaker(language, true);
    speakerRef.current.setLanguage(language);
    earconRef.current ??= new EarconPlayer(settings.earcons);
    earconRef.current.setEnabled(settings.earcons);
    wakeLockRef.current ??= new ScreenWakeLock(browserWakeLock());
  }, [language, settings.earcons]);

  /** The phone is across the room here too, and nobody is going to touch it. */
  useEffect(() => {
    const lock = wakeLockRef.current;
    if (!lock || stage === 'finished' || stage === 'ready') return;
    void lock.acquire();
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void lock.refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void lock.release();
    };
  }, [stage]);

  /** Resolve a scripted line into the sentence to say. */
  const render = useCallback(
    (line: GuidedLine): string => {
      const params = { ...(line.params ?? {}) };
      if (typeof params['side'] === 'string') params['side'] = t(`side.${params['side']}`);
      return t(line.key, params as Record<string, string | number>);
    },
    [t],
  );

  const script = useMemo(() => {
    if (!item?.exercise) return null;
    return guidedScript({
      exercise: item.exercise,
      name: item.exercise.names[language],
      setNumber: item.setNumber,
      totalSets: item.totalSets,
      ...(item.reps !== undefined ? { reps: item.reps } : {}),
      ...(item.holdSeconds !== undefined ? { holdSeconds: item.holdSeconds } : {}),
      ...(item.side ? { side: item.side } : {}),
      ...(item.tempo ? { tempo: item.tempo } : {}),
      ...(item.physioNote ? { physioNote: item.physioNote } : {}),
    });
  }, [item, language]);

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
      for (const line of script.preamble) {
        if (abandoned) return;
        await say(line);
      }
      if (abandoned) return;

      const startedAt = Date.now();
      startedAtRef.current = startedAt;
      setRepsDone(0);
      const schedule = (beat: GuidedBeat): void => {
        timers.push(
          window.setTimeout(() => {
            if (abandoned) return;
            // A counted repetition is the big number on screen; every other
            // beat is a countdown the clock is already showing.
            if (beat.key === 'guided.rep') {
              const n = beat.params?.['n'];
              if (typeof n === 'number') setRepsDone(n);
            }
            void say(beat, false);
          }, beat.atMs),
        );
      };
      for (const beat of script.rhythm) schedule(beat);

      const tick = window.setInterval(() => {
        const left = Math.ceil((script.workMs - (Date.now() - startedAt)) / 1000);
        setRemaining(Math.max(0, left));
      }, 250);
      timers.push(tick as unknown as number);

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
        }, script.workMs),
      );
    };

    void run();
    return () => {
      abandoned = true;
      for (const timer of timers) window.clearTimeout(timer);
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
    const interval = window.setInterval(() => {
      setRemaining((left) => {
        if (left <= 1) {
          window.clearInterval(interval);
          setStage('working');
          setAttempt((value) => value + 1);
          return 0;
        }
        return left - 1;
      });
    }, 1000);
    return () => {
      window.clearInterval(interval);
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [stage, index, plan, render]);

  const begin = useCallback(() => {
    if (profileId === undefined) return;
    void startSession(profileId, routineId).then(setSessionId);
    setStage('working');
    setAttempt((value) => value + 1);
  }, [profileId, routineId]);

  const togglePause = useCallback(() => {
    earconRef.current?.play('pause');
    setStage((current) => {
      if (current === 'paused') return 'working';
      if (current === 'working' || current === 'resting') {
        speakerRef.current?.cancel();
        return 'paused';
      }
      return current;
    });
    setAttempt((value) => value + 1);
  }, []);

  /** Move on without recording anything: the set did not happen. */
  const skip = useCallback(() => {
    speakerRef.current?.cancel();
    setIndex((current) => {
      const next = current + 1;
      if (next >= plan.length) {
        setStage('finished');
        return current;
      }
      return next;
    });
    setStage('working');
    setAttempt((value) => value + 1);
  }, [plan.length]);

  const redo = useCallback(() => {
    speakerRef.current?.cancel();
    setStage('working');
    setAttempt((value) => value + 1);
  }, []);

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
    sessionId,
    begin,
    togglePause,
    skip,
    redo,
    finish,
  };
}
