/**
 * Fixture catalogue.
 *
 * One good variant per exercise, plus the error variants the form rules are
 * meant to catch. `pnpm fixtures:build` writes these to `fixtures/landmarks/`
 * and the engine tests assert the expectations below.
 */

import type { SyntheticFixtureSpec } from '@kinetrace/engine';
import { EXERCISES } from '@kinetrace/exercises';

const NOISE_METRES = 0.004;

/** Good variant for every exercise in the library, derived from its own defaults. */
function goodVariants(): SyntheticFixtureSpec[] {
  return EXERCISES.map((exercise, index) => {
    const base = {
      kind: 'synthetic' as const,
      exerciseId: exercise.id,
      variant: 'good',
      description: `${exercise.names.en} performed as the reference motion describes it.`,
      view: exercise.view.orientation,
      fps: 30,
      noiseMetres: NOISE_METRES,
      seed: 1000 + index,
    };
    // A good repetition must never be corrected: every rule that is not simple
    // encouragement has to stay quiet on the reference movement.
    const silent = exercise.rules
      .filter((rule) => rule.priority !== 'encouragement')
      .map((rule) => rule.id);
    if (exercise.mode === 'hold') {
      return {
        ...base,
        holdSeconds: (exercise.defaults.holdSeconds ?? 20) + 4,
        holdAtPhase: 0,
        expect: {
          heldMs: { atLeast: (exercise.defaults.holdSeconds ?? 20) * 1000 },
          silent,
        },
      } satisfies SyntheticFixtureSpec;
    }
    return {
      ...base,
      cycles: 10,
      expect: { reps: 10, partials: 0, silent },
    } satisfies SyntheticFixtureSpec;
  });
}

