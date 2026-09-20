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
  'engine.rushed': { es: 'más despacio, {seconds} s', en: 'slower, {seconds} s' },
};

/**
 * Names for the phases of a repetition cycle. The ids are internal; these are
 * what a person reads when they are asked how long a phase should take.
 */
export const PHASE_LABELS: Record<string, Localized> = {
  rest: { es: 'reposo', en: 'rest' },
  top: { es: 'arriba', en: 'top' },
  bottom: { es: 'abajo', en: 'bottom' },
  up: { es: 'subida', en: 'up' },
  down: { es: 'bajada', en: 'down' },
  hold: { es: 'sostén', en: 'hold' },
  stand: { es: 'de pie', en: 'standing' },
  neutral: { es: 'neutro', en: 'neutral' },
  extended: { es: 'extensión', en: 'extended' },
  tilted: { es: 'báscula', en: 'tilted' },
  tabletop: { es: 'cuadrupedia', en: 'tabletop' },
  rotated: { es: 'giro', en: 'rotated' },
  hinged: { es: 'flexión de cadera', en: 'hinged' },
  cat: { es: 'gato', en: 'cat' },
  camel: { es: 'camello', en: 'camel' },
};

/** The readable name of a phase, or the id itself when it has no entry yet. */
export function phaseLabel(id: string, language: 'es' | 'en'): string {
  return PHASE_LABELS[id]?.[language] ?? id;
}

/**
 * What to say to send somebody into a phase, for a session run without a
 * camera. The labels above name a phase for somebody reading a prescription;
 * these are the other half — an instruction, spoken while there is still time
 * to follow it.
 *
 * Keyed by phase id, because the ids are already specific: `top`, `hinged`,
 * `cat`. Only `rest` means different things in different exercises — lowering
 * the hips, releasing a knee, bringing a limb back — so the exercises that need
 * it override it by id. `phaseCueKey` picks the specific entry over the general
 * one.
 *
 * These are movement words, not clinical ones, and they follow the same rule as
 * every other cue: imperative, under six words, what to do rather than what is
 * wrong. A physiotherapist should still read them, as they should the cues.
 */
export const PHASE_CUES: Record<string, Localized> = {
  'phaseCue.rest': { es: 'y vuelve', en: 'and back' },
  'phaseCue.top': { es: 'sube', en: 'up' },
  'phaseCue.bottom': { es: 'baja', en: 'down' },
  'phaseCue.up': { es: 'sube', en: 'up' },
  'phaseCue.down': { es: 'baja', en: 'down' },
  'phaseCue.stand': { es: 'sube', en: 'up' },
  'phaseCue.neutral': { es: 'al centro', en: 'back to the middle' },
  'phaseCue.extended': { es: 'estira', en: 'reach out' },
  'phaseCue.tilted': { es: 'bascula', en: 'tilt' },
  'phaseCue.tabletop': { es: 'recoge', en: 'bring it back' },
  'phaseCue.rotated': { es: 'gira', en: 'rotate' },
  'phaseCue.hinged': { es: 'baja', en: 'hinge down' },
  'phaseCue.cat': { es: 'redondea', en: 'round your back' },
  'phaseCue.camel': { es: 'arquea', en: 'arch your back' },

  // Where returning to rest is a different movement in each exercise.
  'phaseCue.glute-bridge.rest': { es: 'baja', en: 'down' },
  'phaseCue.mcgill-curl-up.rest': { es: 'baja', en: 'down' },
  'phaseCue.prone-press-up.rest': { es: 'baja', en: 'down' },
  'phaseCue.knee-to-chest.rest': { es: 'suelta', en: 'release' },
  'phaseCue.pelvic-tilt.rest': { es: 'suelta', en: 'release' },
  'phaseCue.bird-dog.rest': { es: 'recoge', en: 'bring it back' },
};

/**
 * The key for what to say on entering a phase: the exercise's own wording where
 * it has one, the shared word otherwise, and nothing at all for a phase nobody
 * has written words for yet — better silent than reading an id aloud.
 */
