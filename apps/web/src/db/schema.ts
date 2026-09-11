/**
 * Local database.
 *
 * Everything Kinetrace knows lives here, on the device. No account, no sync, no
 * server. Skeleton tracks are the only bulky rows and they prune themselves.
 */

import Dexie, { type EntityTable } from 'dexie';
import type { TargetBand } from '@kinetrace/engine';
import type { ImportedItem } from '@kinetrace/import';
import type { Language } from '../i18n/index.js';

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
  createdAt: number;
}

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
  /** Text kept from a sheet import when no exercise matched. */
  customNote?: string;
}

export interface Routine {
  id: number;
  profileId: number;
  name: string;
  exercises: RoutineExercise[];
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
  /** Listen for spoken commands during a session. Off until asked for: it
   *  downloads a model and needs the microphone. */
  voiceCommands: boolean;
  /** Whisper size used for voice commands. */
  voiceModel: 'tiny' | 'base';
  poseModel: 'lite' | 'full' | 'heavy';
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
  voiceCommands: false,
  voiceModel: 'tiny',
  poseModel: 'full',
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
