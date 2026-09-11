/**
 * Text that belongs to the exercise library: spoken cues, camera placement tips
 * and setup assistant hints.
 *
 * The engine only ever emits keys. This dictionary is the Spanish and English
 * source for them, and the web app merges it into its own i18n dictionaries.
 *
 * Cue writing rules: under six words, imperative, and always what to do rather
 * than what is wrong ("lift your hips", not "your hips are low").
 */

import type { MetricId } from '@kinetrace/engine';
import type { Localized } from './types.js';

/** Cues raised by the engine itself, independently of any exercise rule. */
export const ENGINE_CUES: Record<string, Localized> = {
  'engine.goodRep': { es: 'bien, {count}', en: 'good, {count}' },
  'engine.partialRep': { es: 'un poco más, {value}', en: 'a bit further, {value}' },
  'engine.holdLost': { es: 'vuelve a la posición', en: 'back into position' },
  'engine.holdComplete': { es: 'hecho, buen trabajo', en: 'done, good work' },
  'engine.trackingLost': {
    es: 'te he perdido, vuelve al encuadre',
    en: 'I lost you, step back into view',
  },
  'engine.safetyStop': { es: 'para y descansa', en: 'stop and rest' },
};

/** Cues referenced by the form rules in the library. */
export const RULE_CUES: Record<string, Localized> = {
  'cue.liftHips': { es: 'sube las caderas', en: 'lift your hips' },
  'cue.lowerHips': { es: 'baja las caderas', en: 'lower your hips' },
  'cue.slowDown': { es: 'más despacio', en: 'slow down' },
  'cue.keepHipsLevel': { es: 'nivela las caderas', en: 'keep your hips level' },
  'cue.flattenBack': { es: 'aplana la espalda', en: 'flatten your back' },
  'cue.pressBackDown': { es: 'pega la espalda al suelo', en: 'press your back down' },
  'cue.kneesOut': { es: 'abre las rodillas', en: 'knees out' },
  'cue.chestUp': { es: 'pecho arriba', en: 'chest up' },
  'cue.straightenKnees': {
    es: 'estira un poco las rodillas',
    en: 'straighten your knees a little',
  },
  'cue.armsToWall': { es: 'brazos a la pared', en: 'arms to the wall' },
  'cue.turnMore': { es: 'gira un poco más', en: 'turn a bit more' },
  'cue.holdStill': { es: 'quédate quieto', en: 'hold still' },
  'cue.squeezeGlutes': { es: 'aprieta los glúteos', en: 'squeeze your glutes' },
  'cue.straightenLeg': { es: 'estira la pierna', en: 'straighten your leg' },
  'cue.liftLegHigher': { es: 'sube más la pierna', en: 'lift your leg higher' },
  'cue.dontTwist': { es: 'no gires el tronco', en: 'keep your trunk still' },
  'cue.elbowUnderShoulder': { es: 'codo bajo el hombro', en: 'elbow under your shoulder' },
  'cue.longNeck': { es: 'cuello largo, mirada abajo', en: 'long neck, look down' },
};

/** Hints the camera setup assistant shows while the checks are failing. */
export const SETUP_TIPS: Record<string, Localized> = {
  'setup.tip.wholeBody': {
    es: 'Que se te vea entero, de la cabeza a los pies',
    en: 'Fit your whole body in, head to feet',
  },
  'setup.tip.stepBack': { es: 'Aléjate un poco', en: 'Step back a little' },
  'setup.tip.comeCloser': { es: 'Acércate un poco', en: 'Come a little closer' },
  'setup.tip.turnSideways': {
    es: 'Ponte de lado a la cámara',
    en: 'Turn sideways to the camera',
  },
  'setup.tip.faceCamera': { es: 'Ponte de frente a la cámara', en: 'Face the camera' },
  'setup.tip.moreLight': { es: 'Hace falta más luz', en: 'A bit more light is needed' },
};

/** Where to put the phone for each exercise. */
export const CAMERA_TIPS: Record<string, Localized> = {
  'tip.floorSide': {
    es: 'Móvil en el suelo apoyado en un libro, a 2,5 m, apuntando a la esterilla desde el lado',
    en: 'Phone on the floor leaning on a book, 2.5 m away, pointing at the mat from the side',
  },
  'tip.floorFront': {
    es: 'Móvil en el suelo a 2,5 m, apuntando a la esterilla de frente',
    en: 'Phone on the floor 2.5 m away, pointing at the mat from the front',
  },
  'tip.chairSide': {
    es: 'Móvil en una silla, a 3 m, de lado a ti',
    en: 'Phone on a chair, 3 m away, to your side',
  },
  'tip.chairFront': {
    es: 'Móvil en una silla, a 3 m, de frente a ti',
    en: 'Phone on a chair, 3 m away, facing you',
  },
};

/** Human names for the metrics, for the library and the progress charts. */
export const METRIC_LABELS: Record<MetricId, Localized> = {
  kneeFlexion: { es: 'Flexión de rodilla', en: 'Knee flexion' },
  hipFlexion: { es: 'Flexión de cadera', en: 'Hip flexion' },
  shoulderFlexion: { es: 'Flexión de hombro', en: 'Shoulder flexion' },
  shoulderAbduction: { es: 'Abducción de hombro', en: 'Shoulder abduction' },
  elbowFlexion: { es: 'Flexión de codo', en: 'Elbow flexion' },
  trunkInclination: { es: 'Inclinación del tronco', en: 'Trunk inclination' },
  pelvisTilt: { es: 'Báscula pélvica', en: 'Pelvic tilt' },
  thoracicRotation: { es: 'Rotación torácica', en: 'Thoracic rotation' },
  hipLevelDifference: { es: 'Nivel de las caderas', en: 'Hip level' },
  kneeValgus: { es: 'Valgo de rodilla', en: 'Knee valgus' },
  trunkLineDeviation: { es: 'Alineación del cuerpo', en: 'Body line' },
  spineFlexion: { es: 'Flexión de la columna', en: 'Spine flexion' },
};

/** Localised name of a metric. */
export function metricLabel(id: MetricId, language: 'es' | 'en'): string {
  return METRIC_LABELS[id]?.[language] ?? id;
}

/** Every key the library and the engine can emit. */
export const EXERCISE_TEXT: Record<string, Localized> = {
  ...ENGINE_CUES,
  ...RULE_CUES,
  ...SETUP_TIPS,
  ...CAMERA_TIPS,
};

/** Resolve a cue or tip, interpolating `{name}` parameters. */
export function resolveText(
  key: string,
  language: 'es' | 'en',
  params?: Record<string, number | string>,
): string {
  const entry = EXERCISE_TEXT[key];
  if (!entry) return key;
  const template = entry[language];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] === undefined ? match : String(params[name]),
  );
}
