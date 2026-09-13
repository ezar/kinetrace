/** Queries and mutations over the local database. */

import {
  db,
  DEFAULT_SETTINGS,
  type AppSettings,
  type Profile,
  type Routine,
  type Session,
  type RoutineExercise,
  type RoutineReview,
  type SetRecord,
} from './schema.js';
import { DEFAULT_ROUTINE_IDS, getExercise } from '@kinetrace/exercises';
import type { SkeletonTrack } from '@kinetrace/engine';
import type { ImportedItem } from '@kinetrace/import';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Copy an object without the given keys. */
function omit<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Omit<T, K> {
  const result = { ...value };
  for (const key of keys) delete result[key];
  return result;
}

export async function getSettings(): Promise<AppSettings> {
  // Merged over the defaults so a row written by an older version still has
  // every field a newer one expects.
  const stored = await db.settings.get('app');
  return stored ? { ...DEFAULT_SETTINGS, ...stored } : DEFAULT_SETTINGS;
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const next = { ...(await getSettings()), ...patch, key: 'app' as const };
  await db.settings.put(next);
  return next;
}

export async function createProfile(profile: Omit<Profile, 'id' | 'createdAt'>): Promise<number> {
  const id = await db.profiles.add({ ...profile, createdAt: Date.now() } as Profile);
  const settings = await getSettings();
  if (settings.activeProfileId === undefined) await saveSettings({ activeProfileId: id });
  return id;
}

export async function updateProfile(id: number, patch: Partial<Profile>): Promise<void> {
  await db.profiles.update(id, patch);
}

/** Delete a profile and everything attached to it. */
export async function deleteProfile(id: number): Promise<void> {
  await db.transaction(
    'rw',
    [db.profiles, db.routines, db.sessions, db.sets, db.landmarkTracks, db.imports, db.settings],
    async () => {
      const sessions = await db.sessions.where('profileId').equals(id).toArray();
      const sessionIds = sessions.map((session) => session.id);
      const sets = await db.sets.where('sessionId').anyOf(sessionIds).toArray();
      await db.landmarkTracks
        .where('setId')
        .anyOf(sets.map((set) => set.id))
        .delete();
      await db.sets.where('sessionId').anyOf(sessionIds).delete();
      await db.sessions.where('profileId').equals(id).delete();
      await db.routines.where('profileId').equals(id).delete();
      await db.imports.where('profileId').equals(id).delete();
      await db.profiles.delete(id);
      const settings = await getSettings();
      if (settings.activeProfileId === id) {
        const next = await db.profiles.toCollection().first();
        await saveSettings({ activeProfileId: next?.id });
      }
    },
  );
}

export async function saveRoutine(
  routine: Omit<Routine, 'id' | 'createdAt' | 'updatedAt'> & { id?: number },
): Promise<number> {
  const now = Date.now();
  if (routine.id !== undefined) {
    await db.routines.update(routine.id, {
      name: routine.name,
      exercises: routine.exercises,
      updatedAt: now,
    });
    return routine.id;
  }
  return db.routines.add({ ...routine, createdAt: now, updatedAt: now } as Routine);
}

/**
 * Seed the maker's own back routine, so a new profile has something to do on
 * the first day. Used by the first run and by an empty home screen, which must
 * create the same thing.
 */
export async function createStarterRoutine(profileId: number, name: string): Promise<number> {
  const exercises = DEFAULT_ROUTINE_IDS.flatMap((id) => {
    const exercise = getExercise(id);
    if (!exercise) return [];
    return [
      {
        exerciseId: id,
        sets: exercise.defaults.sets,
        reps: exercise.defaults.reps,
        holdSeconds: exercise.defaults.holdSeconds,
        restSeconds: exercise.defaults.restSeconds,
      },
    ];
  });
  return saveRoutine({ profileId, name, exercises });
}

/** Save the numbers a professional went through, and the signature under them. */
export async function saveRoutineReview(
  id: number,
  exercises: RoutineExercise[],
  review: RoutineReview,
): Promise<void> {
  await db.routines.update(id, { exercises, review, updatedAt: Date.now() });
}

