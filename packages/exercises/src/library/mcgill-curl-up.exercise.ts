import type { ExerciseDefinition } from '../types.js';

/** McGill curl-up. A short trunk lift with one knee bent, timed at the top. */
export const mcgillCurlUp: ExerciseDefinition = {
  id: 'mcgill-curl-up',
  names: { es: 'Curl-up de McGill', en: 'McGill curl-up' },
  synonyms: {
    es: ['curl up', 'encogimiento de McGill', 'abdominal de McGill'],
    en: ['mcgill curl up', 'curl up', 'modified curl up'],
  },
  howTo: {
    es: [
      'Túmbate boca arriba con una rodilla doblada y la otra pierna estirada.',
      'Pon las manos bajo la zona lumbar, para que no pierda su curva.',
      'Despega la cabeza y los hombros unos centímetros, sin doblar el cuello.',
      'Baja despacio. La zona lumbar no llega a aplanarse contra el suelo.',
    ],
    en: [
      'Lie on your back with one knee bent and the other leg straight.',
      'Put your hands under your lower back, so it keeps its curve.',
      'Lift your head and shoulders a few centimetres, without bending your neck.',
      'Lower slowly. Your lower back never flattens against the floor.',
    ],
  },
  area: 'core',
  position: 'supine',
  spinalLoad: 'neutral',
  equipment: 'mat',
  view: { orientation: 'side', cameraHeight: 'floor', distanceMetres: 2.5 },
  cameraTipKey: 'tip.floorSide',
  metrics: {
    trunk: { id: 'trunkInclination', side: 'auto' },
  },
  primaryMetric: 'trunk',
  mode: 'reps',
  phases: [
    { id: 'rest', when: { above: 88 }, minDwellMs: 300 },
    { id: 'top', when: { below: 84 }, minDwellMs: 500 },
  ],
  targets: {
    direction: 'decrease',
    band: { min: 62, max: 78 },
    safety: { min: 40, max: 100 },
  },
  rules: [
    {
      id: 'pace',
      priority: 'form',
      when: { signal: 'absVelocity', above: 30 },
      sustainMs: 500,
      cooldownMs: 8000,
      cueKey: 'cue.slowDown',
    },
    {
      id: 'neck',
      priority: 'form',
      when: { below: 66 },
      sustainMs: 700,
      cooldownMs: 10000,
      cueKey: 'cue.longNeck',
    },
  ],
  defaults: { sets: 3, reps: 8, restSeconds: 40 },
  trackingConfidence: 'medium',
  reference: {
    posture: 'supine',
    cameraSide: 'left',
    cycleSeconds: 5,
    base: {
      shoulderAngle: 30,
      elbowAngle: 120,
      left: { hipAngle: 130, kneeAngle: 90 },
      right: { hipAngle: 176, kneeAngle: 176 },
    },
    keyframes: [
      { t: 0, pose: { trunkAngle: 0, headTilt: 0 } },
      { t: 0.4, pose: { trunkAngle: 18, headTilt: 6 } },
      { t: 0.6, pose: { trunkAngle: 18, headTilt: 6 } },
      { t: 1, pose: { trunkAngle: 0, headTilt: 0 } },
    ],
  },
};
