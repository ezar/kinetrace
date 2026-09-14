import type { ExerciseDefinition } from '../types.js';

/**
 * Doorway pectoral stretch, one arm at a time.
 *
 * What the camera can see, and what it cannot. The stretch itself is horizontal
 * extension — the arm travelling backwards past the plane of the chest — and
 * there is no metric for that: `shoulderAbduction` measures elevation in the
 * frontal plane and barely moves as the chest opens. So this exercise does not
 * pretend to measure the stretch. It measures the *position the stretch is
 * taken in*: the upper arm at shoulder height and the elbow square, which is
 * what decides whether the pull lands on the chest or on the front of the
 * shoulder. Held badly it is the commonest way to make a sore shoulder sorer,
 * and that part is visible.
 *
 * `trackingConfidence` is low for the same reason, and the exercise says so on
 * its own detail screen rather than in a comment only a contributor reads.
 */
export const doorwayPecStretch: ExerciseDefinition = {
  id: 'doorway-pec-stretch',
  names: { es: 'Estiramiento de pectoral en el marco', en: 'Doorway pec stretch' },
  synonyms: {
    es: [
      'estiramiento de pectoral',
      'pectoral en la puerta',
      'apertura de pecho en el marco',
      'estiramiento de pecho',
    ],
    en: ['doorway stretch', 'pec stretch', 'chest stretch', 'doorway chest opener'],
  },
  howTo: {
    es: [
      'Ponte en el marco de una puerta y apoya el antebrazo en la jamba, con el codo a la altura del hombro y doblado en ángulo recto.',
      'Adelanta un pie y lleva el peso despacio hacia delante hasta notar tensión en el pecho, no en el hombro.',
      'El tronco se queda alto y mirando al frente: no gires el cuerpo para ganar recorrido.',
      'Si notas pinchazos en la parte de delante del hombro, baja el codo y afloja.',
    ],
    en: [
      'Stand in a doorway and rest your forearm on the frame, elbow at shoulder height and bent at a right angle.',
      'Step one foot forward and shift your weight slowly until you feel tension across the chest, not in the shoulder.',
      'Keep your trunk tall and facing forward: do not turn your body to gain range.',
      'If you feel pinching at the front of the shoulder, lower the elbow and ease off.',
    ],
  },
  area: 'neckShoulders',
  position: 'standing',
  spinalLoad: 'neutral',
  // Thresholds and bands read off the replay tool; the dose written by hand.
  provenance: { targets: 'derived', dose: 'authored' },
  equipment: 'none',
  view: { orientation: 'front', cameraHeight: 'chair', distanceMetres: 3 },
  cameraTipKey: 'tip.chairFront',
  metrics: {
    shoulder: { id: 'shoulderAbduction', side: 'auto' },
    elbow: { id: 'elbowFlexion', side: 'auto' },
  },
  primaryMetric: 'shoulder',
  mode: 'hold',
  unilateral: true,
  phases: [{ id: 'hold', when: { always: true }, minDwellMs: 0 }],
  /**
   * No safety stop. The number being watched is a position that is held, not a
   * range being pushed into, and the rules below are what say when it has
   * drifted out of the place the stretch works from.
   */
  targets: { direction: 'increase', band: { min: 80, max: 100 } },
  hold: { stabilityToleranceDeg: 6 },
  rules: [
    {
      id: 'elbowHigh',
      priority: 'form',
      when: { metric: 'shoulder', above: 110 },
      sustainMs: 1200,
      cooldownMs: 10000,
      cueKey: 'cue.elbowShoulderHeight',
    },
    {
      id: 'elbowLow',
      priority: 'form',
      when: { metric: 'shoulder', below: 70 },
      sustainMs: 1200,
      cooldownMs: 10000,
      cueKey: 'cue.elbowShoulderHeight',
    },
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
  trackingConfidence: 'low',
  reference: {
    posture: 'standing',
    // The stretched arm is the one nearer the camera.
    cameraSide: 'left',
    cycleSeconds: 4,
    base: { hipAngle: 176, kneeAngle: 176, right: { shoulderAngle: 8, elbowAngle: 172 } },
    keyframes: [{ t: 0, pose: { left: { shoulderAbduction: 90, elbowAngle: 90 } } }],
  },
};