export async function duplicateRoutine(id: number): Promise<number | undefined> {
  const routine = await db.routines.get(id);
  if (!routine) return undefined;
  const now = Date.now();
  return db.routines.add({
    profileId: routine.profileId,
    name: `${routine.name} (2)`,
    exercises: routine.exercises.map((exercise) => ({ ...exercise })),
    createdAt: now,
    updatedAt: now,
  } as Routine);
}

export async function deleteRoutine(id: number): Promise<void> {
  await db.routines.delete(id);
}

export async function startSession(profileId: number, routineId: number): Promise<number> {
  return db.sessions.add({ profileId, routineId, startedAt: Date.now() } as never);
}

/**
 * How long an abandoned session stays worth offering to continue. Past this it
 * is yesterday's, and starting again is the honest thing.
 */
export const RESUMABLE_WINDOW_MS = 12 * 60 * 60 * 1000;

export interface ResumableSession {
  session: Session;
  /** Position in the plan to carry on from. */
  nextIndex: number;
}

/**
 * A session that was started and never finished, recent enough to pick up.
 *
 * Every set is written the moment it ends, so nothing was lost when the app
 * closed — but the session row stayed open and the next attempt began at zero.
 * Only offered when at least one set was done, since otherwise continuing and
 * starting are the same thing.
 */
export async function resumableSession(profileId: number): Promise<ResumableSession | undefined> {
  const sessions = await db.sessions.where('profileId').equals(profileId).toArray();
  const open = sessions
    .filter(
      (session) =>
        session.endedAt === undefined && Date.now() - session.startedAt < RESUMABLE_WINDOW_MS,
    )
    .sort((a, b) => b.startedAt - a.startedAt);

  // Newest first, and a guided session is stepped over rather than ending the
  // search: resuming goes to the measured session, which is the one mode the
  // person could not use that day, and a guided set holds no measurement to
  // preserve anyway. An older, genuinely resumable session behind it still
  // deserves to be offered.
  for (const session of open) {
    const sets = await db.sets.where('sessionId').equals(session.id).toArray();
    if (sets.length === 0) continue;
    if (sets.every((set) => set.measured === false)) continue;
    return { session, nextIndex: Math.max(...sets.map((set) => set.index)) + 1 };
  }
  return undefined;
}

/** Sets already recorded against a session, in plan order. */
export async function setsForSession(sessionId: number): Promise<SetRecord[]> {
  const sets = await db.sets.where('sessionId').equals(sessionId).toArray();
  return sets.sort((a, b) => a.index - b.index);
}

export async function finishSession(
  sessionId: number,
  patch: { notes?: string; painScore?: number },
): Promise<void> {
  await db.sessions.update(sessionId, { ...patch, endedAt: Date.now() });
}

export async function deleteSession(sessionId: number): Promise<void> {
  const sets = await db.sets.where('sessionId').equals(sessionId).toArray();
  await db.landmarkTracks
    .where('setId')
    .anyOf(sets.map((set) => set.id))
    .delete();
  await db.sets.where('sessionId').equals(sessionId).delete();
  await db.sessions.delete(sessionId);
}

export async function saveSet(set: Omit<SetRecord, 'id'>, track?: SkeletonTrack): Promise<number> {
  const setId = await db.sets.add(set as SetRecord);
  if (track && track.frameCount > 0) {
    await db.landmarkTracks.add({
      setId,
      fps: track.fps,
      frameCount: track.frameCount,
      positions: track.positions,
      visibility: track.visibility,
      startedAt: track.startedAt,
    } as never);
  }
  return setId;
}

export async function saveImport(record: {
  profileId: number;
  ocrText: string;
  items: ImportedItem[];
  routineId?: number;
}): Promise<number> {
  return db.imports.add({ ...record, createdAt: Date.now() } as never);
}

/** Delete skeleton tracks older than the retention window. */
export async function pruneTracks(retentionDays: number): Promise<number> {
  const cutoff = Date.now() - retentionDays * DAY_MS;
  return db.landmarkTracks.where('startedAt').below(cutoff).delete();
}

