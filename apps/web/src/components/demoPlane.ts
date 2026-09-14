/**
 * Which anatomical plane the demonstration figure is drawn in.
 *
 * Not the camera's plane, which is what this used to be. The camera's view is
 * chosen so the *metric* can be computed — `thoracicRotation` needs the front —
 * and a body's legibility as a drawing is a different question with a different
 * answer. Project a quadruped or a lying pose onto the frontal plane and the
 * whole head-to-toe axis is the axis you threw away: the figure collapses into
 * a scaffold a metre tall and thirty centimetres wide. `StickFigure` has said
 * so in a comment since it was written; nothing made the demo obey it, and the
 * thoracic rotation shipped with a figure nobody could read.
 *
 * So the plane follows the posture:
 *
 * - **standing** is legible either way, so the camera's view wins — a wall
 *   angel drawn from the side would hide the whole movement.
 * - **supine, prone, quadruped** are legible only from the side: their long
 *   axis lies along the depth the frontal plane discards.
 * - **side lying** is the mirror case. The body's long axis is across the
 *   frontal plane and into the sagittal one, so it is the front that works —
 *   which is what the side planks have always relied on.
 */

import type { PostureName } from '@kinetrace/engine';

export type DemoPlane = 'sagittal' | 'frontal';

export function demoPlane(posture: PostureName, view: 'side' | 'front'): DemoPlane {
  if (posture === 'standing') return view === 'side' ? 'sagittal' : 'frontal';
  if (posture === 'sideLyingLeft' || posture === 'sideLyingRight') return 'frontal';
  return 'sagittal';
}
