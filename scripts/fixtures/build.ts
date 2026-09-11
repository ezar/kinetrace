/**
 * Write the fixture catalogue to `fixtures/landmarks/`.
 *
 * Synthetic fixtures are stored as the recipe that rebuilds them, which keeps
 * them small enough to review in a pull request. Pass `--materialize` to also
 * write the full landmark sequences, for tools outside this repository.
 */

import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { materializeFixture, serializeFrames } from '@kinetrace/engine';
import { getExercise } from '@kinetrace/exercises';
import { FIXTURE_SPECS, fixtureFileName } from './variants.js';

const root = fileURLToPath(new URL('../..', import.meta.url));
const outputDir = join(root, 'fixtures', 'landmarks');
const materialize = process.argv.includes('--materialize');

mkdirSync(outputDir, { recursive: true });
for (const file of readdirSync(outputDir)) {
  if (file.endsWith('.json')) rmSync(join(outputDir, file));
}

let frameTotal = 0;
for (const spec of FIXTURE_SPECS) {
  const exercise = getExercise(spec.exerciseId);
  if (!exercise) throw new Error(`Fixture references unknown exercise: ${spec.exerciseId}`);
  const frames = materializeFixture(spec, exercise.reference);
  frameTotal += frames.length;
  writeFileSync(join(outputDir, fixtureFileName(spec)), `${JSON.stringify(spec, null, 2)}\n`);
  if (materialize) {
    const recorded = {
      kind: 'recorded' as const,
      exerciseId: spec.exerciseId,
      variant: spec.variant,
      description: spec.description,
      view: spec.view,
      fps: spec.fps,
      expect: spec.expect,
      frames: serializeFrames(frames),
    };
    writeFileSync(
      join(outputDir, `${spec.exerciseId}.${spec.variant}.landmarks.json`),
      `${JSON.stringify(recorded)}\n`,
    );
  }
  console.log(`${fixtureFileName(spec)}  ${frames.length} frames`);
}

console.log(`\n${FIXTURE_SPECS.length} fixtures, ${frameTotal} frames total`);
