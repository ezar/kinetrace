/**
 * How long a gap between frames can be before it stops being time we watched.
 *
 * Every stateful part of the engine measures in wall-clock milliseconds taken
 * from the frame it is handed, which is right up until the frames stop coming.
 * They stop for ordinary reasons: the phone locks its screen, a call arrives,
 * the user switches app, the tab is hidden. When they resume, the difference
 * between the new timestamp and the last one is not elapsed exercise. It is
 * elapsed absence.
 *
 * Nothing in the engine can tell the two apart on its own, so they share one
 * number. Below it, a gap is a slow frame and counts. Above it, the engine was
 * not looking, and each part handles that in the way that is honest for it: the
 * hold timer credits no more than this, the repetition machine starts its dwell
 * again, and the filter forgets a history it cannot connect to.
 */

/**
 * 500 ms. A session runs at 24 to 30 frames a second and a struggling phone on
 * the heavy model still manages five or six, so half a second is far longer
 * than any real frame interval and far shorter than any real interruption.
 */
export const MAX_FRAME_GAP_MS = 500;

/** True when this frame arrived too long after the last one to connect them. */
export function isFrameGap(timestampMs: number, previousTimestampMs: number | null): boolean {
  return previousTimestampMs !== null && timestampMs - previousTimestampMs > MAX_FRAME_GAP_MS;
}
