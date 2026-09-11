/** Read fixtures from `fixtures/landmarks/` and turn them into pose frames. */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { materializeFixture, type FixtureSpec, type PoseFrame } from '@kinetrace/engine';
import { getExercise, type ExerciseDefinition } from '@kinetrace/exercises';

export const FIXTURE_DIR = fileURLToPath(new URL('../../fixtures/landmarks/', import.meta.url));

export interface LoadedFixture {
  spec: FixtureSpec;
  exercise: ExerciseDefinition;
  frames: PoseFrame[];
}

export function listFixtureFiles(): string[] {
  return readdirSync(FIXTURE_DIR)
    .filter((file) => file.endsWith('.json') && !file.endsWith('.landmarks.json'))
    .sort();
}

export function loadFixtureFile(file: string): LoadedFixture {
  const spec = JSON.parse(readFileSync(join(FIXTURE_DIR, file), 'utf8')) as FixtureSpec;
  const exercise = getExercise(spec.exerciseId);
  if (!exercise) throw new Error(`Fixture ${file} references unknown exercise ${spec.exerciseId}`);
  return { spec, exercise, frames: materializeFixture(spec, exercise.reference) };
}

export function loadAllFixtures(): LoadedFixture[] {
  return listFixtureFiles().map(loadFixtureFile);
}
