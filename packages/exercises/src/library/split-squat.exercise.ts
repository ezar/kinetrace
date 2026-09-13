import type { ExerciseDefinition } from '../types.js';

/** Split squat. Front knee flexion, tracked on the leg closest to the camera. */
export const splitSquat: ExerciseDefinition = {
  id: 'split-squat',
  names: { es: 'Sentadilla búlgara al suelo', en: 'Split squat' },
  synonyms: {
    es: ['zancada estática', 'split squat', 'sentadilla dividida', 'lunge estático'],
    en: ['split squat', 'static lunge', 'stationary lunge'],
  },
  howTo: {
    es: [
      'De pie, da un paso largo adelante y deja el otro pie atrás, apoyado en la punta.',
      'Baja doblando las dos rodillas, llevando la de atrás hacia el suelo.',
      'Sube empujando con la pierna de delante.',
      'El tronco se queda erguido y la rodilla de delante sigue la línea del pie.',
    ],
    en: [
      'Stand and take a long step forward, leaving the back foot on its toes.',
      'Lower by bending both knees, taking the back one towards the floor.',
      'Push back up through the front leg.',
      'Your trunk stays upright and your front knee tracks over your foot.',
    ],
  },
  area: 'hips',
  position: 'standing',
  spinalLoad: 'neutral',
  equipment: 'none',
  view: { orientation: 'side', cameraHeight: 'chair', distanceMetres: 3 },
  cameraTipKey: 'tip.chairSide',
  metrics: {
    knee: { id: 'kneeFlexion', side: 'auto' },
    trunk: { id: 'trunkInclination', side: 'auto' },
  },
  primaryMetric: 'knee',
  mode: 'reps',
  unilateral: true,
  phases: [
    { id: 'stand', when: { above: 155 }, minDwellMs: 250 },
    { id: 'bottom', when: { below: 125 }, minDwellMs: 300 },
  ],
  targets: { direction: 'decrease', band: { min: 80, max: 105 }, safety: { min: 55, max: 190 } },
  rules: [
    {
      id: 'trunkForward',
      priority: 'form',
      when: { metric: 'trunk', above: 30 },
      sustainMs: 800,
      cooldownMs: 6000,
      cueKey: 'cue.chestUp',
    },
    {
      id: 'pace',
      priority: 'form',
      when: { signal: 'absVelocity', above: 95 },
      sustainMs: 400,
      cooldownMs: 8000,
      cueKey: 'cue.slowDown',
    },
  ],
  defaults: { sets: 3, reps: 8, restSeconds: 60 },
  trackingConfidence: 'high',
  reference: {
    posture: 'standing',
    cameraSide: 'left',
    cycleSeconds: 4,
    base: { shoulderAngle: 15, elbowAngle: 170, right: { hipAngle: 155, kneeAngle: 140 } },
    keyframes: [
      { t: 0, pose: { trunkAngle: 5, left: { hipAngle: 172, kneeAngle: 172 } } },
      { t: 0.45, pose: { trunkAngle: 12, left: { hipAngle: 110, kneeAngle: 92 } } },
      { t: 0.6, pose: { trunkAngle: 12, left: { hipAngle: 110, kneeAngle: 92 } } },
      { t: 1, pose: { trunkAngle: 5, left: { hipAngle: 172, kneeAngle: 172 } } },
    ],
  },
};