export interface SessionSummary {
  sessionId: number;
  startedAt: number;
  sets: SetRecord[];
}

export async function sessionsForProfile(profileId: number): Promise<SessionSummary[]> {
  const sessions = await db.sessions
    .where('profileId')
    .equals(profileId)
    .reverse()
    .sortBy('startedAt');
  const summaries: SessionSummary[] = [];
  for (const session of sessions) {
    summaries.push({
      sessionId: session.id,
      startedAt: session.startedAt,
      sets: await db.sets.where('sessionId').equals(session.id).sortBy('index'),
    });
  }
  return summaries;
}

/** Consecutive days, counting back from today, with at least one session. */
export function streakFromDates(dates: readonly number[], now = Date.now()): number {
  const days = new Set(dates.map((date) => new Date(date).toDateString()));
  let streak = 0;
  for (let offset = 0; offset < 400; offset += 1) {
    const day = new Date(now - offset * DAY_MS).toDateString();
    if (days.has(day)) streak += 1;
    else if (offset > 0 || !days.has(new Date(now).toDateString())) {
      // Today not being done yet does not break a streak that ran until yesterday.
      if (offset === 0) continue;
      break;
    }
  }
  return streak;
}

/** Everything about one profile, for the export and import feature. */
export interface ProfileExport {
  version: 1;
  exportedAt: number;
  profile: Omit<Profile, 'id'>;
  routines: Array<Omit<Routine, 'id' | 'profileId'>>;
  sessions: Array<{
    session: Omit<Session, 'id' | 'profileId' | 'routineId'> & { routineName: string };
    sets: Array<Omit<SetRecord, 'id' | 'sessionId'>>;
  }>;
}

export async function exportProfile(profileId: number): Promise<ProfileExport> {
  const profile = await db.profiles.get(profileId);
  if (!profile) throw new Error('Profile not found');
  const routines = await db.routines.where('profileId').equals(profileId).toArray();
  const routineNames = new Map(routines.map((routine) => [routine.id, routine.name]));
  const sessions = await db.sessions.where('profileId').equals(profileId).toArray();

  const exported: ProfileExport['sessions'] = [];
  for (const session of sessions) {
    const sets = await db.sets.where('sessionId').equals(session.id).sortBy('index');
    exported.push({
      session: {
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        notes: session.notes,
        painScore: session.painScore,
        routineName: routineNames.get(session.routineId) ?? '',
      },
      sets: sets.map((set) => omit(set, ['id', 'sessionId'])),
    });
  }

  const profileFields = omit(profile, ['id']);
  return {
    version: 1,
    exportedAt: Date.now(),
    profile: profileFields,
    routines: routines.map((routine) => omit(routine, ['id', 'profileId'])),
    sessions: exported,
  };
}

/** Import a profile export as a new profile. Skeleton tracks are not transferred. */
export async function importProfile(data: ProfileExport): Promise<number> {
  if (data.version !== 1) throw new Error(`Unsupported export version: ${data.version}`);
  const profileId = await createProfile({
    name: data.profile.name,
    color: data.profile.color,
    language: data.profile.language,
    heightCm: data.profile.heightCm,
    physioNotes: data.profile.physioNotes,
  });

  const routineIds = new Map<string, number>();
  for (const routine of data.routines) {
    const id = await saveRoutine({ profileId, name: routine.name, exercises: routine.exercises });
    routineIds.set(routine.name, id);
  }
  for (const entry of data.sessions) {
    const routineId = routineIds.get(entry.session.routineName) ?? 0;
    const sessionId = await db.sessions.add({
      profileId,
      routineId,
      startedAt: entry.session.startedAt,
      endedAt: entry.session.endedAt,
      notes: entry.session.notes,
      painScore: entry.session.painScore,
    } as never);
    for (const set of entry.sets) {
      await db.sets.add({ ...set, sessionId } as never);
    }
  }
  return profileId;
}

export async function deleteEverything(): Promise<void> {
  await db.delete();
  await db.open();
}

export type { RoutineExercise };
