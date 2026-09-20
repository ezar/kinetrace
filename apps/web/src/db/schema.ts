/**
 * Local database.
 *
 * Everything Kinetrace knows lives here, on the device. No account, no sync, no
 * server. Skeleton tracks are the only bulky rows and they prune themselves.
 */

import Dexie, { type EntityTable } from 'dexie';
import type { TargetBand, TempoTarget } from '@kinetrace/engine';
import type { ImportedItem } from '@kinetrace/import';
import type { Language } from '../i18n/index.js';

/**
 * A limb, as prescribed and as recorded. Narrower than the engine's `BodySide`
 * on purpose: `auto` and `mean` are answers about how to measure, not about
 * which side somebody was told to work.
 */
export type PrescribedSide = 'left' | 'right';

export interface Profile {
  id: number;
  name: string;
  /** Accent colour used across the app for this person. */
  color: string;
  language: Language;
  /** Only used as a scale sanity check, in centimetres. */
  heightCm?: number;
  /** Free text the user copied from their physiotherapist. Never interpreted. */
  physioNotes: string;
  /**
   * Exercises this person has said they already know, so the demonstration
   * before a session stops offering them. Undoable from settings, all at once:
   * it is a convenience, not a decision anybody should have to live with.
   */
  demoDismissed?: string[];
  createdAt: number;
}

/** The accent colours a profile can take. Shared by the profile form and the
 *  first run, which must offer the same ones. */
export const PROFILE_COLORS = [
  '#d9702f',
  '#34618f',
  '#2c7a58',
  '#8a5bab',
  '#b3352a',
  '#3f7f8f',
] as const;

export interface RoutineExercise {
  exerciseId: string;
  sets: number;
  /** Repetitions per set, for repetition exercises. */
  reps?: number;
  /** Hold time per set in seconds, for isometrics. */
  holdSeconds?: number;
  restSeconds: number;
  /** Target band for this profile, in degrees. Absent means the library default. */
  band?: TargetBand;
  /** Safety stop for this profile, in degrees. Absent means the library default. */
  safety?: TargetBand;
  /** Seconds each phase should take. Absent means pacing is not judged. */
  tempo?: TempoTarget[];
  /**
   * Which limb a unilateral exercise is prescribed for. Absent means both, done
   * as a full run of sets on one side and then the other — which is also what
   * every routine written before this field existed means.
   */
  side?: PrescribedSide;
  /** A line from the professional who reviewed this exercise, for the patient. */
  physioNote?: string;
  /** Text kept from a sheet import when no exercise matched. */
  customNote?: string;
  /**
   * The instruction a published programme printed for this exercise, verbatim.
   *
   * Set only when the routine was built from a document, and never rewritten:
   * it is the quotation the numbers on this card came from, which is what makes
   * them checkable against the paper somebody was handed.
   */
  sourceNote?: string;
}

/**
 * The publication a routine was transcribed from.
 *
 * Deliberately not a `review`: a document is not a professional who looked at
 * this person and signed. A routine can have a source and still be unsigned,
 * and that is exactly the state a transcribed programme starts in.
 */
export interface RoutineSource {
  /** Programme id, so the app can find the steps it could not run. */
  programmeId: string;
  title: string;
  publisher: string;
  year: number;
  url?: string;
}

/**
 * A professional's sign-off on a routine. Local like everything else: it is a
 * record that somebody sat down and checked the numbers, not an authentication.
 */
export interface RoutineReview {
  /** The name the professional signed with. */
  by: string;
  at: number;
  /** A note about the routine as a whole. */
  note?: string;
}

export interface Routine {
  id: number;
  profileId: number;
  name: string;
  exercises: RoutineExercise[];
  /** Set when a professional has been through the exercises and signed. */
  review?: RoutineReview;
  /** Set when the routine was transcribed from a published programme. */
  source?: RoutineSource;
  createdAt: number;
  updatedAt: number;
}

