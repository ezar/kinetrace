import { describe, expect, it } from 'vitest';
import { TrackRecorder, trackDurationMs, trackFrame, TRACK_FPS } from '../replay/track.js';
import { synthesizeFrames, type ReferenceMotion } from '../synth/motion.js';

const MOTION: ReferenceMotion = {
  posture: 'supine',
  cameraSide: 'left',
  cycleSeconds: 4,
  keyframes: [
    { t: 0, pose: { hipAngle: 128, kneeAngle: 90 } },
    { t: 0.5, pose: { hipAngle: 172, kneeAngle: 104 } },
    { t: 1, pose: { hipAngle: 128, kneeAngle: 90 } },
  ],
};

describe('TrackRecorder', () => {
  it('resamples a 30 fps session down to the track rate', () => {
    const frames = synthesizeFrames(MOTION, { view: 'side', fps: 30, cycles: 1 });
    const recorder = new TrackRecorder();
    for (const frame of frames) recorder.add(frame);
    const track = recorder.finish();
    expect(track.fps).toBe(TRACK_FPS);
    expect(track.frameCount).toBeGreaterThan(55);
    expect(track.frameCount).toBeLessThan(65);
    expect(trackDurationMs(track)).toBeCloseTo(4000, -2);
  });

  it('replays landmarks within the quantisation error', () => {
    const frames = synthesizeFrames(MOTION, { view: 'side', fps: 15, cycles: 1 });
    const recorder = new TrackRecorder();
    for (const frame of frames) recorder.add(frame);
    const track = recorder.finish();
    const original = frames[10]!.world;
    const replayed = trackFrame(track, 10);
    for (let index = 0; index < original.length; index += 1) {
      expect(replayed[index]!.x).toBeCloseTo(original[index]!.x, 3);
      expect(replayed[index]!.y).toBeCloseTo(original[index]!.y, 3);
      expect(replayed[index]!.visibility).toBeCloseTo(original[index]!.visibility, 1);
    }
  });

  it('stores about one kilobyte per second of movement', () => {
    const frames = synthesizeFrames(MOTION, { view: 'side', fps: 30, cycles: 5 });
    const recorder = new TrackRecorder();
    for (const frame of frames) recorder.add(frame);
    const track = recorder.finish();
    const bytesPerSecond =
      (track.positions.byteLength + track.visibility.byteLength) / (trackDurationMs(track) / 1000);
    expect(bytesPerSecond).toBeLessThan(4000);
  });
});
