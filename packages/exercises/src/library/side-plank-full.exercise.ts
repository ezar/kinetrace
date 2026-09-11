import type { ExerciseDefinition } from '../types.js';

/** Full side plank, supported on the feet. */
export const sidePlankFull: ExerciseDefinition = {
  id: 'side-plank-full',
  names: { es: 'Plancha lateral completa', en: 'Full side plank' },
  synonyms: {
    es: ['plancha lateral', 'plancha de lado', 'side plank'],
    en: ['side plank', 'full side plank', 'side bridge'],
  },
  area: 'core',
  position: 'sideLying',
  equipment: 'mat',
  view: { orientation: 'front', cameraHeight: 'floor', distanceMetres: 2.5 },
  cameraTipKey: 'tip.floorFront',
  metrics: {
    line: { id: 'trunkLineDeviation', side: 'auto' },
  },
  primaryMetric: 'line',
  mode: 'hold',
  phases: [{ id: 'hold', when: { always: true }, minDwellMs: 0 }],
  targets: { direction: 'decrease', band: { min: -7, max: 7 }, safety: { min: -28, max: 28 } },
  hold: { stabilityToleranceDeg: 4 },
  rules: [
    {
      id: 'hipsSagging',
      priority: 'form',
      when: { above: 11 },
      sustainMs: 1000,
      cooldownMs: 4000,
      cueKey: 'cue.liftHips',
    },
    {
      id: 'hipsPiked',
      priority: 'form',
      when: { below: -11 },
      sustainMs: 1000,
      cooldownMs: 4000,
      cueKey: 'cue.lowerHips',
    },
  ],
  defaults: { sets: 3, holdSeconds: 25, restSeconds: 45 },
  trackingConfidence: 'medium',
  reference: {
    posture: 'sideLyingLeft',
    cycleSeconds: 4,
    base: {
      left: { shoulderAngle: 90, elbowAngle: 90 },
      right: { shoulderAngle: 20, elbowAngle: 160 },
      hipAngle: 178,
      kneeAngle: 176,
      ankleAngle: 75,
      hipAbduction: 0,
      shoulderAbduction: 0,
    },
    keyframes: [{ t: 0, pose: { trunkLateral: 0 } }],
  },
};
