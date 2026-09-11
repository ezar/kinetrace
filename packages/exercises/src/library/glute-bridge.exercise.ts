import type { ExerciseDefinition } from '../types.js';

/**
 * Glute bridge. The reference movement of the DSL: a supine hip extension seen
 * from the side, with the phone on the floor.
 */
export const gluteBridge: ExerciseDefinition = {
  id: 'glute-bridge',
  names: { es: 'Puente de glúteos', en: 'Glute bridge' },
  synonyms: {
    es: ['puente', 'puente de cadera', 'elevación de cadera', 'puente glúteo'],
    en: ['bridge', 'hip bridge', 'hip raise', 'bridging'],
  },
  area: 'lowerBack',
  position: 'supine',
  equipment: 'mat',
  view: { orientation: 'side', cameraHeight: 'floor', distanceMetres: 2.5 },
  cameraTipKey: 'tip.floorSide',
  metrics: {
    hip: { id: 'hipFlexion', side: 'auto' },
    trunkLine: { id: 'trunkLineDeviation', side: 'auto', options: { distal: 'knee' } },
  },
  primaryMetric: 'hip',
  mode: 'reps',
  phases: [
    { id: 'rest', when: { below: 140 }, minDwellMs: 200 },
    { id: 'top', when: { above: 148 }, minDwellMs: 500 },
  ],
  targets: {
    direction: 'increase',
    band: { min: 165, max: 185 },
    safety: { min: 80, max: 200 },
  },
  rules: [
    {
      id: 'pace',
      priority: 'form',
      when: { signal: 'absVelocity', above: 45 },
      sustainMs: 250,
      cooldownMs: 8000,
      cueKey: 'cue.slowDown',
    },
    {
      id: 'squeeze',
      priority: 'encouragement',
      when: { above: 168 },
      phases: ['top'],
      sustainMs: 700,
      cooldownMs: 12000,
      cueKey: 'cue.squeezeGlutes',
    },
  ],
  tempo: [
    { phase: 'rest', seconds: 1.5 },
    { phase: 'top', seconds: 2 },
  ],
  defaults: { sets: 3, reps: 12, restSeconds: 45 },
  trackingConfidence: 'high',
  reference: {
    posture: 'supine',
    cameraSide: 'left',
    cycleSeconds: 4,
    base: { kneeAngle: 90, shoulderAngle: 12, elbowAngle: 172, hipAbduction: 6 },
    keyframes: [
      { t: 0, pose: { hipAngle: 128, trunkAngle: 0, kneeAngle: 90 } },
      { t: 0.45, pose: { hipAngle: 172, trunkAngle: -20, kneeAngle: 104 } },
      { t: 0.6, pose: { hipAngle: 172, trunkAngle: -20, kneeAngle: 104 } },
      { t: 1, pose: { hipAngle: 128, trunkAngle: 0, kneeAngle: 90 } },
    ],
  },
};
