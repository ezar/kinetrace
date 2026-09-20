import type { ExerciseDefinition } from '../types.js';

/**
 * Trunk curl with the hands on the floor.
 *
 * Not the library's McGill curl-up, which keeps the hands under the lumbar
 * spine to preserve its curve and lifts a few centimetres. This one lifts the
 * upper trunk clear of the floor, and the hands rest beside the body rather
 * than pulling on the neck.
 */
export const supineTrunkCurl: ExerciseDefinition = {
  id: 'supine-trunk-curl',
  names: { es: 'Abdominal con manos en el suelo', en: 'Trunk curl, hands on the floor' },
  synonyms: {
    es: ['abdominales superiores', 'encogimiento abdominal', 'crunch', 'abdominal de frente'],
    en: ['trunk curl', 'crunch', 'upper abdominal curl', 'curl up hands on floor'],
  },
  howTo: {
    es: [
      'Túmbate boca arriba con las rodillas dobladas y los pies apoyados.',
      'Deja las manos en el suelo, a los lados del cuerpo.',
      'Despega la cabeza y la parte alta de la espalda, llevando el pecho hacia las rodillas.',
      'Baja despacio. El cuello no se dobla: la barbilla no busca el pecho.',
    ],
    en: [
      'Lie on your back with your knees bent and your feet flat.',
      'Leave your hands on the floor, beside your body.',
      'Lift your head and upper back, bringing your chest towards your knees.',
      'Lower slowly. Your neck does not bend: your chin does not reach for your chest.',
    ],
  },
  area: 'core',
  position: 'supine',
  spinalLoad: 'flexion',
  // Thresholds and bands read off the replay tool; the dose written by hand.
  provenance: { targets: 'derived', dose: 'authored' },
  equipment: 'mat',
  view: { orientation: 'side', cameraHeight: 'floor', distanceMetres: 2.5 },
  cameraTipKey: 'tip.floorSide',
  metrics: {
    trunk: { id: 'trunkInclination', side: 'auto' },
  },
  primaryMetric: 'trunk',
  mode: 'reps',
  phases: [
    { id: 'rest', when: { above: 87 }, minDwellMs: 300 },
    { id: 'top', when: { below: 80 }, minDwellMs: 500 },
  ],
  targets: { direction: 'decrease', band: { min: 56, max: 72 }, safety: { min: 35, max: 100 } },
  rules: [
    {
      // Half again the 18 deg/s the reference motion peaks at, held a quarter
      // of a second — the shape the one validated pace rule in the library
      // uses (the glute bridge, at 1.3 times its own reference peak). A long
      // sustain does not work on a movement this short: the trunk only travels
      // 26 degrees, so even a thrown repetition is over in half a second.
      id: 'pace',
      priority: 'form',
      when: { signal: 'absVelocity', above: 28 },
      sustainMs: 250,
      cooldownMs: 8000,
      cueKey: 'cue.slowDown',
    },
    {
      id: 'neck',
      priority: 'form',
      when: { below: 50 },
      sustainMs: 700,
      cooldownMs: 10000,
      cueKey: 'cue.longNeck',
    },
  ],
  defaults: { sets: 2, reps: 10, restSeconds: 40 },
  trackingConfidence: 'medium',
  reference: {
    posture: 'supine',
    cameraSide: 'left',
    cycleSeconds: 5,
    base: {
      shoulderAngle: 14,
      elbowAngle: 170,
      left: { hipAngle: 128, kneeAngle: 88 },
      right: { hipAngle: 128, kneeAngle: 88 },
    },
    keyframes: [
      { t: 0, pose: { trunkAngle: 0, headTilt: 0 } },
      { t: 0.4, pose: { trunkAngle: 26, headTilt: 8 } },
      { t: 0.6, pose: { trunkAngle: 26, headTilt: 8 } },
      { t: 1, pose: { trunkAngle: 0, headTilt: 0 } },
    ],
  },
};
