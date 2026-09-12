/**
 * The guided session.
 *
 * Owns the walk through the plan, the engine worker, the camera loop, the
 * gestures, the spoken cues and what gets written to the database when a set
 * ends. The session screen only renders what this hook reports.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GestureDetector,
  TrackRecorder,
  type PoseFrame,
  type RunnerState,
  type RunnerUpdate,
  type SkeletonTrack,
  type Vec3,
} from '@kinetrace/engine';
import { toRunnerConfig } from '@kinetrace/exercises';
import { createEngineClient, type EngineClient } from './engineClient.js';
import { buildPlan, type PlanItem } from './plan.js';
import { useCamera, useVideoFrameLoop } from './useCamera.js';
import { PoseAdapter } from '../pose/adapter.js';
import { LEVEL_CAMERA, watchGravity, type GravityReading } from '../pose/gravity.js';
import { browserWakeLock, ScreenWakeLock } from './wakeLock.js';
import { Speaker } from '../speech/speech.js';
import { EarconPlayer } from '../speech/earcons.js';
import { saveSet, setsForSession, startSession } from '../db/repositories.js';
import type { Routine } from '../db/schema.js';
import { useSettingsStore } from '../store/useSettingsStore.js';
import { useTranslation } from '../i18n/useTranslation.js';

export type SessionStage =
  'loading' | 'setup' | 'active' | 'rest' | 'paused' | 'finished' | 'error';

export interface SessionView {
  stage: SessionStage;
  item: PlanItem | null;
  /** Progress through the whole session, `[0, 1]`. */
  progress: number;
  state: RunnerState | null;
  /** Latest pose frame, for the stick figure. */
  frame: PoseFrame | null;
  cueText: string | null;
  restRemainingSeconds: number;
  error?: string;
  sessionId?: number;
  /** True while the pose model is still loading. */
  modelLoading: boolean;
  gravity: GravityReading;
  /** False where the browser cannot keep the screen awake, so the app can say so. */
  canKeepScreenAwake: boolean;
}

export interface SessionControls {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Ask for the camera and open the setup assistant. */
  start: () => Promise<void>;
  /** Leave the setup assistant and start counting. */
  begin: () => void;
  togglePause: () => void;
  /** Pause or resume explicitly. Voice commands are not a toggle. */
  setPaused: (paused: boolean) => void;
  /** Say the last cue again, or where the set is up to if there was none. */
  repeatCue: () => void;
  /** Throw the current set away and do it again. Nothing is written. */
  redoSet: () => void;
  skipSet: () => void;
  finish: () => Promise<number | undefined>;
  cameraStatus: ReturnType<typeof useCamera>['status'];
  cameraError?: string;
}

const CUE_VISIBLE_MS = 3500;

