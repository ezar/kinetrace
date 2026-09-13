import type { ExerciseDefinition } from '../types.js';

/**
 * Cat and camel. A three phase cycle: neutral, flexed (cat), extended (camel)
 * and back to neutral counts one repetition.
 */
export const catCamel: ExerciseDefinition = {
  id: 'cat-camel',
  names: { es: 'Gato y camello', en: 'Cat and camel' },
  synonyms: {
    es: ['gato camello', 'gato-vaca', 'movilidad de columna en cuadrupedia'],
    en: ['cat camel', 'cat cow', 'cat-cow'],
  },
  howTo: {
    es: [
      'Ponte a cuatro patas, con las manos bajo los hombros y las rodillas bajo las caderas.',
      'Redondea la espalda hacia arriba metiendo la barbilla, vértebra a vértebra.',
      'Vuelve al centro y luego hunde la espalda llevando el pecho y la mirada hacia delante.',
      'Los brazos no se doblan: el movimiento es de la columna.',
    ],
    en: [
      'Get on all fours, hands under your shoulders and knees under your hips.',
      'Round your back up towards the ceiling and tuck your chin, one vertebra at a time.',
      'Come back to the middle, then let your back dip and look forward.',
      'Your arms stay straight: the movement belongs to your spine.',
    ],
  },
  area: 'lowerBack',
  position: 'quadruped',
  equipment: 'mat',
  view: { orientation: 'side', cameraHeight: 'floor', distanceMetres: 2.5 },
  cameraTipKey: 'tip.floorSide',
  metrics: {
    spine: { id: 'spineFlexion', side: 'auto' },
  },
  primaryMetric: 'spine',
  mode: 'reps',
  phases: [
    { id: 'neutral', when: { all: [{ above: 86 }, { below: 96 }] }, minDwellMs: 250 },
    { id: 'cat', when: { below: 84 }, minDwellMs: 400 },
    { id: 'camel', when: { above: 100 }, minDwellMs: 400 },
  ],
  targets: {
    direction: 'decrease',
    band: { min: 60, max: 80 },
    safety: { min: 45, max: 130 },
  },
  rules: [
    {
      id: 'pace',
      priority: 'form',
      when: { signal: 'absVelocity', above: 40 },
      sustainMs: 500,
      cooldownMs: 8000,
      cueKey: 'cue.slowDown',
    },
  ],
  defaults: { sets: 2, reps: 10, restSeconds: 30 },
  trackingConfidence: 'medium',
  reference: {
    posture: 'quadruped',
    cameraSide: 'left',
    cycleSeconds: 6,
    base: { shoulderAngle: 90, elbowAngle: 176, kneeAngle: 90 },
    keyframes: [
      { t: 0, pose: { hipAngle: 90, headTilt: 0 } },
      { t: 0.3, pose: { hipAngle: 72, headTilt: 20 } },
      { t: 0.5, pose: { hipAngle: 90, headTilt: 0 } },
      { t: 0.8, pose: { hipAngle: 110, headTilt: -18 } },
      { t: 1, pose: { hipAngle: 90, headTilt: 0 } },
    ],
  },
};