/** Variants that must trigger a specific rule, or that stress the engine's gates. */
const ERROR_VARIANTS: SyntheticFixtureSpec[] = [
  {
    kind: 'synthetic',
    exerciseId: 'glute-bridge',
    variant: 'partial',
    description: 'Bridges that only reach about half the target hip extension.',
    view: 'side',
    fps: 30,
    cycles: 8,
    noiseMetres: NOISE_METRES,
    seed: 21,
    perturbations: [{ kind: 'amplitude', factor: 0.62 }],
    expect: { reps: 0, partials: 8 },
  },
  {
    kind: 'synthetic',
    exerciseId: 'glute-bridge',
    variant: 'too-fast',
    description: 'Bridges thrown up and down at roughly three times the intended tempo.',
    view: 'side',
    fps: 30,
    cycles: 8,
    cycleSeconds: 1.2,
    noiseMetres: NOISE_METRES,
    seed: 22,
    expect: { cues: ['pace'] },
  },
  {
    kind: 'synthetic',
    exerciseId: 'glute-bridge',
    variant: 'lost-tracking',
    description: 'Good bridges with the body out of the frame between seconds 8 and 12.',
    view: 'side',
    fps: 30,
    cycles: 6,
    noiseMetres: NOISE_METRES,
    seed: 23,
    dropout: { fromSeconds: 8, toSeconds: 12, visibilityScale: 0.25 },
    expect: { trackingLost: true },
  },
  {
    kind: 'synthetic',
    exerciseId: 'front-plank',
    variant: 'sagging-hips',
    description: 'Plank held with the hips well below the shoulder to ankle line.',
    view: 'side',
    fps: 30,
    holdSeconds: 20,
    holdAtPhase: 0,
    noiseMetres: NOISE_METRES,
    seed: 24,
    perturbations: [{ kind: 'override', pose: { hipAngle: 205 } }],
    expect: { cues: ['hipsSagging'], silent: ['hipsPiked'] },
  },
  {
    kind: 'synthetic',
    exerciseId: 'front-plank',
    variant: 'piked-hips',
    description: 'Plank held with the hips lifted above the line.',
    view: 'side',
    fps: 30,
    holdSeconds: 20,
    holdAtPhase: 0,
    noiseMetres: NOISE_METRES,
    seed: 25,
    perturbations: [{ kind: 'override', pose: { hipAngle: 155 } }],
    expect: { cues: ['hipsPiked'], silent: ['hipsSagging'] },
  },
  {
    kind: 'synthetic',
    exerciseId: 'bird-dog',
    variant: 'pelvis-rolling',
    description: 'Bird dog with the pelvis rolling open as the leg lifts.',
    view: 'side',
    fps: 30,
    cycles: 6,
    noiseMetres: NOISE_METRES,
    seed: 26,
    perturbations: [
      { kind: 'override', pose: { pelvisRotation: 28 }, fromPhase: 0.3, toPhase: 0.7 },
    ],
    expect: { cues: ['pelvisRolling'] },
  },
  {
    kind: 'synthetic',
    exerciseId: 'bodyweight-squat',
    variant: 'knee-valgus',
    description: 'Squats whose knees fall inwards at the bottom.',
    view: 'side',
    fps: 30,
    cycles: 6,
    noiseMetres: NOISE_METRES,
    seed: 27,
    perturbations: [{ kind: 'override', pose: { kneeSplay: 30 }, fromPhase: 0.3, toPhase: 0.7 }],
    expect: { cues: ['kneeValgus'] },
  },
  {
    kind: 'synthetic',
    exerciseId: 'side-plank-knees',
    variant: 'sagging-hips',
    description: 'Side plank on the knees with the hips dropping towards the mat.',
    view: 'front',
    fps: 30,
    holdSeconds: 18,
    holdAtPhase: 0,
    noiseMetres: NOISE_METRES,
    seed: 28,
    perturbations: [{ kind: 'override', pose: { trunkLateral: 34, hipAbduction: -34 } }],
    expect: { cues: ['hipsSagging'] },
  },
  {
    kind: 'synthetic',
    exerciseId: 'dead-bug',
    variant: 'partial',
    description: 'Dead bugs that stop short of the target leg extension.',
    view: 'side',
    fps: 30,
    cycles: 6,
    noiseMetres: NOISE_METRES,
    seed: 29,
    perturbations: [{ kind: 'amplitude', factor: 0.72 }],
    expect: { reps: 0, partials: 6 },
  },
  {
    kind: 'synthetic',
    exerciseId: 'supine-shoulder-flexion',
    variant: 'bent-elbows',
    description: 'Arms taken overhead with the elbows folding to buy the last of the range.',
    view: 'side',
    fps: 30,
    cycles: 6,
    noiseMetres: NOISE_METRES,
    seed: 30,
    perturbations: [{ kind: 'override', pose: { elbowAngle: 118 } }],
    expect: { cues: ['elbowsBending'] },
  },
  {
    kind: 'synthetic',
    exerciseId: 'supine-shoulder-flexion',
    variant: 'partial',
    description: 'Arms that stop short of overhead: counted, but not as good repetitions.',
    view: 'side',
    fps: 30,
    cycles: 6,
    noiseMetres: NOISE_METRES,
    seed: 31,
    // Between the phase threshold and the target band. Below 0.71 the movement
    // never enters the `up` phase and the engine sees nothing at all, which is
    // a different fixture from this one: this is the person who does the
    // repetition and comes up short.
    perturbations: [{ kind: 'amplitude', factor: 0.8 }],
    expect: { reps: 0, partials: 6 },
  },
  {
    kind: 'synthetic',
    exerciseId: 'prone-trunk-extension',
    variant: 'arms-pushing',
    description: 'Trunk extension with the hands brought up beside the chest to push.',
    view: 'side',
    fps: 30,
    cycles: 6,
    noiseMetres: NOISE_METRES,
    seed: 34,
    perturbations: [{ kind: 'override', pose: { shoulderAngle: 92 } }],
    expect: { cues: ['armsPushing'] },
  },
  {
    kind: 'synthetic',
    exerciseId: 'prone-trunk-extension',
    variant: 'partial',
    description: 'Trunk extensions that stop well short of the line of the legs.',
    view: 'side',
    fps: 30,
    cycles: 6,
    noiseMetres: NOISE_METRES,
    seed: 35,
    perturbations: [{ kind: 'amplitude', factor: 0.6 }],
    expect: { reps: 0, partials: 6 },
  },
  {
    kind: 'synthetic',
    exerciseId: 'prone-trunk-extension',
    variant: 'too-fast',
    description: 'Trunk extensions bounced up and down at five times the intended tempo.',
    view: 'side',
    fps: 30,
    cycles: 8,
    cycleSeconds: 1,
    noiseMetres: NOISE_METRES,
    seed: 40,
    expect: { cues: ['pace'] },
  },
  {
    kind: 'synthetic',
    exerciseId: 'supine-trunk-curl',
    variant: 'too-fast',
    description: 'Curls thrown up and down at more than twice the intended tempo.',
    view: 'side',
    fps: 30,
    cycles: 6,
    cycleSeconds: 2,
    noiseMetres: NOISE_METRES,
    seed: 36,
    expect: { cues: ['pace'] },
  },
  {
    kind: 'synthetic',
    exerciseId: 'supine-trunk-curl',
    variant: 'neck-bending',
    description: 'Curls taken far past the intended range, folding the neck to get there.',
    view: 'side',
    fps: 30,
    cycles: 6,
    // Slower than the reference as well as bigger, so the extra range does not
    // also trip the pace rule and crowd this one out of the cue slot.
    cycleSeconds: 8,
    noiseMetres: NOISE_METRES,
    seed: 38,
    perturbations: [{ kind: 'amplitude', factor: 1.8 }],
    expect: { cues: ['neck'], silent: ['pace'] },
  },
  {
    kind: 'synthetic',
    exerciseId: 'active-double-knee-raise',
    variant: 'too-fast',
    description: 'Knees swung up and down at roughly three times the intended tempo.',
    view: 'side',
    fps: 30,
    cycles: 6,
    cycleSeconds: 1.6,
    noiseMetres: NOISE_METRES,
    seed: 39,
    expect: { cues: ['pace'] },
  },
  {
    kind: 'synthetic',
    exerciseId: 'active-double-knee-raise',
    variant: 'trunk-lifting',
    description: 'Knees raised with the head and upper back coming off the mat with them.',
    view: 'side',
    fps: 30,
    cycles: 6,
    noiseMetres: NOISE_METRES,
    seed: 37,
    perturbations: [{ kind: 'override', pose: { trunkAngle: 22 }, fromPhase: 0.3, toPhase: 0.7 }],
    expect: { cues: ['trunkLifting'] },
  },
  {
    kind: 'synthetic',
    exerciseId: 'doorway-pec-stretch',
    variant: 'elbow-high',
    description: 'Pec stretch taken with the elbow well above shoulder height.',
    view: 'front',
    fps: 30,
    holdSeconds: 20,
    holdAtPhase: 0,
    noiseMetres: NOISE_METRES,
    seed: 33,
    perturbations: [{ kind: 'override', pose: { left: { shoulderAbduction: 128 } } }],
    expect: { cues: ['elbowHigh'], silent: ['elbowLow'] },
  },
];

export const FIXTURE_SPECS: SyntheticFixtureSpec[] = [...goodVariants(), ...ERROR_VARIANTS];

export function fixtureFileName(spec: SyntheticFixtureSpec): string {
  return `${spec.exerciseId}.${spec.variant}.json`;
}