export interface Session {
  id: number;
  profileId: number;
  routineId: number;
  startedAt: number;
  endedAt?: number;
  notes?: string;
  /** The user's own 0 to 10 note about pain. Never an input to any logic. */
  painScore?: number;
}

export interface SetRecord {
  id: number;
  sessionId: number;
  exerciseId: string;
  /** Position of the set inside the session, starting at 0. */
  index: number;
  reps: number;
  partials: number;
  holdMs: number;
  /** Best peak of the set, in degrees. */
  romMax: number;
  /** Mean peak of the set, in degrees. */
  romMean: number;
  goodRepPct: number;
  /** Count of cues per rule id. */
  issues: Record<string, number>;
  /** Peak of every repetition, in degrees. */
  peaks: number[];
  /** The limb this set was done on, for a unilateral exercise. */
  side?: PrescribedSide;
  /**
   * False for a set done without the camera, where the app called the pace and
   * measured nothing. Absent means measured, which is what every set recorded
   * before the guided mode existed was.
   *
   * The counts on an unmeasured set are the prescription, not an observation:
   * the person was asked for twelve repetitions and said nothing to the
   * contrary. They are worth keeping — turning up is the thing that decides
   * whether rehabilitation works — but they are not evidence of anything, and
   * nothing that reports a range may include them.
   */
  measured?: false;
  startedAt: number;
}

export interface LandmarkTrack {
  id: number;
  setId: number;
  fps: number;
  frameCount: number;
  positions: Int16Array;
  visibility: Uint8Array;
  startedAt: number;
}

export interface ImportRecord {
  id: number;
  profileId: number;
  createdAt: number;
  /** The text the OCR read. The photograph itself is never stored. */
  ocrText: string;
  items: ImportedItem[];
  routineId?: number;
}

export interface AppSettings {
  key: 'app';
  language: Language;
  speakCues: boolean;
  earcons: boolean;
  showCameraPreview: boolean;
  /** True once the first run has been walked through, or skipped. */
  onboarded: boolean;
  /** True once installing the app has been offered and answered, either way. */
  installOffered: boolean;
  /** Listen for spoken commands during a session. Off until asked for: it
   *  downloads a model and needs the microphone. */
  voiceCommands: boolean;
  /** Whisper size used for voice commands. */
  voiceModel: 'tiny' | 'base';
  poseModel: 'lite' | 'full' | 'heavy';
  /**
   * When to show what an exercise looks like before doing it. `new` shows the
   * figure for an exercise this profile has never recorded, and for every
   * exercise while the first few sessions are still settling in.
   */
  showDemo: 'new' | 'always' | 'never';
  keepTracks: boolean;
  /** Days a skeleton track is kept before it is pruned. */
  trackRetentionDays: number;
  activeProfileId?: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  key: 'app',
  language: 'es',
  speakCues: true,
  earcons: true,
  showCameraPreview: true,
  onboarded: false,
  installOffered: false,
  voiceCommands: false,
  voiceModel: 'tiny',
  poseModel: 'full',
  showDemo: 'new',
  keepTracks: true,
  trackRetentionDays: 90,
};

export class KinetraceDatabase extends Dexie {
  profiles!: EntityTable<Profile, 'id'>;
  routines!: EntityTable<Routine, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  sets!: EntityTable<SetRecord, 'id'>;
  landmarkTracks!: EntityTable<LandmarkTrack, 'id'>;
  imports!: EntityTable<ImportRecord, 'id'>;
  settings!: EntityTable<AppSettings, 'key'>;

  constructor() {
    super('kinetrace');
    this.version(1).stores({
      profiles: '++id, name, createdAt',
      routines: '++id, profileId, updatedAt',
      sessions: '++id, profileId, routineId, startedAt',
      sets: '++id, sessionId, exerciseId, startedAt',
      landmarkTracks: '++id, setId, startedAt',
      imports: '++id, profileId, createdAt',
      settings: 'key',
    });
  }
}

export const db = new KinetraceDatabase();
