import type { ExerciseDefinition } from '../types.js';

/**
 * Arms overhead, lying down. Shoulder flexion in the sagittal plane, with the
 * floor as the thing that keeps the rest of the body honest.
 *
 * Standing, the easy way to raise your arms further is to arch the lower back
 * and let the ribs flare; lying down the floor is behind you and that road is
 * closed, which is the whole reason the exercise is done here. The camera sees
 * the arm against the trunk, not the gap under the lumbar spine, so the rule
 * below watches the elbows — the other way to fake the range is to bend them.
 */
export const supineShoulderFlexion: ExerciseDefinition = {
  id: 'supine-shoulder-flexion',
  names: { es: 'Brazos arriba tumbado', en: 'Supine shoulder flexion' },
  synonyms: {
    es: [
      'brazos por encima de la cabeza',
      'elevación de brazos tumbado',
      'flexión de hombro tumbado',
      'brazos arriba boca arriba',
    ],
    en: [
      'overhead reach',
      'supine arm raise',
      'lying shoulder flexion',
      'arms overhead lying down',
    ],
  },
  howTo: {
    es: [
      'Túmbate boca arriba con las rodillas dobladas y los pies apoyados.',
      'Empieza con los brazos estirados a los lados del cuerpo, las palmas hacia dentro.',
      'Sube los brazos rectos por delante hasta llevarlos por encima de la cabeza, hasta donde lleguen sin que la espalda se despegue del suelo.',
      'Bájalos despacio por el mismo camino. Los codos no se doblan.',
    ],
    en: [
      'Lie on your back with your knees bent and your feet flat.',
      'Start with your arms straight alongside your body, palms facing in.',
      'Raise your straight arms forward and overhead, as far as they go without your back lifting off the floor.',
      'Lower them slowly the same way. Your elbows stay straight.',
    ],
  },
  area: 'neckShoulders',
  position: 'supine',
  spinalLoad: 'neutral',
  // Thresholds and bands read off the replay tool; the dose written by hand.
  provenance: { targets: 'derived', dose: 'authored' },
  equipment: 'mat',
  view: { orientation: 'side', cameraHeight: 'floor', distanceMetres: 2.5 },
  cameraTipKey: 'tip.floorSide',
  metrics: {
    shoulder: { id: 'shoulderFlexion', side: 'auto' },
    elbow: { id: 'elbowFlexion', side: 'auto' },
  },
  primaryMetric: 'shoulder',
  mode: 'reps',
  phases: [
    { id: 'down', when: { below: 40 }, minDwellMs: 300 },
    { id: 'up', when: { above: 120 }, minDwellMs: 400 },
  ],
  /**
   * No safety stop. Shoulder flexion runs 0 to 180 and both ends are places a
   * shoulder can go; there is no value of it to stop on, and a range that
   * brackets everything the metric can report is the defect ADR 5 found rather
   * than a precaution.
   */
  targets: { direction: 'increase', band: { min: 150, max: 180 } },
  rules: [
    {
      id: 'elbowsBending',
      priority: 'form',
      when: { metric: 'elbow', below: 140 },
      sustainMs: 900,
      cooldownMs: 8000,
      cueKey: 'cue.straightenArms',
    },
    {
      id: 'pace',
      priority: 'form',
      // A hundred and thirty, not the seventy-five the wall angels use. The
      // threshold is not a speed somebody should never exceed in the abstract:
      // it is a multiple of what this movement produces at a correct tempo, and
      // this arc is twice the wall angels' over the same seconds, so it peaks
      // at 93 deg/s done properly. Read off the replay tool with the same
      // headroom the wall angels leave, which is about a factor of 1.4.
      when: { signal: 'absVelocity', above: 130 },
      sustainMs: 500,
      cooldownMs: 8000,
      cueKey: 'cue.slowDown',
    },
  ],
  defaults: { sets: 2, reps: 10, restSeconds: 30 },
  trackingConfidence: 'high',
  reference: {
    posture: 'supine',
    cameraSide: 'left',
    // Six seconds a repetition, which is what "lower them slowly" looks like
    // over an arc this long: ten of them is a minute of work.
    cycleSeconds: 6,
    // Knees bent with the feet flat, which is what takes the pull off the
    // lower back and lets it stay on the floor.
    base: { hipAngle: 128, kneeAngle: 90, elbowAngle: 174 },
    keyframes: [
      { t: 0, pose: { shoulderAngle: 12 } },
      { t: 0.45, pose: { shoulderAngle: 168 } },
      { t: 0.6, pose: { shoulderAngle: 168 } },
      { t: 1, pose: { shoulderAngle: 12 } },
    ],
  },
};
