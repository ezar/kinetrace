import type { ExerciseDefinition } from '../types.js';

/** Wall angels. Shoulder abduction seen from the front. */
export const wallAngels: ExerciseDefinition = {
  id: 'wall-angels',
  names: { es: 'Ángeles en la pared', en: 'Wall angels' },
  synonyms: {
    es: ['ángeles de pared', 'wall angels', 'deslizamiento en pared'],
    en: ['wall angels', 'wall slides', 'wall angel'],
  },
  howTo: {
    es: [
      'De espaldas a la pared, con los pies algo separados de ella y la espalda apoyada.',
      'Apoya también los brazos en la pared, con los codos doblados a la altura de los hombros.',
      'Sube los brazos por la pared hasta donde llegues sin despegarlos.',
      'Bájalos despacio. La zona lumbar y las muñecas no se separan de la pared.',
    ],
    en: [
      'Stand with your back to the wall, feet a little away from it and your back resting against it.',
      'Rest your arms on the wall too, elbows bent at shoulder height.',
      'Slide your arms up the wall as far as you can without lifting them off.',
      'Slide them down slowly. Your lower back and wrists stay on the wall.',
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
    shoulder: { id: 'shoulderAbduction', side: 'mean' },
    elbow: { id: 'elbowFlexion', side: 'mean' },
  },
  primaryMetric: 'shoulder',
  mode: 'reps',
  phases: [
    { id: 'down', when: { below: 100 }, minDwellMs: 300 },
    { id: 'up', when: { above: 130 }, minDwellMs: 500 },
  ],
  /**
   * No safety stop. Shoulder abduction is measured from 0 to 180 degrees and
   * both ends are anatomically reachable, so there is no value of it to stop
   * on; the limits this used to carry (0 to 185) simply bracketed the whole
   * measurable range and could never fire. The elbow rule below is what
   * actually protects the movement.
   */
  targets: { direction: 'increase', band: { min: 150, max: 180 } },
  rules: [
    {
      id: 'elbowsForward',
      priority: 'form',
      when: { metric: 'elbow', below: 70 },
      sustainMs: 800,
      cooldownMs: 6000,
      cueKey: 'cue.armsToWall',
    },
    {
      id: 'pace',
      priority: 'form',
      when: { signal: 'absVelocity', above: 75 },
      sustainMs: 500,
      cooldownMs: 8000,
      cueKey: 'cue.slowDown',
    },
  ],
  defaults: { sets: 2, reps: 10, restSeconds: 40 },
  trackingConfidence: 'high',
  reference: {
    posture: 'standing',
    cycleSeconds: 5,
    base: { hipAngle: 176, kneeAngle: 176, hipAbduction: 5, shoulderAngle: 4 },
    keyframes: [
      { t: 0, pose: { shoulderAbduction: 85, elbowAngle: 90 } },
      { t: 0.45, pose: { shoulderAbduction: 160, elbowAngle: 160 } },
      { t: 0.6, pose: { shoulderAbduction: 160, elbowAngle: 160 } },
      { t: 1, pose: { shoulderAbduction: 85, elbowAngle: 90 } },
    ],
  },
};