export function useSessionRunner(
  routine: Routine | undefined,
  profileId: number | undefined,
  /** Carry on a session that was started and never finished. */
  resumeSessionId?: number,
): SessionView & SessionControls {
  const settings = useSettingsStore();
  const { t, language } = useTranslation();
  const camera = useCamera('user');

  const plan = useMemo(() => (routine ? buildPlan(routine) : []), [routine]);
  const [stage, setStage] = useState<SessionStage>('loading');
  const [index, setIndex] = useState(0);
  /** Bumped to start the current set over; nothing else depends on its value. */
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<RunnerState | null>(null);
  const [frame, setFrame] = useState<PoseFrame | null>(null);
  const [cueText, setCueText] = useState<string | null>(null);
  const [restRemaining, setRestRemaining] = useState(0);
  const [error, setError] = useState<string | undefined>();
  const [sessionId, setSessionId] = useState<number | undefined>(resumeSessionId);
  const [modelLoading, setModelLoading] = useState(true);
  const [gravity, setGravity] = useState<GravityReading>(LEVEL_CAMERA);

  const adapterRef = useRef<PoseAdapter | null>(null);
  const engineRef = useRef<EngineClient | null>(null);
  const recorderRef = useRef<TrackRecorder | null>(null);
  const gestureRef = useRef(new GestureDetector());
  const speakerRef = useRef<Speaker | null>(null);
  const earconRef = useRef<EarconPlayer | null>(null);
  const gravityRef = useRef<Vec3 | undefined>(undefined);
  const wakeLockRef = useRef<ScreenWakeLock | null>(null);
  wakeLockRef.current ??= new ScreenWakeLock(browserWakeLock());
  const stageRef = useRef<SessionStage>('loading');
  const indexRef = useRef(0);
  const setStartedAtRef = useRef(Date.now());
  const cueTimerRef = useRef<number | undefined>(undefined);
  /** Kept past the banner's lifetime so "repeat" has something to say. */
  const lastCueRef = useRef<string | null>(null);
  const savingRef = useRef(false);

  stageRef.current = stage;
  indexRef.current = index;

  const item = plan[index] ?? null;

  // Speech and sound follow the settings without recreating the session.
  useEffect(() => {
    speakerRef.current ??= new Speaker(language, settings.speakCues);
    speakerRef.current.setLanguage(language);
    speakerRef.current.setEnabled(settings.speakCues);
    earconRef.current ??= new EarconPlayer(settings.earcons);
    earconRef.current.setEnabled(settings.earcons);
  }, [language, settings.speakCues, settings.earcons]);

  /**
   * Picking up where an interrupted session stopped. Every set was written the
   * moment it ended, so the position to carry on from is simply after the last
   * one recorded — no state had to survive the app closing.
   */
  useEffect(() => {
    if (resumeSessionId === undefined) return;
    let cancelled = false;
    void setsForSession(resumeSessionId).then((sets) => {
      if (cancelled || sets.length === 0) return;
      const next = Math.max(...sets.map((set) => set.index)) + 1;
      setIndex(Math.min(next, Math.max(0, plan.length - 1)));
      if (next >= plan.length) setStage('finished');
    });
    return () => {
      cancelled = true;
    };
  }, [resumeSessionId, plan.length]);

  // Load the pose model once per session.
  useEffect(() => {
    let cancelled = false;
    setModelLoading(true);
    PoseAdapter.create({ variant: settings.poseModel })
      .then((adapter) => {
        if (cancelled) {
          adapter.close();
          return;
        }
        adapterRef.current = adapter;
        setModelLoading(false);
        setStage((current) => (current === 'loading' ? 'setup' : current));
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'model');
        setStage('error');
        setModelLoading(false);
      });
    return () => {
      cancelled = true;
      adapterRef.current?.close();
      adapterRef.current = null;
    };
  }, [settings.poseModel]);

  /**
   * The phone is on the floor and nobody is touching it, so the screen would
   * otherwise lock in the middle of a set. The browser takes the lock back every
   * time the page is hidden and does not return it, hence the visibility listener.
   */
  const running =
    camera.status === 'ready' && stage !== 'finished' && stage !== 'error' && stage !== 'loading';
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

  useEffect(() => {
    return watchGravity(camera.facing, (reading) => {
      gravityRef.current = reading.measured ? reading.up : undefined;
      setGravity(reading);
    });
  }, [camera.facing]);

  const showCue = useCallback((text: string, speak: boolean) => {
    setCueText(text);
    lastCueRef.current = text;
    if (speak) speakerRef.current?.say(text);
    window.clearTimeout(cueTimerRef.current);
    cueTimerRef.current = window.setTimeout(() => setCueText(null), CUE_VISIBLE_MS);
  }, []);

  /** Write the finished set to the database and move on. */
  const completeSet = useCallback(
    async (finalState: RunnerState | null) => {
      if (savingRef.current) return;
      savingRef.current = true;
      const current = plan[indexRef.current];
      const track: SkeletonTrack | undefined = settings.keepTracks
        ? recorderRef.current?.finish()
        : undefined;

      if (sessionId !== undefined && current?.tracked && finalState) {
        await saveSet(
          {
            sessionId,
            exerciseId: current.exerciseId,
            index: current.index,
            reps: finalState.reps,
            partials: finalState.partials,
            holdMs: finalState.heldMs,
            romMax: Number.isFinite(finalState.romMax) ? finalState.romMax : 0,
            romMean: Number.isFinite(finalState.romMean) ? finalState.romMean : 0,
            goodRepPct: finalState.goodRepPct,
            issues: finalState.issues,
            peaks: finalState.peaks,
            startedAt: setStartedAtRef.current,
          },
          track,
        );
      }

      earconRef.current?.play('setComplete');
      const nextIndex = indexRef.current + 1;
      engineRef.current?.dispose();
      engineRef.current = null;
      recorderRef.current = null;
      setState(null);

      if (nextIndex >= plan.length) {
        setStage('finished');
        savingRef.current = false;
        return;
      }
      setIndex(nextIndex);
      const rest = current?.restSeconds ?? 0;
      if (rest > 0) {
        setRestRemaining(rest);
        setStage('rest');
      } else {
        setStage('active');
      }
      savingRef.current = false;
    },
    [plan, sessionId, settings.keepTracks],
  );

  // Create the engine for the current set.
  useEffect(() => {
    if (stage !== 'active' || !item?.exercise) return;
    setStartedAtRef.current = Date.now();
    recorderRef.current = new TrackRecorder();
    const config = toRunnerConfig(item.exercise, {
      band: item.band,
      safety: item.safety,
      reps: item.reps,
      holdSeconds: item.holdSeconds,
    });
    const client = createEngineClient(
      config,
      (update: RunnerUpdate) => {
        setState(update.state);
        if (update.cue) {
          showCue(t(update.cue.cueKey, update.cue.params), update.cue.speak);
          if (update.cue.cueKey === 'engine.goodRep') earconRef.current?.play('goodRep');
          if (update.cue.cueKey === 'engine.partialRep') earconRef.current?.play('partialRep');
        }
        const targetReps = item.reps;
        const done =
          (item.exercise?.mode === 'hold' && update.state.holdComplete) ||
          (targetReps !== undefined &&
            item.exercise?.mode === 'reps' &&
            update.state.reps + update.state.partials >= targetReps);
        if (done) void completeSet(update.state);
      },
      (message) => setError(message),
    );
    engineRef.current = client;
    return () => {
      client.dispose();
      engineRef.current = null;
    };
  }, [stage, item, attempt, completeSet, showCue, t]);

  // Rest countdown.
  useEffect(() => {
    if (stage !== 'rest') return;
    const interval = window.setInterval(() => {
      setRestRemaining((remaining) => {
        if (remaining <= 1) {
          window.clearInterval(interval);
          setStage('active');
          return 0;
        }
        return remaining - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [stage]);

  const togglePause = useCallback(() => {
    earconRef.current?.play('pause');
    setStage((current) => {
      if (current === 'paused') return 'active';
      if (current === 'active' || current === 'rest') return 'paused';
      return current;
    });
  }, []);

  const setPaused = useCallback((paused: boolean) => {
    setStage((current) => {
      if (paused && (current === 'active' || current === 'rest')) {
        earconRef.current?.play('pause');
        return 'paused';
      }
      if (!paused && current === 'paused') {
        earconRef.current?.play('pause');
        return 'active';
      }
      return current;
    });
  }, []);

  /**
   * Somebody on the mat two metres from the phone cannot read the banner they
   * missed, so "repeat" says the last cue again, and where the set is up to
   * when there has not been one.
   */
  const repeatCue = useCallback(() => {
    const current = plan[indexRef.current];
    const exercise = current?.exercise;
    const name = exercise?.names[language] ?? current?.customNote ?? '';
    const progressText =
      exercise?.mode === 'hold'
        ? t('session.holdFor', { seconds: current?.holdSeconds ?? 0 })
        : t('session.repsOf', { current: state?.reps ?? 0, total: current?.reps ?? 0 });
    const text = lastCueRef.current ?? [name, progressText].filter(Boolean).join('. ');
    if (text) showCue(text, true);
  }, [language, plan, showCue, state?.reps, t]);

  /**
   * The counterpart to skipping. A set ruined by the tracking losing you, or by
   * lying down crooked, was saved as it came out and the session moved on — so
   * the history filled up with sets the person knew did not count. This writes
   * nothing: the engine is rebuilt and the same set starts again.
   */
  const redoSet = useCallback(() => {
    if (stageRef.current !== 'active' && stageRef.current !== 'paused') return;
    recorderRef.current = null;
    setState(null);
    setAttempt((current) => current + 1);
    setStage('active');
  }, []);

  const skipSet = useCallback(() => {
    if (stageRef.current === 'rest') {
      setRestRemaining(0);
      setStage('active');
      return;
    }
    void completeSet(state);
  }, [completeSet, state]);

  // The frame loop: pose detection on the main thread, everything else in the worker.
  useVideoFrameLoop(
    camera.videoRef,
    camera.status === 'ready' && !modelLoading,
    (video, timestampMs) => {
      const adapter = adapterRef.current;
      if (!adapter) return;
      const detected = adapter.detect(video, timestampMs, gravityRef.current);
      if (!detected) return;
      setFrame(detected);

      for (const gesture of gestureRef.current.update(detected)) {
        if (gesture.type === 'pauseToggle') togglePause();
        if (gesture.type === 'skip' && stageRef.current !== 'paused') skipSet();
      }

      if (stageRef.current !== 'active') return;
      recorderRef.current?.add(detected);
      engineRef.current?.update(detected);
    },
  );

  const start = useCallback(async () => {
    earconRef.current?.unlock();
    await camera.start();
    if (profileId !== undefined && routine && sessionId === undefined) {
      setSessionId(await startSession(profileId, routine.id));
    }
    // The camera setup assistant decides when counting starts: a session that
    // begins before the body is framed would count nonsense.
    setStage(modelLoading ? 'loading' : 'setup');
  }, [camera, modelLoading, profileId, routine, sessionId]);

  const begin = useCallback(() => {
    setStage((current) => (current === 'setup' ? 'active' : current));
  }, []);

  const finish = useCallback(async () => {
    engineRef.current?.dispose();
    engineRef.current = null;
    speakerRef.current?.cancel();
    camera.stop();
    setStage('finished');
    return sessionId;
  }, [camera, sessionId]);

  useEffect(() => {
    return () => {
      window.clearTimeout(cueTimerRef.current);
      engineRef.current?.dispose();
      speakerRef.current?.cancel();
    };
  }, []);

  return {
    stage,
    item,
    progress: plan.length === 0 ? 0 : index / plan.length,
    state,
    frame,
    cueText,
    restRemainingSeconds: restRemaining,
    error,
    sessionId,
    modelLoading,
    gravity,
    canKeepScreenAwake: wakeLockRef.current?.supported ?? false,
    videoRef: camera.videoRef,
    start,
    begin,
    togglePause,
    setPaused,
    repeatCue,
    redoSet,
    skipSet,
    finish,
    cameraStatus: camera.status,
    cameraError: camera.error,
  };
}
