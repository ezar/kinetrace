import type { ExerciseDefinition } from '../types.js';

/** Thoracic rotation in quadruped ("open book" on all fours), seen from the front. */
export const thoracicRotationQuadruped: ExerciseDefinition = {
  id: 'thoracic-rotation-quadruped',
  names: { es: 'Rotación torácica en cuadrupedia', en: 'Quadruped thoracic rotation' },
  synonyms: {
    es: ['rotación torácica', 'apertura torácica', 'thread the needle', 'rotación dorsal'],
    en: ['thoracic rotation', 'open book', 'thread the needle', 'quadruped rotation'],
  },
  howTo: {
    es: [
      'Ponte a cuatro patas y lleva una mano detrás de la cabeza.',
      'Gira el tronco abriendo ese codo hacia el techo, siguiéndolo con la mirada.',
      'Vuelve despacio al centro.',
      'Las caderas no giran: el movimiento es de la parte alta de la espalda.',
    ],
    en: [
      'Get on all fours and put one hand behind your head.',
      'Turn your trunk and open that elbow towards the ceiling, following it with your eyes.',
      'Come back slowly to the middle.',
      'Your hips do not turn: the movement belongs to your upper back.',
    ],
  },
  area: 'thoracic',
  position: 'quadruped',
  spinalLoad: 'rotation',
  // Thresholds and bands read off the replay tool; the dose written by hand.
  provenance: { targets: 'derived', dose: 'authored' },
  equipment: 'mat',
  view: { orientation: 'front', cameraHeight: 'floor', distanceMetres: 2.5 },
  cameraTipKey: 'tip.floorFront',
  metrics: {
    rotation: { id: 'thoracicRotation', side: 'auto', absolute: true },
    rotationSigned: { id: 'thoracicRotation', side: 'auto' },
  },
  primaryMetric: 'rotation',
  mode: 'reps',
  unilateral: true,
  phases: [
    { id: 'neutral', when: { below: 15 }, minDwellMs: 300 },
    { id: 'rotated', when: { above: 30 }, minDwellMs: 500 },
  ],
  /**
   * No safety stop. The primary metric is the magnitude of the rotation, which
   * runs 0 to 90 degrees, so the old limits of 0 to 100 bracketed everything it
   * could ever report and never fired. Turning too far is not the risk here;
   * the rules below watch for the hips following the shoulders, which is.
   */
  targets: { direction: 'increase', band: { min: 45, max: 90 } },
  rules: [
    {
      id: 'reachFurther',
      priority: 'encouragement',
      when: { all: [{ above: 30 }, { below: 45 }] },
      phases: ['rotated'],
      sustainMs: 900,
      cooldownMs: 12000,
      cueKey: 'cue.turnMore',
    },
    {
      id: 'pace',
      priority: 'form',
      when: { signal: 'absVelocity', above: 60 },
      sustainMs: 500,
      cooldownMs: 8000,
      cueKey: 'cue.slowDown',
    },
  ],
  defaults: { sets: 2, reps: 8, restSeconds: 30 },
  trackingConfidence: 'medium',
  reference: {
    posture: 'quadruped',
    cycleSeconds: 5,
    base: {
      hipAngle: 90,
      kneeAngle: 90,
      right: { shoulderAngle: 90, elbowAngle: 176 },
      left: { shoulderAngle: 90, elbowAngle: 100 },
    },
    keyframes: [
      { t: 0, pose: { trunkRotation: 0 } },
      { t: 0.45, pose: { trunkRotation: 55 } },
      { t: 0.6, pose: { trunkRotation: 55 } },
      { t: 1, pose: { trunkRotation: 0 } },
    ],
  },
};
