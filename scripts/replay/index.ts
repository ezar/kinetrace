/**
 * Replay tool.
 *
 * Runs the engine over a landmark fixture and prints the metric trace, the
 * repetition events and the cues, so thresholds can be tuned without a camera.
 *
 *   pnpm replay                       list the fixtures
 *   pnpm replay glute-bridge.good     run one fixture
 *   pnpm replay front-plank --trace   print every frame
 *   pnpm replay --all --metrics       print the range of every metric
 *   pnpm replay --all                 summarise every fixture
 */

import { ExerciseRunner, type EngineEvent } from '@kinetrace/engine';
import { resolveText, toRunnerConfig } from '@kinetrace/exercises';
import { listFixtureFiles, loadFixtureFile, type LoadedFixture } from '../fixtures/load.js';

interface ReplayResult {
  file: string;
  reps: number;
  partials: number;
  heldMs: number;
  goodRepPct: number;
  romMax: number;
  romMean: number;
  cues: Array<{ timestampMs: number; ruleId: string; text: string }>;
  events: EngineEvent[];
  trace: Array<{ timestampMs: number; value: number; phase: string | null; confidence: number }>;
  /** Range of every metric slot, for tuning thresholds. */
  metricRanges: Record<
    string,
    { min: number; max: number; maxAbsVelocity: number; maxStability: number }
  >;
}

function runFixture(fixture: LoadedFixture): ReplayResult {
  const { exercise, frames, spec } = fixture;
  const runner = new ExerciseRunner(
    toRunnerConfig(exercise, {
      ...(spec.kind === 'synthetic' && spec.holdSeconds ? { holdSeconds: spec.holdSeconds } : {}),
    }),
  );
  const result: ReplayResult = {
    file: `${spec.exerciseId}.${spec.variant}`,
    reps: 0,
    partials: 0,
    heldMs: 0,
    goodRepPct: 0,
    romMax: Number.NaN,
    romMean: Number.NaN,
    cues: [],
    events: [],
    trace: [],
    metricRanges: {},
  };

  for (const frame of frames) {
    const update = runner.update(frame);
    result.events.push(...update.events);
    if (update.cue) {
      result.cues.push({
        timestampMs: update.cue.timestampMs,
        ruleId: update.cue.ruleId,
        text: resolveText(update.cue.cueKey, 'en', update.cue.params),
      });
    }
    for (const [name, sample] of Object.entries(update.metrics.samples)) {
      if (!Number.isFinite(sample.value)) continue;
      const range = (result.metricRanges[name] ??= {
        min: Number.POSITIVE_INFINITY,
        max: Number.NEGATIVE_INFINITY,
        maxAbsVelocity: 0,
        maxStability: 0,
      });
      range.min = Math.min(range.min, sample.value);
      range.max = Math.max(range.max, sample.value);
      range.maxAbsVelocity = Math.max(range.maxAbsVelocity, Math.abs(sample.velocity));
      range.maxStability = Math.max(range.maxStability, sample.stability);
    }
    const sample = update.metrics.samples[exercise.primaryMetric];
    result.trace.push({
      timestampMs: update.metrics.timestampMs,
      value: sample?.value ?? Number.NaN,
      phase: update.state.phaseId,
      confidence: sample?.confidence ?? 0,
    });
    result.reps = update.state.reps;
    result.partials = update.state.partials;
    result.heldMs = update.state.heldMs;
    result.goodRepPct = update.state.goodRepPct;
    result.romMax = update.state.romMax;
    result.romMean = update.state.romMean;
  }
  return result;
}

function fixedOrDash(value: number, digits = 1): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

function printResult(
  fixture: LoadedFixture,
  result: ReplayResult,
  trace: boolean,
  showMetrics: boolean,
): void {
  const { exercise, spec } = fixture;
  console.log(`\n${result.file}  (${exercise.names.en}, ${exercise.mode})`);
  console.log(`  ${spec.description}`);
  const values = result.trace.map((entry) => entry.value).filter(Number.isFinite);
  const min = values.length ? Math.min(...values) : Number.NaN;
  const max = values.length ? Math.max(...values) : Number.NaN;
  console.log(
    `  ${exercise.primaryMetric}: min ${fixedOrDash(min)} max ${fixedOrDash(max)} deg` +
      `   target band ${exercise.targets.band.min}..${exercise.targets.band.max}`,
  );
  if (exercise.mode === 'reps') {
    console.log(
      `  reps ${result.reps}  partials ${result.partials}  good ${result.goodRepPct.toFixed(0)}%` +
        `  rom max ${fixedOrDash(result.romMax)}  rom mean ${fixedOrDash(result.romMean)}`,
    );
  } else {
    console.log(`  held ${(result.heldMs / 1000).toFixed(1)} s`);
  }

  const phases = result.events.filter((event) => event.type === 'phase').length;
  const lost = result.events.some((event) => event.type === 'trackingLost');
  console.log(`  phase changes ${phases}${lost ? '  tracking lost' : ''}`);

  if (result.cues.length === 0) {
    console.log('  cues: none');
  } else {
    console.log('  cues:');
    for (const cue of result.cues) {
      console.log(
        `    ${(cue.timestampMs / 1000).toFixed(1).padStart(6)}s  ${cue.ruleId}: ${cue.text}`,
      );
    }
  }

  if (showMetrics) {
    console.log('  metric ranges:');
    for (const [name, range] of Object.entries(result.metricRanges)) {
      console.log(
        `    ${name.padEnd(14)} ${fixedOrDash(range.min).padStart(8)} .. ${fixedOrDash(range.max).padStart(8)}` +
          `   |v|max ${fixedOrDash(range.maxAbsVelocity).padStart(7)} deg/s   stability max ${fixedOrDash(range.maxStability)}`,
      );
    }
  }

  if (!trace) return;
  console.log('  trace (t, value, phase, confidence):');
  for (const entry of result.trace) {
    console.log(
      `    ${(entry.timestampMs / 1000).toFixed(2).padStart(7)}  ${fixedOrDash(entry.value).padStart(7)}` +
        `  ${(entry.phase ?? '-').padEnd(10)} ${entry.confidence.toFixed(2)}`,
    );
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const trace = args.includes('--trace');
  const showMetrics = args.includes('--metrics');
  const all = args.includes('--all');
  const target = args.find((arg) => !arg.startsWith('--'));
  const files = listFixtureFiles();

  if (!target && !all) {
    console.log('Fixtures:');
    for (const file of files) console.log(`  ${file.replace(/\.json$/, '')}`);
    console.log('\nRun one with: pnpm replay <fixture>   or all with: pnpm replay --all');
    return;
  }

  const selected = all ? files : files.filter((file) => file.startsWith(target ?? ''));
  if (selected.length === 0) {
    console.error(`No fixture matches "${target}"`);
    process.exitCode = 1;
    return;
  }

  for (const file of selected) {
    const fixture = loadFixtureFile(file);
    printResult(fixture, runFixture(fixture), trace && selected.length === 1, showMetrics);
  }
}

main();
