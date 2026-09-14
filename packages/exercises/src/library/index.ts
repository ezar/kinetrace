/**
 * Starter exercise library.
 *
 * Every entry is plain data validated at build time. To add one, copy the
 * closest file, change the numbers, add a fixture and run the replay tool:
 * see CONTRIBUTING.md.
 */

import type { ExerciseDefinition } from '../types.js';
import { birdDog } from './bird-dog.exercise.js';
import { bodyweightSquat } from './bodyweight-squat.exercise.js';
import { catCamel } from './cat-camel.exercise.js';
import { childsPose } from './childs-pose.exercise.js';
import { deadBug } from './dead-bug.exercise.js';
import { doorwayPecStretch } from './doorway-pec-stretch.exercise.js';
import { doubleKneeToChest } from './double-knee-to-chest.exercise.js';
import { frontPlank } from './front-plank.exercise.js';
import { gluteBridge } from './glute-bridge.exercise.js';
import { halfKneelingHipFlexor } from './half-kneeling-hip-flexor.exercise.js';
import { hipHinge } from './hip-hinge.exercise.js';
import { kneeToChest } from './knee-to-chest.exercise.js';
import { mcgillCurlUp } from './mcgill-curl-up.exercise.js';
import { pelvicTilt } from './pelvic-tilt.exercise.js';
import { pronePressUp } from './prone-press-up.exercise.js';
import { sidePlankFull } from './side-plank-full.exercise.js';
import { sidePlankKnees } from './side-plank-knees.exercise.js';
import { splitSquat } from './split-squat.exercise.js';
import { supineHamstringStretch } from './supine-hamstring-stretch.exercise.js';
import { supineShoulderFlexion } from './supine-shoulder-flexion.exercise.js';
import { thoracicRotationQuadruped } from './thoracic-rotation-quadruped.exercise.js';
import { wallAngels } from './wall-angels.exercise.js';

export const EXERCISES: readonly ExerciseDefinition[] = [
  pelvicTilt,
  catCamel,
  deadBug,
  birdDog,
  gluteBridge,
  mcgillCurlUp,
  sidePlankKnees,
  sidePlankFull,
  frontPlank,
  kneeToChest,
  doubleKneeToChest,
  childsPose,
  pronePressUp,
  hipHinge,
  wallAngels,
  thoracicRotationQuadruped,
  bodyweightSquat,
  splitSquat,
  supineHamstringStretch,
  halfKneelingHipFlexor,
  supineShoulderFlexion,
  doorwayPecStretch,
];

export {
  birdDog,
  bodyweightSquat,
  catCamel,
  childsPose,
  deadBug,
  doorwayPecStretch,
  doubleKneeToChest,
  frontPlank,
  gluteBridge,
  halfKneelingHipFlexor,
  hipHinge,
  kneeToChest,
  mcgillCurlUp,
  pelvicTilt,
  pronePressUp,
  sidePlankFull,
  sidePlankKnees,
  splitSquat,
  supineHamstringStretch,
  supineShoulderFlexion,
  thoracicRotationQuadruped,
  wallAngels,
};
