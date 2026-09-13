import type { ExerciseDefinition } from '../types.js';

/**
 * Both knees held to the chest. The sustained counterpart of `knee-to-chest`,
 * which the library only had as a repetition, and of `childs-pose`, which
 * stretches the same way round but asks you to kneel to do it.
 */
export const doubleKneeToChest: ExerciseDefinition = {
  id: 'double-knee-to-chest',
  names: { es: 'Rodillas al pecho sostenido', en: 'Double knee to chest hold' },
  synonyms: {
    es: ['rodillas al pecho', 'doble rodilla al pecho', 'posición fetal tumbado'],
    en: ['double knee to chest', 'knees to chest hold', 'both knees to chest'],
  },
  howTo: {
    es: [
      'Túmbate boca arriba con las rodillas dobladas.',
      'Lleva las dos rodillas hacia el pecho y abrázalas.',
      'Quédate ahí, con la espalda y la cabeza apoyadas.',
      'Tira solo hasta notar tensión, sin forzar.',
    ],
    en: [
      'Lie on your back with your knees bent.',
      'Bring both knees towards your chest and hold them there.',
      'Stay there, with your back and head resting on the floor.',
      'Pull only until you feel tension, without forcing it.',
    ],
  },
  area: 'lowerBack',
  position: 'supine',
  spinalLoad: 'flexion',
  // Thresholds and bands read off the replay tool; the dose written by hand.
  provenance: { targets: 'derived', dose: 'authored' },
  equipment: 'mat',
  view: { orientation: 'side', cameraHeight: 'floor', distanceMetres: 2.5 },
  cameraTipKey: 'tip.floorSide',
  metrics: {
    hip: { id: 'hipFlexion', side: 'mean' },
  },
  primaryMetric: 'hip',
  mode: 'hold',
  phases: [{ id: 'hold', when: { always: true }, minDwellMs: 0 }],
  /**
   * No safety stop. What makes a held stretch unsafe is how it feels, not an
   * angle a camera can police, and a range that can never fire is the defect
   * ADR 5 found in two exercises rather than a precaution.
   */
  // Reference motion measures 56 deg; only the maximum binds on `decrease`.
  targets: { direction: 'decrease', band: { min: 30, max: 70 } },
  hold: { stabilityToleranceDeg: 5 },
  rules: [
    {
      id: 'settle',
      priority: 'form',
      when: { signal: 'stability', above: 6 },
      sustainMs: 1500,
      cooldownMs: 10000,
      cueKey: 'cue.holdStill',
    },
  ],
  defaults: { sets: 2, holdSeconds: 30, restSeconds: 20 },
  trackingConfidence: 'high',
  reference: {
    posture: 'supine',
    cycleSeconds: 4,
    base: {
      shoulderAngle: 25,
      elbowAngle: 110,
    },
    keyframes: [{ t: 0, pose: { hipAngle: 55, kneeAngle: 45 } }],
  },
};
