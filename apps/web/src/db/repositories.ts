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
import {
  DEFAULT_ROUTINE_IDS,
  STRETCH_ROUTINE_IDS,
  getExercise,
  type Programme,
} from '@kinetrace/exercises';
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
/** Build a routine from a list of exercise ids, at the library's own doses. */
async function createRoutineFrom(
  profileId: number,
  name: string,
  ids: readonly string[],
): Promise<number> {
  const exercises = ids.flatMap((id) => {
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

export async function createStarterRoutine(profileId: number, name: string): Promise<number> {
  return createRoutineFrom(profileId, name, DEFAULT_ROUTINE_IDS);
}

/**
 * The stretches, as a routine somebody can start without building one first.
 *
 * The library gained sustained stretches and nothing pointed at them: the only
 * way to do one was to assemble a routine by hand, which at seven in the
 * morning is the difference between stretching and not.
 */
export async function createStretchRoutine(profileId: number, name: string): Promise<number> {
  return createRoutineFrom(profileId, name, STRETCH_ROUTINE_IDS);
}

/**
 * A published programme, as a routine: its order, its doses, its own words.
 *
 * Every number here comes off the document and nothing is filled in around it.
 * Where the document prints a hold it becomes a pace on the phase that hold
 * belongs to; where it prints nothing — rest, in every case — the routine says
 * nothing either. The steps the library has no exercise for are not silently
 * dropped: they stay in the programme data, and the routine screen lists them
 * so the gap between the paper and the app is visible on the app.
 *
 * The routine is unsigned, like every other routine. A citation says where the
 * numbers were published; it does not say anybody prescribed them to the person
 * holding the phone, and the review screen keeps saying so until one does.
 */
export async function createProgrammeRoutine(
  profileId: number,
  name: string,
  programme: Programme,
): Promise<number> {
  const exercises = programme.steps.flatMap((step): RoutineExercise[] => {
    if (!step.dose || !getExercise(step.dose.exerciseId)) return [];
    const { exerciseId, sets, reps, holdSeconds, restSeconds, tempo, band } = step.dose;
    return [
      {
        exerciseId,
        sets,
        ...(reps === undefined ? {} : { reps }),
        ...(holdSeconds === undefined ? {} : { holdSeconds }),
        restSeconds,
        ...(tempo ? { tempo: [...tempo] } : {}),
        // Only where the document states a range. Everywhere else the entry
        // carries no band and the library's default stands, which is what the
        // routine screen means when it shows the library's numbers.
        ...(band ? { band: { ...band } } : {}),
        sourceNote: `${step.title}. ${step.instruction}`,
      },
    ];
  });
  return saveRoutine({
    profileId,
    name,
    exercises,
    source: {
      programmeId: programme.id,
      title: programme.source.title,
      publisher: programme.source.publisher,
      year: programme.source.year,
      ...(programme.source.url ? { url: programme.source.url } : {}),
    },
  });
}

/**
 * The SERMEF lumbar programme for this profile: the one already transcribed, or
 * a new one.
 *
 * Matched on the programme id rather than on the exercises, unlike the
 * stretches: a transcription is a routine somebody is expected to edit once a
 * professional has been through it, and it should still be recognised as the
 * same routine afterwards.
 */
export async function openProgrammeRoutine(
  profileId: number,
  name: string,
  programme: Programme,
): Promise<number> {
  const existing = await db.routines.where('profileId').equals(profileId).toArray();
  const match = existing.find((routine) => routine.source?.programmeId === programme.id);
  return match?.id ?? createProgrammeRoutine(profileId, name, programme);
}

/**
 * The stretches for this profile: the one that already exists, or a new one.
 *
 * The first run makes this routine, and the shortcut on the home screen is for
 * everybody who is past their first run. Without the lookup that shortcut made
 * a second identical routine on every tap, and the newest one becomes the card
 * the home screen opens on — so tapping it twice buried the one with the
 * history under a copy with none.
 */
export async function openStretchRoutine(profileId: number, name: string): Promise<number> {
  const existing = await db.routines.where('profileId').equals(profileId).toArray();
  const wanted = [...STRETCH_ROUTINE_IDS].sort().join('|');
  const match = existing.find(
    (routine) =>
      routine.exercises
        .map((entry) => entry.exerciseId)
        .sort()
        .join('|') === wanted,
  );
  return match?.id ?? createStretchRoutine(profileId, name);
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
  // The copy keeps the citation and drops the signature. Those numbers came
  // from wherever they came from, and dropping the citation while keeping them
  // would turn sourced numbers back into nobody's. The signature is the
  // opposite case: it was given for that routine, not for a copy of it.
  return db.routines.add({
    profileId: routine.profileId,
    name: `${routine.name} (2)`,
    exercises: routine.exercises.map((exercise) => ({ ...exercise })),
    ...(routine.source ? { source: { ...routine.source } } : {}),
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

/** What this profile has done before, for deciding what still needs showing. */
export interface ExerciseExperience {
  /** Sessions that recorded at least one set. */
  sessions: number;
  /** Exercise ids with at least one recorded set. */
  done: ReadonlySet<string>;
  /** Exercise ids this person has said they already know. */
  dismissed: ReadonlySet<string>;
}

/**
 * Which exercises this profile has done, and how many sessions it has behind
 * it.
 *
 * A set guided by voice counts here, which is the one place it counts for as
 * much as a measured one: this question is whether somebody knows the movement,
 * not whether the camera saw it.
 */
export async function exerciseExperience(profileId: number): Promise<ExerciseExperience> {
  const dismissed = new Set((await db.profiles.get(profileId))?.demoDismissed ?? []);
  const sessionIds = (await db.sessions.where('profileId').equals(profileId).primaryKeys()).filter(
    (id): id is number => typeof id === 'number',
  );
  if (sessionIds.length === 0) return { sessions: 0, done: new Set(), dismissed };

  const sets = await db.sets.where('sessionId').anyOf(sessionIds).toArray();
  const done = new Set<string>();
  const withSets = new Set<number>();
  for (const set of sets) {
    done.add(set.exerciseId);
    withSets.add(set.sessionId);
  }
  return { sessions: withSets.size, done, dismissed };
}

/**
 * Stop showing this exercise's demonstration before a session.
 *
 * In a transaction because it reads before it writes, and the button that calls
 * it sits on every card of the demonstration — four of them in the starter
 * routine, one tap apart. At that cadence each write lands long before the next
 * read, so this is not a bug being fixed; it is the shape of the operation
 * being made honest.
 */
export async function dismissDemo(profileId: number, exerciseId: string): Promise<void> {
  await db.transaction('rw', db.profiles, async () => {
    const profile = await db.profiles.get(profileId);
    if (!profile) return;
    const dismissed = new Set(profile.demoDismissed ?? []);
    dismissed.add(exerciseId);
    await db.profiles.update(profileId, { demoDismissed: [...dismissed] });
  });
}

/** Show them all again. The one button that undoes every "I know this one". */
export async function restoreDemos(profileId: number): Promise<void> {
  await db.profiles.update(profileId, { demoDismissed: [] });
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