export function phaseCueKey(exerciseId: string, phase: string): string | undefined {
  const specific = `phaseCue.${exerciseId}.${phase}`;
  if (PHASE_CUES[specific]) return specific;
  const general = `phaseCue.${phase}`;
  return PHASE_CUES[general] ? general : undefined;
}

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
  'cue.straightenArms': { es: 'estira los codos', en: 'straighten your elbows' },
  'cue.hipsOverKnees': { es: 'caderas sobre las rodillas', en: 'hips over your knees' },
  'cue.elbowShoulderHeight': {
    es: 'codo a la altura del hombro',
    en: 'elbow at shoulder height',
  },
  'cue.squeezeGlutes': { es: 'aprieta los glúteos', en: 'squeeze your glutes' },
  'cue.straightenLeg': { es: 'estira la pierna', en: 'straighten your leg' },
  'cue.liftLegHigher': { es: 'sube más la pierna', en: 'lift your leg higher' },
  'cue.dontTwist': { es: 'no gires el tronco', en: 'keep your trunk still' },
  'cue.elbowUnderShoulder': { es: 'codo bajo el hombro', en: 'elbow under your shoulder' },
  'cue.longNeck': { es: 'cuello largo, mirada abajo', en: 'long neck, look down' },
  'cue.dontPushWithArms': { es: 'no empujes con los brazos', en: 'do not push with your arms' },
  'cue.restYourHeadDown': { es: 'cabeza y espalda abajo', en: 'head and back down' },
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
  hipAbduction: { es: 'Abducción de cadera', en: 'Hip abduction' },
  elbowFlexion: { es: 'Flexión de codo', en: 'Elbow flexion' },
  trunkInclination: { es: 'Inclinación del tronco', en: 'Trunk inclination' },
  pelvisTilt: { es: 'Báscula pélvica', en: 'Pelvic tilt' },
  thoracicRotation: { es: 'Rotación torácica', en: 'Thoracic rotation' },
  hipLevelDifference: { es: 'Nivel de las caderas', en: 'Hip level' },
  kneeValgus: { es: 'Valgo de rodilla', en: 'Knee valgus' },
  trunkLineDeviation: { es: 'Alineación del cuerpo', en: 'Body line' },
  spineFlexion: { es: 'Flexión de la columna', en: 'Spine flexion' },
};

/**
 * What each metric measures, in words a person reads. The engine's own metric
 * documentation is English and describes the maths; this is the user-facing
 * explanation and it lives in the dictionary like every other piece of copy.
 */
export const METRIC_DESCRIPTIONS: Record<MetricId, Localized> = {
  kneeFlexion: {
    es: 'El ángulo entre cadera, rodilla y tobillo. 180° es la rodilla estirada del todo.',
    en: 'The angle between hip, knee and ankle. 180° is a fully straight knee.',
  },
  hipFlexion: {
    es: 'El ángulo entre hombro, cadera y rodilla. 180° es la cadera estirada del todo.',
    en: 'The angle between shoulder, hip and knee. 180° is a fully extended hip.',
  },
  shoulderFlexion: {
    es: 'Cuánto sube el brazo por delante. 0° es el brazo pegado al cuerpo.',
    en: 'How far the arm lifts in front. 0° is the arm by your side.',
  },
  shoulderAbduction: {
    es: 'Cuánto sube el brazo por el lado. 0° es el brazo pegado al cuerpo.',
    en: 'How far the arm lifts out to the side. 0° is the arm by your side.',
  },
  hipAbduction: {
    es: 'Cuánto se separa la pierna del cuerpo por el lado. 0° es la pierna en línea con el tronco.',
    en: 'How far the leg lifts out to the side. 0° is the leg in line with the trunk.',
  },
  elbowFlexion: {
    es: 'El ángulo entre hombro, codo y muñeca. 180° es el brazo estirado.',
    en: 'The angle between shoulder, elbow and wrist. 180° is a straight arm.',
  },
  trunkInclination: {
    es: 'La inclinación del tronco respecto a la vertical. 0° es erguido, 90° tumbado.',
    en: 'How far the trunk leans from vertical. 0° is upright, 90° is horizontal.',
  },
  pelvisTilt: {
    es: 'Cómo bascula la pelvis entre el tronco y los muslos. Es una medida aproximada.',
    en: 'How the pelvis tilts between trunk and thighs. This one is an approximation.',
  },
  thoracicRotation: {
    es: 'Cuánto gira la línea de los hombros respecto a la de las caderas.',
    en: 'How far the shoulder line turns against the hip line.',
  },
  hipLevelDifference: {
    es: 'Cuánto se inclina la línea de las caderas. 0° es con las dos a la misma altura.',
    en: 'How far the hip line tilts. 0° is both hips level.',
  },
  kneeValgus: {
    es: 'Cuánto se mete la rodilla hacia dentro respecto a la línea cadera-tobillo.',
    en: 'How far the knee falls inwards from the hip-to-ankle line.',
  },
  trunkLineDeviation: {
    es: 'Cuánto se sale la cadera de la línea entre hombros y pies. 0° es el cuerpo recto.',
    en: 'How far the hips leave the line from shoulders to feet. 0° is a straight body.',
  },
  spineFlexion: {
    es: 'Cuánto se curva la espalda, medido entre hombros, caderas y rodillas.',
    en: 'How far the back curves, measured across shoulders, hips and knees.',
  },
};

/** What a metric measures, in the reader's language. */
export function metricDescription(id: MetricId, language: 'es' | 'en'): string {
  return METRIC_DESCRIPTIONS[id]?.[language] ?? '';
}

/** Localised name of a metric. */
export function metricLabel(id: MetricId, language: 'es' | 'en'): string {
  return METRIC_LABELS[id]?.[language] ?? id;
}

/** Every key the library and the engine can emit. */
export const EXERCISE_TEXT: Record<string, Localized> = {
  ...ENGINE_CUES,
  ...RULE_CUES,
  ...PHASE_CUES,
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
