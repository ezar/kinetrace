import type { ExerciseDefinition } from '../types.js';

/**
 * Side plank on the knees. The line is measured from the shoulder to the knee
 * rather than to the ankle, which is what the `distal` metric option is for.
 */
export const sidePlankKnees: ExerciseDefinition = {
  id: 'side-plank-knees',
  names: { es: 'Plancha lateral con rodillas', en: 'Side plank on knees' },
  synonyms: {
    es: ['plancha lateral rodillas', 'plancha lateral fácil', 'side plank rodillas'],
    en: ['side plank knees', 'modified side plank', 'short lever side plank'],
  },
  howTo: {
    es: [
      'Túmbate de lado apoyado en el antebrazo, con las rodillas dobladas por detrás.',
      'Sube las caderas apoyándote en el antebrazo y las rodillas, hasta alinear la cabeza, la espalda y los muslos.',
      'Mantén la posición sin dejar caer la cadera de abajo.',
    ],
    en: [
      'Lie on your side on your forearm, with your knees bent behind you.',
      'Lift your hips, resting on your forearm and your knees, until head, back and thighs are in line.',
      'Hold it without letting your lower hip drop.',
    ],
  },
  area: 'core',
  position: 'sideLying',
  spinalLoad: 'neutral',
  // Thresholds and bands read off the replay tool; the dose written by hand.
  provenance: { targets: 'derived', dose: 'authored' },
  equipment: 'mat',
  view: { orientation: 'front', cameraHeight: 'floor', distanceMetres: 2.5 },
  cameraTipKey: 'tip.floorFront',
  metrics: {
    line: { id: 'trunkLineDeviation', side: 'auto', options: { distal: 'knee' } },
  },
  primaryMetric: 'line',
  mode: 'hold',
  unilateral: true,
  phases: [{ id: 'hold', when: { always: true }, minDwellMs: 0 }],
  targets: { direction: 'decrease', band: { min: -8, max: 8 }, safety: { min: -30, max: 30 } },
  hold: { stabilityToleranceDeg: 4 },
  rules: [
    {
      id: 'hipsSagging',
      priority: 'form',
      when: { above: 12 },
      sustainMs: 1000,
      cooldownMs: 4000,
      cueKey: 'cue.liftHips',
    },
    {
      id: 'elbowPosition',
      priority: 'safety',
      when: { above: 25 },
      sustainMs: 1200,
      cooldownMs: 8000,
      cueKey: 'cue.elbowUnderShoulder',
    },
  ],
  defaults: { sets: 3, holdSeconds: 20, restSeconds: 45 },
  trackingConfidence: 'medium',
  reference: {
    posture: 'sideLyingLeft',
    cycleSeconds: 4,
    base: {
      left: { shoulderAngle: 90, elbowAngle: 90, kneeAngle: 110 },
      right: { shoulderAngle: 20, elbowAngle: 160, kneeAngle: 110 },
      hipAngle: 172,
      hipAbduction: 0,
      shoulderAbduction: 0,
    },
    keyframes: [{ t: 0, pose: { trunkLateral: 0 } }],
  },
};
