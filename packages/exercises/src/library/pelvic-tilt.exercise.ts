import type { ExerciseDefinition } from '../types.js';

/**
 * Posterior pelvic tilt. The smallest movement in the library: the metric is a
 * proxy over the trunk and femur axes, so the exercise declares low tracking
 * confidence and the session screen says so.
 */
export const pelvicTilt: ExerciseDefinition = {
  id: 'pelvic-tilt',
  names: { es: 'Báscula pélvica', en: 'Pelvic tilt' },
  synonyms: {
    es: ['basculación pélvica', 'retroversión pélvica', 'inclinación pélvica'],
    en: ['pelvic tilt', 'posterior pelvic tilt', 'pelvic tilts'],
  },
  howTo: {
    es: [
      'Túmbate boca arriba con las rodillas dobladas y los pies apoyados.',
      'Bascula la pelvis hacia atrás hasta pegar la zona lumbar al suelo.',
      'Suelta y vuelve a la posición neutra.',
      'Es un movimiento pequeño: las caderas no llegan a despegarse.',
    ],
    en: [
      'Lie on your back with your knees bent and your feet flat.',
      'Tilt your pelvis back until your lower back presses into the floor.',
      'Release, and come back to neutral.',
      'It is a small movement: your hips never leave the floor.',
    ],
  },
  area: 'lowerBack',
  position: 'supine',
  spinalLoad: 'flexion',
  equipment: 'mat',
  view: { orientation: 'side', cameraHeight: 'floor', distanceMetres: 2.5 },
  cameraTipKey: 'tip.floorSide',
  metrics: {
    tilt: { id: 'pelvisTilt', side: 'auto' },
  },
  primaryMetric: 'tilt',
  mode: 'reps',
  phases: [
    { id: 'rest', when: { above: 50 }, minDwellMs: 300 },
    { id: 'tilted', when: { below: 46 }, minDwellMs: 600 },
  ],
  targets: {
    direction: 'decrease',
    band: { min: 30, max: 42 },
    safety: { min: 10, max: 75 },
  },
  rules: [
    {
      id: 'pace',
      priority: 'form',
      when: { signal: 'absVelocity', above: 30 },
      sustainMs: 500,
      cooldownMs: 10000,
      cueKey: 'cue.slowDown',
    },
  ],
  defaults: { sets: 2, reps: 10, restSeconds: 30 },
  trackingConfidence: 'low',
  reference: {
    posture: 'supine',
    cameraSide: 'left',
    cycleSeconds: 5,
    base: { kneeAngle: 90, shoulderAngle: 12, elbowAngle: 172 },
    keyframes: [
      { t: 0, pose: { hipAngle: 125, trunkAngle: 0 } },
      { t: 0.4, pose: { hipAngle: 142, trunkAngle: -4 } },
      { t: 0.6, pose: { hipAngle: 142, trunkAngle: -4 } },
      { t: 1, pose: { hipAngle: 125, trunkAngle: 0 } },
    ],
  },
};
